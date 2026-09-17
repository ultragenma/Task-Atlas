const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore } = require("../backend/app/store");
const { parseContext } = require("../backend/app/assessment");
const { defaultData } = require("../scripts/validate_seed_data");

test("every catalog object has a proposed collection task reachable through shared graph concepts", () => {
  const store = createStore();
  const context = parseContext(new URLSearchParams());
  const seeds = defaultData();
  const rounds = [...new Set(store.data.tasks.filter((task) => task.id.startsWith("task_ycb_")).map((task) => task.generation_version))];
  assert.ok(rounds.length > 0, "catalog generation rounds must be recorded");
  assert.deepEqual(store.data.tasks.map((task) => task.id), seeds.tasks.map((task) => task.id));
  const adjacency = new Map();
  const connect = (a, b) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  };
  for (const object of store.data.objects) {
    const tasks = store.listTasks({ object_id: object.id }, context);
    assert.ok(tasks.length, `${object.id}: missing seeded task`);
    const authored = store.data.tasks.filter((task) => task.object_id === object.id && task.id.startsWith("task_ycb_"));
    for (const round of rounds) assert.equal(authored.filter((task) => task.generation_version === round).length, 1, `${object.id}: exactly one new task in ${round}`);
    assert.equal(new Set(authored.map((task) => JSON.stringify([...task.goal_state].sort()))).size, authored.length, `${object.id}: duplicate goal across rounds`);
    const group = store.neighbors(`group:${object.id}:tasks`, "all", context);
    for (const task of tasks) {
      assert.ok(group.nodes.some((node) => node.id === task.id));
      const card = store.collectionCard(task.id, context);
      assert.ok(card.collection.success_criteria.length, task.id);
      assert.equal(card.assessment.execution_status, "unverified");
      const graph = store.neighbors(task.id, "all", context);
      // Test meaningful connections without shared evidence, claims, or catalog categories.
      for (const edge of graph.edges.filter((edge) => ["acts_on", "compatible_with_scene", "serves_intent", "may_use", "uses_template"].includes(edge.relation))) {
        connect(edge.source, edge.target);
        if (edge.relation !== "acts_on") {
          const reverse = store.neighbors(edge.target, "all", context);
          assert.ok(reverse.nodes.some((node) => node.id === task.id), `${task.id}: missing reverse ${edge.relation}`);
        }
      }
      if (task.id.startsWith("task_ycb_")) {
        assert.equal(task.review_status, "proposed");
        const definition = store.getTask(task.id);
        const template = store.maps.taskTemplates.get(task.template_id);
        for (const role of Object.keys(definition.bindings)) assert.ok(Object.hasOwn(template.roles, role), `${task.id}: undeclared template role ${role}`);
        const plan = store.data.planning.find((item) => item.task_id === task.id);
        for (const requirement of plan.requirements.filter((item) => item.key === "object" && item.value !== task.object_id)) {
          const resourceId = store.maps.objects.has(requirement.value) ? requirement.value : `resource:${requirement.value}`;
          assert.ok(graph.edges.some((edge) => edge.target === resourceId && edge.relation === "requires_resource"), `${task.id}: missing required resource edge`);
          const reverse = store.neighbors(resourceId, "context", context);
          assert.ok(reverse.edges.some((edge) => edge.source === task.id && edge.relation === "requires_resource"), `${task.id}: missing reverse resource edge`);
          const goalView = store.neighbors(resourceId, "goals", context);
          assert.ok(!goalView.edges.some((edge) => edge.relation === "requires_resource"));
        }
        assert.ok(plan.requirements.some((item) => item.key === "object" && item.value === object.id), `${task.id}: missing primary object requirement`);
        assert.ok(plan.requirements.some((item) => item.key === "condition"), `${task.id}: initial setup must be declared`);
        const declared = new URLSearchParams({ profile: "real_world" });
        for (const key of ["scene_id", "contents", "role"]) {
          const requirement = plan.requirements.find((item) => item.key === key);
          if (requirement) declared.set(key, requirement.value);
        }
        for (const [key, parameter] of [["object", "available_objects"], ["capability", "capabilities"], ["condition", "confirmed_conditions"]]) {
          declared.set(parameter, plan.requirements.filter((item) => item.key === key).map((item) => item.value).join(","));
        }
        const declaredCard = store.collectionCard(task.id, parseContext(declared));
        assert.equal(declaredCard.assessment.status, "ready", `${task.id}: fully declared setup`);
        assert.equal(declaredCard.assessment.execution_status, "unverified");
        if (plan.requirements.some((item) => item.key === "capability" && item.value === "deformable_manipulation")) {
          declared.set("profile", "rigid_sim");
          assert.equal(store.collectionCard(task.id, parseContext(declared)).assessment.status, "blocked", `${task.id}: flexible handling cannot be validated by a rigid-only profile`);
        }
        for (const type of ["population_frequency", "robot_execution", "asset_compatibility"]) {
          const claims = card.claims.filter((claim) => claim.claim_type === type);
          assert.equal(claims.length, 1);
          assert.equal(claims[0].status, "unknown");
          assert.equal(claims[0].value, null);
          assert.deepEqual(claims[0].source_ids, []);
        }
        assert.equal(card.provenance.task_seed, "ycb_batches/");
      }
    }
  }
  const reached = new Set([store.data.objects[0].id]);
  const queue = [...reached];
  for (let i = 0; i < queue.length; i++) {
    for (const id of adjacency.get(queue[i]) || []) {
      if (!reached.has(id)) { reached.add(id); queue.push(id); }
    }
  }
  for (const object of store.data.objects) assert.ok(reached.has(object.id), `${object.id}: disconnected`);
});
