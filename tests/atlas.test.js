const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createServer, store } = require("../backend/server");
const { validateData, defaultData } = require("../scripts/validate_seed_data");

let server;
let baseUrl;

function request(pathname) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(pathname, baseUrl);
    const client = http.get(requestUrl, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () =>
        resolve({
          status: response.statusCode,
          headers: response.headers,
          body,
        }),
      );
    });
    client.on("error", reject);
  });
}

function json(response) {
  assert.match(response.headers["content-type"] || "", /application\/json/);
  return JSON.parse(response.body);
}

function pathWithQuery(pathname, entries = []) {
  const url = new URL(pathname, "http://atlas.test");
  for (const [key, value] of entries) url.searchParams.append(key, value);
  return `${url.pathname}${url.search}`;
}

function textOf(value) {
  return JSON.stringify(value).toLocaleLowerCase();
}
function requirementList(detail) {
  return detail.planning?.requirements || detail.requirements || [];
}
function taskText(detail) {
  return textOf({
    task: detail.task,
    planning: detail.planning,
    collection: detail.collection,
  });
}

function assessmentOf(detail) {
  assert.ok(detail.assessment, "task detail must expose a context assessment");
  assert.equal(detail.assessment.execution_status, "unverified");
  return detail.assessment;
}

function contextForReady(detail, overrides = {}) {
  const selected = new Map();
  const resourceIds = [];
  const capabilityIds = [];
  const conditionIds = [];
  for (const requirement of requirementList(detail)) {
    if (
      !selected.has(requirement.key) &&
      ["contents", "role", "scene_id"].includes(requirement.key)
    )
      selected.set(requirement.key, requirement.value);
    if (requirement.key === "object") resourceIds.push(requirement.value);
    if (requirement.key === "capability") capabilityIds.push(requirement.value);
    if (requirement.key === "condition") conditionIds.push(requirement.value);
  }
  if (!selected.has("scene_id") && detail.task?.scene_id)
    selected.set("scene_id", detail.task.scene_id);
  const entries = [...selected.entries()];
  if (resourceIds.length)
    entries.push(["available_objects", [...new Set(resourceIds)].join(",")]);
  if (capabilityIds.length)
    entries.push(["capabilities", [...new Set(capabilityIds)].join(",")]);
  if (conditionIds.length)
    entries.push([
      "confirmed_conditions",
      [...new Set(conditionIds)].join(","),
    ]);
  entries.push(["profile", "real_world"]);
  for (const [key, value] of Object.entries(overrides)) {
    const index = entries.findIndex(([existing]) => existing === key);
    if (index >= 0) entries[index] = [key, value];
    else entries.push([key, value]);
  }
  return entries;
}

async function detailsForObject(objectId) {
  const response = await request(
    pathWithQuery("/api/tasks", [
      ["object_id", objectId],
      ["limit", "500"],
    ]),
  );
  assert.equal(response.status, 200);
  const summaries = json(response).data;
  assert.ok(
    summaries.length > 0,
    "the explored object must have seeded candidates",
  );
  return Promise.all(
    summaries.map(async (summary) => {
      const response = await request(
        `/api/tasks/${encodeURIComponent(summary.id)}`,
      );
      assert.equal(response.status, 200);
      return json(response).data;
    }),
  );
}

function findTask(details, predicate, description) {
  const result = details.find(predicate);
  assert.ok(result, `expected a seeded ${description} task`);
  return result;
}

async function taskDetail(id, entries = []) {
  const response = await request(
    pathWithQuery(`/api/tasks/${encodeURIComponent(id)}`, entries),
  );
  assert.equal(response.status, 200);
  return json(response).data;
}

async function startServer(httpServer) {
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      httpServer.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      httpServer.off("error", onError);
      resolve();
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(0, "127.0.0.1");
  });
}

test.before(async () => {
  server = createServer();
  await startServer(server);
  const address = server.address();
  assert.ok(address && typeof address === "object" && address.port > 0);
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (!server?.listening) return;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("health and catalog smoke checks describe seeded data without treating counts as success", async () => {
  const health = json(await request("/api/health"));
  assert.equal(health.ok, true);
  assert.ok(health.seed_counts.objects > 0);
  assert.ok(health.seed_counts.task_instances > 0);
  const catalog = json(await request("/api/objects?q=mustard"));
  assert.ok(catalog.data.length > 0);
  assert.ok(catalog.data.some((object) => /mustard/i.test(textOf(object))));
});

test("root serves the current Task Atlas explorer shell and graph mount", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"] || "", /text\/html/);
  assert.match(response.body, /<title>Task Atlas<\/title>/);
  assert.match(response.body, /id="graph"/);
  assert.match(response.body, /RELATIONSHIP GRAPH/);
});

test("full and empty contents assess dispensing and disposal differently", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  assert.ok(mustard);
  const details = await detailsForObject(mustard.id);
  const dispensing = findTask(
    details,
    (detail) =>
      requirementList(detail).some(
        (item) => item.key === "contents" && item.value === "full",
      ) && /(dispens|apply|squeez|pour)/.test(taskText(detail)),
    "full-content dispensing",
  );
  const disposal = findTask(
    details,
    (detail) =>
      requirementList(detail).some(
        (item) => item.key === "contents" && item.value === "empty",
      ) &&
      /(dispos|discard|recycl|throw away|empty container)/.test(
        taskText(detail),
      ),
    "empty-content disposal",
  );
  const dispensingFull = await taskDetail(
    dispensing.task.id,
    contextForReady(dispensing, { contents: "full" }),
  );
  const dispensingEmpty = await taskDetail(
    dispensing.task.id,
    contextForReady(dispensing, { contents: "empty" }),
  );
  assert.equal(assessmentOf(dispensingFull).status, "ready");
  assert.notEqual(assessmentOf(dispensingEmpty).status, "ready");
  assert.ok(
    assessmentOf(dispensingEmpty).reasons.some(
      (reason) => reason.kind === "conflict" && reason.key === "contents",
    ),
  );
  const disposalEmpty = await taskDetail(
    disposal.task.id,
    contextForReady(disposal, { contents: "empty" }),
  );
  const disposalFull = await taskDetail(
    disposal.task.id,
    contextForReady(disposal, { contents: "full" }),
  );
  assert.equal(assessmentOf(disposalEmpty).status, "ready");
  assert.notEqual(assessmentOf(disposalFull).status, "ready");
});

test("retail role changes customer shopping and staff restocking, while absent resources remain explained", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const customer = findTask(
    details,
    (detail) =>
      requirementList(detail).some(
        (item) => item.key === "role" && item.value === "customer",
      ),
    "customer retail",
  );
  const staff = findTask(
    details,
    (detail) =>
      requirementList(detail).some(
        (item) => item.key === "role" && item.value === "staff",
      ),
    "staff restocking",
  );
  const customerReady = await taskDetail(
    customer.task.id,
    contextForReady(customer, { role: "customer" }),
  );
  const customerAsStaff = await taskDetail(
    customer.task.id,
    contextForReady(customer, { role: "staff" }),
  );
  const staffReady = await taskDetail(
    staff.task.id,
    contextForReady(staff, { role: "staff" }),
  );
  const staffAsCustomer = await taskDetail(
    staff.task.id,
    contextForReady(staff, { role: "customer" }),
  );
  assert.equal(assessmentOf(customerReady).status, "ready");
  assert.notEqual(assessmentOf(customerAsStaff).status, "ready");
  assert.equal(assessmentOf(staffReady).status, "ready");
  assert.notEqual(assessmentOf(staffAsCustomer).status, "ready");
  const noResources = await taskDetail(
    customer.task.id,
    contextForReady(customer, { available_objects: "" }),
  );
  assert.ok(
    assessmentOf(noResources).missing_objects.length > 0,
    "an explicitly empty resource list must explain missing cart or other resources",
  );
  assert.ok(
    assessmentOf(noResources).reasons.some(
      (reason) => reason.kind === "missing" && reason.key === "object",
    ),
  );
});

test("omitted and explicitly empty resource lists preserve unknown versus absent information", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const resourceBound = findTask(
    details,
    (detail) => requirementList(detail).some((item) => item.key === "object"),
    "resource-bound",
  );
  const base = contextForReady(resourceBound).filter(
    ([key]) => key !== "available_objects",
  );
  const omitted = await taskDetail(resourceBound.task.id, base);
  const explicitEmpty = await taskDetail(resourceBound.task.id, [
    ...base,
    ["available_objects", ""],
  ]);
  assert.ok(
    assessmentOf(omitted).reasons.some(
      (reason) => reason.kind === "unknown" && reason.key === "object",
    ),
  );
  assert.ok(
    assessmentOf(explicitEmpty).reasons.some(
      (reason) => reason.kind === "missing" && reason.key === "object",
    ),
  );
  assert.ok(assessmentOf(explicitEmpty).missing_objects.length > 0);
});

test("all assessment states are reachable, and ready mode requires a fully declared context", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const readyCandidate = findTask(
    details,
    (detail) => requirementList(detail).length > 0,
    "planned",
  );
  const readyContext = contextForReady(readyCandidate);
  assert.equal(
    assessmentOf(await taskDetail(readyCandidate.task.id, readyContext)).status,
    "ready",
  );
  assert.equal(
    assessmentOf(await taskDetail(readyCandidate.task.id)).status,
    "unknown",
  );
  const resourceBound = findTask(
    details,
    (detail) => requirementList(detail).some((item) => item.key === "object"),
    "resource-bound",
  );
  assert.equal(
    assessmentOf(
      await taskDetail(
        resourceBound.task.id,
        contextForReady(resourceBound, { available_objects: "" }),
      ),
    ).status,
    "needs_changes",
  );
  const conditionBound = findTask(
    details,
    (detail) =>
      requirementList(detail).some((item) => item.key === "condition"),
    "condition-bound",
  );
  const blockingCondition = requirementList(conditionBound).find(
    (item) => item.key === "condition",
  ).value;
  const blocked = await taskDetail(
    conditionBound.task.id,
    contextForReady(conditionBound, { blocked_conditions: blockingCondition }),
  );
  assert.equal(assessmentOf(blocked).status, "blocked");
  assert.ok(assessmentOf(blocked).safety_blockers.length > 0);
  const readyList = json(
    await request(
      pathWithQuery("/api/tasks", [
        ...readyContext,
        ["mode", "ready"],
        ["object_id", mustard.id],
      ]),
    ),
  ).data;
  assert.ok(readyList.length > 0);
  assert.ok(
    readyList.every((candidate) => candidate.assessment.status === "ready"),
  );
});

test("rigid simulation and explicit safety blockers override otherwise declared capability", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const special = findTask(
    details,
    (detail) =>
      requirementList(detail).some(
        (item) =>
          item.key === "capability" &&
          /(squeez|open.*cap|cap.*open|flow)/i.test(item.value),
      ) || /(squeez|open.*cap|cap.*open|material flow)/.test(taskText(detail)),
    "squeezing or cap-opening",
  );
  const capabilities = requirementList(special)
    .filter((item) => item.key === "capability")
    .map((item) => item.value)
    .join(",");
  const rigid = await taskDetail(
    special.task.id,
    contextForReady(special, { profile: "rigid_sim", capabilities }),
  );
  assert.equal(assessmentOf(rigid).status, "blocked");
  assert.ok(
    assessmentOf(rigid).reasons.some((reason) => reason.kind === "unsupported"),
  );
});

test("a single declared value never satisfies an AND group of resources, capabilities, or conditions", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const cases = [
    ["object", "available_objects"],
    ["capability", "capabilities"],
    ["condition", "confirmed_conditions"],
  ];
  for (const [requirementKey, queryKey] of cases) {
    const candidate = findTask(
      details,
      (detail) =>
        requirementList(detail).filter((item) => item.key === requirementKey)
          .length >= 2,
      `task with AND ${requirementKey} requirements`,
    );
    const required = requirementList(candidate)
      .filter((item) => item.key === requirementKey)
      .map((item) => item.value);
    const partial = await taskDetail(
      candidate.task.id,
      contextForReady(candidate, { [queryKey]: required[0] }),
    );
    assert.notEqual(
      assessmentOf(partial).status,
      "ready",
      `one ${requirementKey} value must not satisfy ${required.join(", ")}`,
    );
  }
});

test("rigid simulation permits fully declared rigid manipulation and visual inspection", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const rigidTask = findTask(
    details,
    (detail) => {
      const capabilities = requirementList(detail)
        .filter((item) => item.key === "capability")
        .map((item) => item.value)
        .join(" ");
      return (
        /(inspect|visual)/.test(taskText(detail)) &&
        /(grasp|place|move|manipulat|inspect|visual)/.test(taskText(detail)) &&
        !/(squeez|flow|open.*cap|cap.*open)/.test(capabilities)
      );
    },
    "rigid manipulation and visual-inspection",
  );
  const detail = await taskDetail(
    rigidTask.task.id,
    contextForReady(rigidTask, { profile: "rigid_sim" }),
  );
  assert.equal(assessmentOf(detail).status, "ready");
  assert.equal(assessmentOf(detail).execution_status, "unverified");
  assert.ok(
    !assessmentOf(detail).reasons.some(
      (reason) => reason.kind === "unsupported",
    ),
  );
});

test("an explicit safety block wins over confirmation of that same condition", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const candidate = findTask(
    details,
    (detail) =>
      requirementList(detail).some((item) => item.key === "condition"),
    "condition-bound",
  );
  const conditionId = requirementList(candidate).find(
    (item) => item.key === "condition",
  ).value;
  assert.match(
    conditionId,
    /^[a-z0-9_]+$/,
    "condition IDs used in query strings must be stable snake_case values",
  );
  const detail = await taskDetail(
    candidate.task.id,
    contextForReady(candidate, {
      confirmed_conditions: conditionId,
      blocked_conditions: conditionId,
    }),
  );
  assert.equal(assessmentOf(detail).status, "blocked");
  assert.ok(
    assessmentOf(detail).reasons.some(
      (reason) =>
        reason.kind === "safety" &&
        [].concat(reason.value).includes(conditionId),
    ),
  );
});

test("a fridge goal stays fixed while proposed procedures remain optional", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const fridge = findTask(
    details,
    (detail) =>
      /(refrigerator|cold storage|refrigerated)/.test(taskText(detail)) &&
      (detail.procedures || detail.planning?.procedures || []).length >= 2,
    "multi-procedure fridge",
  );
  const procedures = fridge.procedures || fridge.planning.procedures;
  const context = contextForReady(fridge);
  const cardAResponse = await request(
    pathWithQuery(
      `/api/tasks/${encodeURIComponent(fridge.task.id)}/collection-card`,
      [...context, ["procedure_id", procedures[0].id]],
    ),
  );
  const cardBResponse = await request(
    pathWithQuery(
      `/api/tasks/${encodeURIComponent(fridge.task.id)}/collection-card`,
      [...context, ["procedure_id", procedures[1].id]],
    ),
  );
  assert.equal(cardAResponse.status, 200);
  assert.equal(cardBResponse.status, 200);
  const cardA = json(cardAResponse).data;
  const cardB = json(cardBResponse).data;
  assert.deepEqual(cardA.goal_state, cardB.goal_state);
  assert.notEqual(cardA.chosen_procedure.id, cardB.chosen_procedure.id);
  const detailProcedureA = (
    await taskDetail(fridge.task.id, context)
  ).procedures.find((procedure) => procedure.id === procedures[0].id);
  assert.deepEqual(cardA.assessment, cardA.chosen_procedure.assessment);
  assert.deepEqual(
    cardA.chosen_procedure.assessment,
    detailProcedureA.assessment,
  );
  assert.ok(Array.isArray(cardA.required_resources));
  assert.ok(
    Object.values(cardA.collection.time_estimates).every(
      (value) => value === null,
    ),
  );
  assert.ok(Array.isArray(cardA.claims) && Array.isArray(cardA.sources));
  assert.ok(
    cardA.claims.every(
      (claim) =>
        typeof claim.limitations === "string" && claim.limitations.length > 0,
    ),
  );
  assert.ok(
    cardA.sources.every(
      (source) =>
        typeof source.limitations === "string" && source.limitations.length > 0,
    ),
  );
  const sourceIds = new Set(cardA.sources.map((source) => source.id));
  assert.ok(
    cardA.claims.every((claim) =>
      (claim.source_ids || []).every((sourceId) => sourceIds.has(sourceId)),
    ),
    "each claim source_id must resolve in the card",
  );
  assert.equal(
    (
      await request(
        pathWithQuery(
          `/api/tasks/${encodeURIComponent(fridge.task.id)}/collection-card`,
          [...context, ["procedure_id", "not-a-procedure"]],
        ),
      )
    ).status,
    400,
  );
});

test("collection cards expose missing setup and provenance for tasks that need added objects", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const hotDog = findTask(
    details,
    (detail) =>
      /(hot dog|hotdog)/.test(taskText(detail)) &&
      requirementList(detail).some((item) => item.key === "object"),
    "hot-dog preparation",
  );
  const response = await request(
    pathWithQuery(
      `/api/tasks/${encodeURIComponent(hotDog.task.id)}/collection-card`,
      contextForReady(hotDog, { available_objects: mustard.id }),
    ),
  );
  assert.equal(response.status, 200);
  const card = json(response).data;
  assert.notEqual(card.assessment.status, "ready");
  assert.ok(
    card.assessment.missing_objects.length > 0 &&
      card.unresolved_requirements.length > 0,
  );
  assert.ok(
    card.collection.setup.length > 0 && card.collection.reset.length > 0,
  );
  assert.ok(card.claims.length > 0 && card.sources.length > 0);
  const detail = await taskDetail(
    hotDog.task.id,
    contextForReady(hotDog, { available_objects: mustard.id }),
  );
  const detailSources = new Set(detail.evidence.map((source) => source.id));
  assert.ok(
    detail.claims.every((claim) =>
      (claim.source_ids || []).every((sourceId) => detailSources.has(sourceId)),
    ),
    "task detail must resolve claim source_ids",
  );
});

test("graph traversal is bidirectional and lenses filter typed relationships", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const objectGraph = json(
    await request(
      `/api/nodes/${encodeURIComponent(mustard.id)}/neighbors?lens=all`,
    ),
  ).data;
  const concept = objectGraph.nodes.find((node) =>
    /objectclass|concept/i.test(node.node_type),
  );
  let affordance = objectGraph.nodes.find((node) =>
    /affordance/i.test(node.node_type),
  );
  if (!affordance) {
    const group = objectGraph.nodes.find(
      (node) => node.group_key === "affordances",
    );
    assert.ok(
      group,
      "an object graph must expose an affordance node or its expandable affordance group",
    );
    const expanded = json(
      await request(
        `/api/nodes/${encodeURIComponent(group.id)}/neighbors?lens=all`,
      ),
    ).data;
    affordance = expanded.nodes.find((node) =>
      /affordance/i.test(node.node_type),
    );
  }
  assert.ok(concept && affordance);
  const reverseConceptResponse = await request(
    `/api/nodes/${encodeURIComponent(concept.id)}/neighbors?lens=all`,
  );
  const reverseAffordanceResponse = await request(
    `/api/nodes/${encodeURIComponent(affordance.id)}/neighbors?lens=all`,
  );
  assert.equal(
    reverseConceptResponse.status,
    200,
    "object concepts must support reverse traversal",
  );
  assert.equal(
    reverseAffordanceResponse.status,
    200,
    "affordances must support reverse traversal",
  );
  const reverseConcept = json(reverseConceptResponse).data;
  const reverseAffordance = json(reverseAffordanceResponse).data;
  assert.ok(reverseConcept.nodes.some((node) => node.id === mustard.id));
  assert.ok(reverseAffordance.nodes.some((node) => node.id === mustard.id));
  const details = await detailsForObject(mustard.id);
  const task =
    details.find((detail) => (detail.procedures || []).length > 0) ||
    details[0];
  const contextGraph = json(
    await request(
      `/api/nodes/${encodeURIComponent(task.scene.id)}/neighbors?lens=context`,
    ),
  ).data;
  assert.ok(contextGraph.nodes.some((node) => node.id === task.task.id));
  const all = json(
    await request(
      `/api/nodes/${encodeURIComponent(task.task.id)}/neighbors?lens=all`,
    ),
  ).data;
  for (const lens of ["context", "goals", "execution"]) {
    const graph = json(
      await request(
        `/api/nodes/${encodeURIComponent(task.task.id)}/neighbors?lens=${lens}`,
      ),
    ).data;
    assert.ok(
      graph.edges.length <= all.edges.length,
      `${lens} is a filtered view over the same graph`,
    );
    assert.ok(
      graph.edges.every((edge) =>
        all.edges.some((candidate) => candidate.id === edge.id),
      ),
    );
  }
});

test("graph nodes are navigable, unknown graph identities fail, and groups/entities honor lenses", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const details = await detailsForObject(mustard.id);
  const task =
    details.find((detail) => (detail.procedures || []).length > 0) ||
    details[0];
  const taskGraphResponse = await request(
    `/api/nodes/${encodeURIComponent(task.task.id)}/neighbors?lens=all`,
  );
  assert.equal(taskGraphResponse.status, 200);
  const taskGraph = json(taskGraphResponse).data;
  assert.ok(
    taskGraph.nodes.some((node) => /tasktemplate/i.test(node.node_type)),
    "all lens includes the task template",
  );
  assert.ok(
    taskGraph.nodes.some((node) => /procedure/i.test(node.node_type)),
    "all lens includes proposed procedures",
  );
  assert.ok(
    taskGraph.nodes.some((node) => /claim/i.test(node.node_type)),
    "all lens includes claims",
  );
  assert.ok(
    taskGraph.nodes.some((node) => /evidence|source/i.test(node.node_type)),
    "all lens includes resolved sources",
  );
  for (const node of taskGraph.nodes) {
    const response = await request(
      `/api/nodes/${encodeURIComponent(node.id)}/neighbors?lens=all`,
    );
    assert.equal(
      response.status,
      200,
      `emitted ${node.node_type} node ${node.id} must be navigable`,
    );
  }

  assert.equal(
    (
      await request(
        "/api/nodes/concept:not_a_catalog_concept/neighbors?lens=all",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/api/nodes/affordance:not_a_catalog_affordance/neighbors?lens=all",
      )
    ).status,
    404,
  );

  const objectGraph = json(
    await request(
      `/api/nodes/${encodeURIComponent(mustard.id)}/neighbors?lens=all`,
    ),
  ).data;
  const taskGroup = objectGraph.nodes.find(
    (node) => node.group_key === "tasks",
  );
  assert.ok(taskGroup);
  const groupAll = json(
    await request(
      `/api/nodes/${encodeURIComponent(taskGroup.id)}/neighbors?lens=all`,
    ),
  ).data;
  const groupContext = json(
    await request(
      `/api/nodes/${encodeURIComponent(taskGroup.id)}/neighbors?lens=context`,
    ),
  ).data;
  assert.ok(
    groupContext.nodes.length < groupAll.nodes.length,
    "context lens must not emit task-group execution/goal children",
  );

  const entityAll = json(
    await request(
      `/api/nodes/${encodeURIComponent(task.scene.id)}/neighbors?lens=all`,
    ),
  ).data;
  const entityExecution = json(
    await request(
      `/api/nodes/${encodeURIComponent(task.scene.id)}/neighbors?lens=execution`,
    ),
  ).data;
  assert.ok(
    entityExecution.nodes.length < entityAll.nodes.length,
    "entity neighborhoods must respect the active lens",
  );
});

test("ready generation never substitutes unknown proposals, and explicit blockers apply across tasks", async () => {
  const mustard = json(await request("/api/objects?q=mustard")).data.find(
    (object) => /mustard/i.test(textOf(object)),
  );
  const seededReady = json(
    await request(
      pathWithQuery("/api/tasks/generate", [
        ["object_id", mustard.id],
        ["mode", "ready"],
      ]),
    ),
  ).data;
  assert.equal(seededReady.mode, "seeded_instances");
  assert.deepEqual(seededReady.candidates, []);

  const cracker = json(await request("/api/objects?q=cracker")).data.find(
    (object) => /cracker/i.test(textOf(object)),
  );
  const unannotatedReady = json(
    await request(
      pathWithQuery("/api/tasks/generate", [
        ["object_id", cracker.id],
        ["mode", "ready"],
      ]),
    ),
  ).data;
  assert.deepEqual(unannotatedReady.candidates, []);

  const blocker = json(await request("/api/context-options")).data
    .blocked_conditions[0];
  assert.ok(blocker);
  const detail = (await detailsForObject(mustard.id))[0];
  const blocked = await taskDetail(
    detail.task.id,
    contextForReady(detail, { blocked_conditions: blocker.id }),
  );
  assert.equal(assessmentOf(blocked).status, "blocked");
  assert.ok(assessmentOf(blocked).safety_blockers.includes(blocker.id));
});

test("chosen procedure alternatives cannot weaken task-level OR groups", async () => {
  const plan = store.data.planning.find((candidate) =>
    candidate.requirements.some(
      (requirement) => requirement.key === "contents",
    ),
  );
  assert.ok(plan);
  const original = JSON.parse(JSON.stringify(plan));
  const contents = plan.requirements.find(
    (requirement) => requirement.key === "contents",
  );
  const alternative = contents.value === "full" ? "empty" : "full";
  const procedureId = `${plan.id}_test_contents_alternative`;
  try {
    plan.procedures.push({
      id: procedureId,
      label: "Synthetic conflicting contents alternative",
      steps: [],
      requirements: [
        {
          key: "contents",
          value: alternative,
          reason: "Synthetic procedure precondition for regression coverage.",
        },
      ],
      review_status: "proposed",
    });
    const base = await taskDetail(plan.task_id);
    const cardResponse = await request(
      pathWithQuery(
        `/api/tasks/${encodeURIComponent(plan.task_id)}/collection-card`,
        [
          ...contextForReady(base, { contents: alternative }),
          ["procedure_id", procedureId],
        ],
      ),
    );
    assert.equal(cardResponse.status, 200);
    const card = json(cardResponse).data;
    assert.notEqual(card.assessment.status, "ready");
    assert.notEqual(card.chosen_procedure.assessment.status, "ready");
  } finally {
    Object.assign(plan, original);
  }
});

test("generated rigid cracker-box proposals do not invent liquid-handling tasks", async () => {
  const cracker = json(await request("/api/objects?q=cracker")).data.find(
    (object) => /cracker/i.test(textOf(object)),
  );
  assert.ok(cracker);
  const generated = json(
    await request(
      pathWithQuery("/api/tasks/generate", [["object_id", cracker.id]]),
    ),
  ).data;
  assert.ok(generated.candidates.length > 0);
  assert.ok(
    generated.candidates.every(
      (candidate) =>
        !/(dispens|squeez|pour|liquid|material flow)/.test(textOf(candidate)),
    ),
  );
});

test("API and exports keep claims unranked and evidence claim-specific", async () => {
  const taskExport = json(await request("/api/export/tasks.json"));
  const csv = await request("/api/export/tasks.csv");
  assert.equal(csv.status, 200);
  assert.match(
    csv.headers["content-disposition"],
    /physical-ai-task-atlas-tasks\.csv/,
  );
  assert.doesNotMatch(csv.body, /score|evidence_level|\bgrade\b/i);
  function assertNoObsoleteFields(value) {
    if (Array.isArray(value)) return value.forEach(assertNoObsoleteFields);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        !["scores", "score", "rank", "evidence_level", "grade"].includes(key),
        `obsolete field ${key} must not be exposed`,
      );
      assertNoObsoleteFields(child);
    }
  }
  assertNoObsoleteFields(taskExport);
  assert.ok(taskExport.data.length > 0);
  for (const collection of ["planning", "claims", "sources"])
    assert.ok(
      Array.isArray(taskExport[collection]),
      `JSON export includes ${collection}`,
    );
  const sourceIds = new Set(taskExport.sources.map((source) => source.id));
  assert.ok(
    taskExport.claims.every((claim) =>
      claim.source_ids.every((sourceId) => sourceIds.has(sourceId)),
    ),
  );

  const [header, ...rows] = csv.body.trim().split("\n");
  const columns = header.split(",");
  const statusIndex = columns.indexOf("frequency_status");
  const valueIndex = columns.indexOf("frequency_value");
  assert.ok(
    statusIndex >= 0 && valueIndex >= 0,
    "CSV distinguishes frequency status from its value",
  );
  const parseCsv = (row) =>
    [...row.matchAll(/"((?:[^"]|"")*)"(?=,|$)/g)].map((match) =>
      match[1].replaceAll('""', '"'),
    );
  assert.ok(
    rows
      .map(parseCsv)
      .some((row) => row[statusIndex] === "unknown" && row[valueIndex] === ""),
    "unknown frequency exports a blank value",
  );
});

test("seed validator rejects schema, graph-reference, claim, and measurement mutations", () => {
  const cloneData = () => JSON.parse(JSON.stringify(defaultData()));
  const isInvalid = (data) => !validateData(data).valid;
  assert.equal(
    validateData(cloneData()).valid,
    true,
    "baseline seeds must validate",
  );

  const obsoleteScore = cloneData();
  obsoleteScore.tasks[0].scores = { invented: 0.8 };
  assert.ok(
    validateData(obsoleteScore).errors.some((error) =>
      /obsolete scores/.test(error),
    ),
  );

  const rawCondition = cloneData();
  rawCondition.planning[0].requirements.find(
    (requirement) => requirement.key === "condition",
  ).value = "closed(refrigerator)";
  assert.ok(
    validateData(rawCondition).errors.some((error) =>
      /condition requirement must be snake_case/.test(error),
    ),
  );

  const unsupportedSource = cloneData();
  const sourcedClaim = unsupportedSource.claims.find(
    (claim) => claim.source_ids.length > 0,
  );
  const source = unsupportedSource.evidence.find(
    (item) => item.id === sourcedClaim.source_ids[0],
  );
  source.supported_claim_types = [];
  assert.ok(
    validateData(unsupportedSource).errors.some((error) =>
      /cannot support/.test(error),
    ),
  );

  const fabricatedUnknown = cloneData();
  const unknownClaim = fabricatedUnknown.claims.find(
    (claim) => claim.status === "unknown",
  );
  unknownClaim.value = 1;
  assert.ok(
    validateData(fabricatedUnknown).errors.some((error) =>
      /unknown claims require null value\/unit and no sources/.test(error),
    ),
  );

  const sourcedUnknown = cloneData();
  const unknownWithSource = sourcedUnknown.claims.find(
    (claim) => claim.status === "unknown",
  );
  unknownWithSource.source_ids = [sourcedUnknown.evidence[0].id];
  assert.ok(
    isInvalid(sourcedUnknown),
    "unknown claims cannot carry a source as if it established a value",
  );

  const missingPlan = cloneData();
  missingPlan.planning.splice(0, 1);
  assert.ok(
    isInvalid(missingPlan),
    "every seeded task needs one planning record",
  );

  const orphanClaim = cloneData();
  orphanClaim.claims[0].subject_id = "task_orphaned_from_catalog";
  assert.ok(
    isInvalid(orphanClaim),
    "claim subjects must resolve to a task or catalog object",
  );

  const invalidScene = cloneData();
  invalidScene.planning
    .flatMap((plan) => plan.requirements)
    .find((requirement) => requirement.key === "scene_id").value =
    "scene_not_in_catalog";
  assert.ok(
    isInvalid(invalidScene),
    "scene requirements must resolve to seeded scenes",
  );

  const invalidRole = cloneData();
  invalidRole.planning
    .flatMap((plan) => plan.requirements)
    .find((requirement) => requirement.key === "role").value =
    "unrecognized_role";
  assert.ok(
    isInvalid(invalidRole),
    "role requirements must use the declared role vocabulary",
  );

  const invalidCapability = cloneData();
  invalidCapability.planning
    .flatMap((plan) => plan.requirements)
    .find((requirement) => requirement.key === "capability").value =
    "imaginary_capability";
  assert.ok(
    isInvalid(invalidCapability),
    "capability requirements must use the declared capability vocabulary",
  );

  const duplicateProcedure = cloneData();
  const multiProcedurePlan = duplicateProcedure.planning.find(
    (plan) => plan.procedures.length >= 2,
  );
  multiProcedurePlan.procedures[1].id = multiProcedurePlan.procedures[0].id;
  assert.ok(
    isInvalid(duplicateProcedure),
    "procedure IDs must be unique within a planning record",
  );

  const unsupportedScope = cloneData();
  const suitabilityClaim = unsupportedScope.claims.find(
    (claim) => claim.claim_type === "task_suitability",
  );
  const catalogSource = unsupportedScope.evidence.find(
    (source) => source.source_type === "catalog",
  );
  catalogSource.supported_claim_types = [
    "catalog_identity",
    "task_suitability",
  ];
  suitabilityClaim.source_ids = [catalogSource.id];
  assert.ok(
    isInvalid(unsupportedScope),
    "a catalog-scoped source cannot be promoted to task-suitability support by editing its declared type",
  );

  const measuredTooEarly = cloneData();
  measuredTooEarly.planning[0].collection.time_estimates.setup_minutes = 3;
  assert.ok(
    validateData(measuredTooEarly).errors.some((error) =>
      /setup_minutes must be null until measured/.test(error),
    ),
  );
});

test("unknown identities, malformed URL encoding, and unsupported enums are client errors", async () => {
  assert.equal((await request("/api/tasks/not-a-task")).status, 404);
  assert.equal(
    (await request("/api/nodes/not-a-node/neighbors?lens=all")).status,
    404,
  );
  assert.equal((await request("/api/tasks?contents=banana")).status, 400);
  assert.equal((await request("/api/tasks?role=astronaut")).status, 400);
  assert.equal((await request("/api/tasks?profile=imaginary")).status, 400);
  assert.equal((await request("/api/tasks?mode=ranked")).status, 400);
  assert.equal(
    (await request("/api/nodes/not-a-node/neighbors?lens=everything")).status,
    400,
  );
  assert.equal((await request("/api/tasks/%E0%A4%A")).status, 400);
});
