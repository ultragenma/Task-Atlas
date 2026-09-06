const fs = require("node:fs");
const path = require("node:path");
const {
  STATUS_ORDER,
  assessRequirements,
  mergeAssessments,
  deriveOptions,
} = require("./assessment");

const ROOT = path.resolve(__dirname, "..", "..");
const SEED_DIR = path.join(ROOT, "data", "seeds");
const SEED_FILES = Object.freeze({
  objects: "objects.json",
  scenes: "scenes.json",
  states: "states.json",
  intents: "intents.json",
  skills: "skills.json",
  taskTemplates: "task_templates.json",
  tasks: "mustard_tasks.json",
  evidence: "evidence.json",
  planning: "task_planning.json",
  claims: "claims.json",
});

function readSeed(filename, fallback = []) {
  const file = path.join(SEED_DIR, filename);
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : fallback;
}
function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}
function asMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}
function compareText(left, right) {
  return String(left).localeCompare(String(right), "en", {
    sensitivity: "base",
  });
}
function unique(items) {
  return [...new Set(items)];
}
function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function nodeFromRecord(record, extra = {}) {
  if (!record) return null;
  const label =
    record.name_en || record.canonical_name || record.statement || record.id;
  return {
    id: record.id,
    node_type: record.node_type || extra.node_type || "Node",
    label,
    name_en: label,
    name_ja: record.name_ja || label,
    ...extra,
  };
}
function addNode(nodes, node) {
  if (node && !nodes.some((existing) => existing.id === node.id))
    nodes.push(node);
}
function addEdge(edges, source, target, relation) {
  if (!source || !target || source === target) return;
  const id = `${source}|${relation}|${target}`;
  if (!edges.some((edge) => edge.id === id))
    edges.push({ id, source, target, relation });
}

function createStore() {
  const data = Object.fromEntries(
    Object.entries(SEED_FILES).map(([key, filename]) => [
      key,
      readSeed(filename),
    ]),
  );
  const maps = {
    objects: asMap(data.objects),
    scenes: asMap(data.scenes),
    states: asMap(data.states),
    intents: asMap(data.intents),
    skills: asMap(data.skills),
    taskTemplates: asMap(data.taskTemplates),
    tasks: asMap(data.tasks),
    evidence: asMap(data.evidence),
    planning: asMap(data.planning),
    claims: asMap(data.claims),
  };
  const planningFor = (id) =>
    maps.planning.get(id) ||
    data.planning.find((item) => item.task_id === id) ||
    null;
  const procedureId = (taskId, procedure) =>
    `procedure:${taskId}:${procedure.id}`;
  const claimsFor = (id) =>
    data.claims.filter((item) => item.subject_id === id);
  const sourcesFor = (claims) =>
    unique(claims.flatMap((item) => item.source_ids || []))
      .map((id) => maps.evidence.get(id))
      .filter(Boolean);
  const requirementSet = (task, planning) =>
    planning
      ? planning.requirements || []
      : [
          {
            key: "condition",
            value: "planning_reviewed",
            reason:
              "Planning requirements have not been reviewed for this task.",
          },
        ];
  const assessmentFor = (task, context, extra = []) =>
    mergeAssessments(
      assessRequirements(requirementSet(task, planningFor(task.id)), context),
      extra.length
        ? assessRequirements(extra, context)
        : {
            status: "ready",
            reasons: [],
            missing_objects: [],
            unverified_conditions: [],
            capability_gaps: [],
            safety_blockers: [],
            execution_status: "unverified",
          },
    );

  function taskSummary(task, context) {
    return {
      id: task.id,
      node_type: task.node_type,
      name_en: task.name_en,
      name_ja: task.name_ja,
      template_id: task.template_id,
      object_id: task.object_id,
      scene_id: task.scene_id,
      scene_name_en: maps.scenes.get(task.scene_id)?.name_en || task.scene_id,
      intent_id: task.intent_id,
      intent_name_en:
        maps.intents.get(task.intent_id)?.name_en || task.intent_id,
      review_status: task.review_status,
      state_ids: task.state_ids || [],
      skills: task.skills || [],
      assessment: assessmentFor(task, context),
    };
  }
  function listObjects(query = "") {
    const needle = String(query).trim().toLowerCase();
    return data.objects
      .filter(
        (object) =>
          !needle ||
          [
            object.id,
            object.ycb_id,
            object.canonical_name,
            object.name_en,
            object.name_ja,
            object.category,
            ...(object.tags || []),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle)),
      )
      .sort((a, b) => compareText(a.ycb_id, b.ycb_id));
  }
  function getObject(id) {
    return maps.objects.get(id) || null;
  }
  function getTask(id) {
    return maps.tasks.get(id) || null;
  }
  function listTasks(filters = {}, context) {
    const needle = String(filters.q || "")
      .trim()
      .toLowerCase();
    return data.tasks
      .filter(
        (task) =>
          (!filters.object_id || task.object_id === filters.object_id) &&
          (!filters.intent_id || task.intent_id === filters.intent_id) &&
          (!filters.skill_id ||
            (task.skills || []).includes(filters.skill_id)) &&
          (!needle ||
            [
              task.id,
              task.name_en,
              task.name_ja,
              task.template_id,
              task.intent_id,
              task.scene_id,
            ]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle))),
      )
      .map((task) => taskSummary(task, context))
      .filter(
        (task) =>
          context.mode !== "ready" || task.assessment.status === "ready",
      )
      .sort(
        (a, b) =>
          STATUS_ORDER[a.assessment.status] -
            STATUS_ORDER[b.assessment.status] ||
          compareText(a.name_en || a.id, b.name_en || b.id),
      );
  }
  function getObjectDetail(id, context) {
    const object = getObject(id);
    if (!object) return null;
    const related = listTasks({ object_id: id }, context);
    const concepts = data.objects.filter(
      (candidate) => candidate.general_concept_id === object.general_concept_id,
    );
    return {
      object: clone(object),
      related_tasks: related,
      related_task_count: related.length,
      general_concept: {
        id: object.general_concept_id,
        name_en: titleCase(object.general_concept_id.replace(/^object_/, "")),
        related_object_count: concepts.length,
      },
    };
  }
  function procedureDetail(task, procedure, context) {
    return {
      ...clone(procedure),
      assessment: assessmentFor(task, context, procedure.requirements || []),
    };
  }
  function getTaskDetail(id, context) {
    const task = getTask(id);
    if (!task) return null;
    const planning = planningFor(id);
    const claims = claimsFor(id);
    return {
      task: clone(task),
      template: clone(maps.taskTemplates.get(task.template_id)),
      object: clone(maps.objects.get(task.object_id)),
      scene: clone(maps.scenes.get(task.scene_id)),
      intent: clone(maps.intents.get(task.intent_id)),
      states: (task.state_ids || [])
        .map((item) => maps.states.get(item))
        .filter(Boolean)
        .map(clone),
      skills: (task.skills || [])
        .map((item) => maps.skills.get(item))
        .filter(Boolean)
        .map(clone),
      evidence: sourcesFor(claims).map(clone),
      planning: clone(planning),
      claims: clone(claims),
      assessment: assessmentFor(task, context),
      procedures: (planning?.procedures || []).map((item) =>
        procedureDetail(task, item, context),
      ),
    };
  }
  function serializedContext(context) {
    return {
      scene_id: context.scene_id,
      contents: context.contents,
      role: context.role,
      profile: context.profile,
      available_objects: context.available_objects,
      capabilities: context.capabilities,
      confirmed_conditions: context.confirmed_conditions,
      blocked_conditions: context.blocked_conditions,
    };
  }
  function collectionCard(taskId, context, procedureId) {
    const task = getTask(taskId);
    if (!task) return { error: "not_found" };
    const planning = planningFor(taskId);
    if (!planning)
      return {
        error: "incomplete",
        message:
          "This task has no reviewed planning record and cannot be exported as a collection card.",
      };
    const procedures = planning.procedures || [];
    const chosen = procedureId
      ? procedures.find((item) => item.id === procedureId)
      : null;
    if (procedureId && !chosen)
      return {
        error: "invalid_procedure",
        message: "procedure_id does not belong to this task.",
      };
    const claims = claimsFor(taskId);
    const assessment = assessmentFor(task, context, chosen?.requirements || []);
    const procedureRequirements = chosen?.requirements || [];
    const requiredResources = [
      ...(planning.requirements || []),
      ...procedureRequirements,
    ]
      .filter((item) => item.key === "object")
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.value === item.value) ===
          index,
      );
    return {
      schema_version: "0.2",
      task: {
        id: task.id,
        name_en: task.name_en,
        name_ja: task.name_ja,
        template_id: task.template_id,
        object_id: task.object_id,
      },
      context: serializedContext(context),
      initial_state: clone(task.initial_state || []),
      goal_state: clone(task.goal_state || []),
      required_resources: requiredResources,
      assessment,
      chosen_procedure: chosen ? procedureDetail(task, chosen, context) : null,
      alternative_procedures: procedures
        .filter((item) => item.id !== procedureId)
        .map((item) => procedureDetail(task, item, context)),
      collection: clone(planning.collection || {}),
      claims: clone(claims),
      sources: sourcesFor(claims).map(clone),
      unresolved_requirements: assessment.reasons.filter(
        (item) => item.kind !== "satisfied",
      ),
      provenance: {
        task_seed: "mustard_tasks.json",
        planning_seed: "task_planning.json",
        claims_seed: "claims.json",
      },
      execution_caveat:
        "A ready planning assessment is not evidence that a robot or simulator has completed the task.",
    };
  }
  function groupDefinitions(objectId) {
    const object = getObject(objectId);
    if (!object) return [];
    const related = data.tasks.filter((item) => item.object_id === objectId);
    return [
      {
        key: "affordances",
        label: "Affordance",
        count: (object.affordances || []).length,
      },
      {
        key: "states",
        label: "State",
        count: unique(related.flatMap((item) => item.state_ids || [])).length,
      },
      {
        key: "scenes",
        label: "Scene",
        count: unique(related.map((item) => item.scene_id)).length,
      },
      {
        key: "intents",
        label: "Intent",
        count: unique(related.map((item) => item.intent_id)).length,
      },
      { key: "tasks", label: "Task", count: related.length },
      {
        key: "skills",
        label: "Skill",
        count: unique(related.flatMap((item) => item.skills || [])).length,
      },
    ];
  }
  function groupNode(objectId, definition) {
    return {
      id: `group:${objectId}:${definition.key}`,
      node_type: "Group",
      label: `${definition.label} · ${definition.count}`,
      name_en: definition.label,
      name_ja: definition.label,
      group_key: definition.key,
      object_id: objectId,
      count: definition.count,
      expandable: definition.count > 0,
    };
  }
  function objectNeighborhood(objectId, lens = "all") {
    const object = getObject(objectId);
    if (!object) return null;
    const nodes = [nodeFromRecord(object, { selected: true })];
    const edges = [];
    if (object.general_concept_id) {
      const concept = {
        id: `concept:${object.general_concept_id}`,
        node_type: "ObjectClass",
        label: titleCase(object.general_concept_id.replace(/^object_/, "")),
        name_en: titleCase(object.general_concept_id.replace(/^object_/, "")),
      };
      addNode(nodes, concept);
      addEdge(edges, object.id, concept.id, "instance_of");
    }
    const allowed =
      lens === "context"
        ? ["affordances", "states", "scenes"]
        : lens === "goals"
          ? ["intents", "tasks"]
          : lens === "execution"
            ? ["skills", "tasks"]
            : ["affordances", "states", "scenes", "intents", "tasks", "skills"];
    for (const definition of groupDefinitions(objectId).filter((item) =>
      allowed.includes(item.key),
    )) {
      const group = groupNode(objectId, definition);
      addNode(nodes, group);
      addEdge(edges, object.id, group.id, "explore");
    }
    return { center_id: objectId, lens, nodes, edges, expanded: [] };
  }
  function groupChildren(objectId, key, context, lens = "all") {
    const object = getObject(objectId);
    if (!object) return null;
    const definition = groupDefinitions(objectId).find(
      (item) => item.key === key,
    );
    if (!definition) return null;
    const group = groupNode(objectId, definition);
    const nodes = [group];
    const edges = [];
    const related = data.tasks.filter((item) => item.object_id === objectId);
    const category = ["affordances", "states", "scenes"].includes(key)
      ? "context"
      : key === "skills"
        ? "execution"
        : "goals";
    if (lens !== "all" && lens !== category)
      return { center_id: group.id, lens, nodes, edges, expanded: [group.id] };
    const ids =
      key === "affordances"
        ? object.affordances || []
        : key === "states"
          ? unique(related.flatMap((item) => item.state_ids || []))
          : key === "scenes"
            ? unique(related.map((item) => item.scene_id))
            : key === "intents"
              ? unique(related.map((item) => item.intent_id))
              : key === "tasks"
                ? related.map((item) => item.id)
                : unique(related.flatMap((item) => item.skills || []));
    for (const id of ids) {
      const child =
        key === "affordances"
          ? {
              id: `affordance:${id}`,
              node_type: "Affordance",
              label: titleCase(id),
              name_en: titleCase(id),
            }
          : key === "tasks"
            ? nodeFromRecord(
                maps.tasks.get(id),
                taskSummary(maps.tasks.get(id), context),
              )
            : nodeFromRecord(
                maps[
                  {
                    states: "states",
                    scenes: "scenes",
                    intents: "intents",
                    skills: "skills",
                  }[key]
                ].get(id),
              );
      addNode(nodes, child);
      addEdge(edges, group.id, child?.id, "contains");
    }
    return { center_id: group.id, lens, nodes, edges, expanded: [group.id] };
  }
  function taskNeighborhood(taskId, lens = "all", context) {
    const task = getTask(taskId);
    if (!task) return null;
    const nodes = [
      nodeFromRecord(task, { ...taskSummary(task, context), selected: true }),
    ];
    const edges = [];
    const related = [
      [
        "template",
        maps.taskTemplates.get(task.template_id),
        "uses_template",
        "goals",
      ],
      ["object", maps.objects.get(task.object_id), "acts_on", "context"],
      [
        "scene",
        maps.scenes.get(task.scene_id),
        "compatible_with_scene",
        "context",
      ],
      ["intent", maps.intents.get(task.intent_id), "serves_intent", "goals"],
    ];
    for (const [, record, relation, category] of related)
      if (lens === "all" || lens === category) {
        addNode(nodes, nodeFromRecord(record));
        addEdge(edges, task.id, record?.id, relation);
      }
    if (lens === "all" || lens === "execution")
      for (const skillId of task.skills || []) {
        addNode(nodes, nodeFromRecord(maps.skills.get(skillId)));
        addEdge(edges, task.id, skillId, "may_use");
      }
    if (lens === "all" || lens === "execution") {
      for (const procedure of planningFor(task.id)?.procedures || []) {
        const procedureNode = {
          id: procedureId(task.id, procedure),
          node_type: "Procedure",
          label: procedure.label,
          name_en: procedure.label,
          review_status: procedure.review_status,
        };
        addNode(nodes, procedureNode);
        addEdge(edges, task.id, procedureNode.id, "has_procedure");
        for (const step of procedure.steps || []) {
          addNode(nodes, nodeFromRecord(maps.skills.get(step.skill_id)));
          addEdge(edges, procedureNode.id, step.skill_id, "uses_skill");
        }
      }
    }
    if (lens === "all" || lens === "context")
      for (const stateId of task.state_ids || []) {
        addNode(nodes, nodeFromRecord(maps.states.get(stateId)));
        addEdge(edges, task.id, stateId, "context_state");
      }
    if (lens === "all" || lens === "goals")
      for (const claim of claimsFor(task.id)) {
        addNode(nodes, nodeFromRecord(claim, { node_type: "Claim" }));
        addEdge(edges, task.id, claim.id, "has_claim");
        for (const sourceId of claim.source_ids || []) {
          addNode(
            nodes,
            nodeFromRecord(maps.evidence.get(sourceId), {
              node_type: "Evidence",
            }),
          );
          addEdge(edges, claim.id, sourceId, "supported_by");
        }
      }
    return { center_id: taskId, lens, nodes, edges, expanded: [] };
  }
  function entityNeighborhood(nodeId, lens, context) {
    const record = [
      maps.scenes,
      maps.states,
      maps.intents,
      maps.skills,
      maps.evidence,
      maps.claims,
      maps.taskTemplates,
    ]
      .map((map) => map.get(nodeId))
      .find(Boolean);
    if (!record) {
      const match = /^concept:(.+)$/.exec(nodeId);
      if (
        !match ||
        !data.objects.some((item) => item.general_concept_id === match[1])
      )
        return null;
      const nodes = [
        {
          id: nodeId,
          node_type: "ObjectClass",
          label: titleCase(match[1].replace(/^object_/, "")),
          selected: true,
        },
      ];
      const edges = [];
      for (const object of data.objects.filter(
        (item) => item.general_concept_id === match[1],
      )) {
        addNode(nodes, nodeFromRecord(object));
        addEdge(edges, object.id, nodeId, "instance_of");
      }
      return { center_id: nodeId, lens, nodes, edges, expanded: [] };
    }
    const category = maps.skills.has(nodeId)
      ? "execution"
      : maps.intents.has(nodeId) ||
          maps.evidence.has(nodeId) ||
          maps.claims.has(nodeId) ||
          maps.taskTemplates.has(nodeId)
        ? "goals"
        : "context";
    const center = nodeFromRecord(record, { selected: true });
    if (lens !== "all" && lens !== category)
      return {
        center_id: nodeId,
        lens,
        nodes: [center],
        edges: [],
        expanded: [],
      };
    const tasks = data.tasks.filter(
      (task) =>
        task.template_id === nodeId ||
        task.scene_id === nodeId ||
        task.intent_id === nodeId ||
        (task.state_ids || []).includes(nodeId) ||
        (task.skills || []).includes(nodeId) ||
        claimsFor(task.id).some((claim) => claim.id === nodeId),
    );
    const nodes = [center];
    const edges = [];
    for (const task of tasks) {
      addNode(nodes, nodeFromRecord(task, taskSummary(task, context)));
      addEdge(edges, nodeId, task.id, "participates_in");
    }
    if (maps.claims.has(nodeId))
      for (const sourceId of record.source_ids || []) {
        addNode(
          nodes,
          nodeFromRecord(maps.evidence.get(sourceId), {
            node_type: "Evidence",
          }),
        );
        addEdge(edges, nodeId, sourceId, "supported_by");
      }
    if (maps.evidence.has(nodeId))
      for (const claim of data.claims.filter((item) =>
        (item.source_ids || []).includes(nodeId),
      )) {
        addNode(nodes, nodeFromRecord(claim, { node_type: "Claim" }));
        addEdge(edges, claim.id, nodeId, "supported_by");
        const task = getTask(claim.subject_id);
        if (task) {
          addNode(nodes, nodeFromRecord(task, taskSummary(task, context)));
          addEdge(edges, task.id, claim.id, "has_claim");
        }
      }
    return { center_id: nodeId, lens, nodes, edges, expanded: [] };
  }
  function affordanceNeighborhood(nodeId, lens) {
    const affordance = /^affordance:(.+)$/.exec(nodeId);
    if (!affordance) return null;
    const affordanceId = affordance[1];
    if (
      !data.objects.some((item) =>
        (item.affordances || []).includes(affordanceId),
      )
    )
      return null;
    const nodes = [
      {
        id: nodeId,
        node_type: "Affordance",
        label: titleCase(affordanceId),
        name_en: titleCase(affordanceId),
        selected: true,
      },
    ];
    const edges = [];
    for (const object of data.objects.filter((item) =>
      (item.affordances || []).includes(affordanceId),
    )) {
      addNode(nodes, nodeFromRecord(object));
      addEdge(edges, object.id, nodeId, "has_affordance");
    }
    return { center_id: nodeId, lens, nodes, edges, expanded: [] };
  }
  function procedureNeighborhood(nodeId, lens, context) {
    const match = /^procedure:([^:]+):(.+)$/.exec(nodeId);
    if (!match) return null;
    const task = getTask(match[1]);
    const procedure = planningFor(match[1])?.procedures?.find(
      (item) => item.id === match[2],
    );
    if (!task || !procedure) return null;
    const nodes = [
      {
        id: nodeId,
        node_type: "Procedure",
        label: procedure.label,
        name_en: procedure.label,
        selected: true,
      },
      nodeFromRecord(task, taskSummary(task, context)),
    ];
    const edges = [];
    addEdge(edges, task.id, nodeId, "has_procedure");
    if (lens === "all" || lens === "execution")
      for (const step of procedure.steps || []) {
        addNode(nodes, nodeFromRecord(maps.skills.get(step.skill_id)));
        addEdge(edges, nodeId, step.skill_id, "uses_skill");
      }
    return { center_id: nodeId, lens, nodes, edges, expanded: [] };
  }
  function neighbors(nodeId, lens, context) {
    if (maps.objects.has(nodeId)) return objectNeighborhood(nodeId, lens);
    if (maps.tasks.has(nodeId)) return taskNeighborhood(nodeId, lens, context);
    const group =
      /^group:([^:]+):(affordances|states|scenes|intents|tasks|skills)$/.exec(
        nodeId,
      );
    if (group) return groupChildren(group[1], group[2], context, lens);
    return (
      procedureNeighborhood(nodeId, lens, context) ||
      affordanceNeighborhood(nodeId, lens) ||
      entityNeighborhood(nodeId, lens, context)
    );
  }
  function generateTasks(objectId, sceneId, context) {
    const object = getObject(objectId);
    if (!object) return null;
    const hasSeededInstances = data.tasks.some(
      (task) => task.object_id === objectId,
    );
    if (hasSeededInstances)
      return {
        mode: "seeded_instances",
        object_id: objectId,
        scene_id: sceneId || null,
        candidates: listTasks({ object_id: objectId }, context),
      };
    const rigidSkills = new Set([
      "skill_locate",
      "skill_approach",
      "skill_grasp",
      "skill_lift",
      "skill_reach",
      "skill_navigate_or_reach",
      "skill_place",
      "skill_release",
      "skill_orient",
      "skill_verify",
      "skill_align",
    ]);
    const templates = data.taskTemplates.filter(
      (template) =>
        (!sceneId || (template.compatible_scenes || []).includes(sceneId)) &&
        (object.affordances || []).includes("graspable") &&
        (object.affordances || []).includes("placeable") &&
        (template.skills || []).every((skill) => rigidSkills.has(skill)),
    );
    const candidates = templates.map((template) => ({
      id: `proposal_${template.id}_${objectId}`,
      node_type: "TaskInstance",
      name_en: `${template.name_en} · ${object.name_en || object.canonical_name}`,
      name_ja: `${object.name_ja}：${template.name_ja}`,
      template_id: template.id,
      object_id: objectId,
      scene_id: sceneId || template.compatible_scenes?.[0] || null,
      bindings: { theme: objectId },
      initial_state: [],
      goal_state: [],
      skills: template.skills || [],
      review_status: "proposed",
      generated: true,
      generation_note:
        "Incomplete template proposal. Role bindings, context, conditions, claim links, and collection planning require review.",
      assessment: {
        status: "unknown",
        reasons: [
          {
            kind: "unknown",
            key: "planning",
            value: "unreviewed",
            message:
              "Generated proposals require review before they can become collection tasks.",
          },
        ],
        missing_objects: [],
        unverified_conditions: ["planning_review"],
        capability_gaps: [],
        safety_blockers: [],
        execution_status: "unverified",
      },
    }));
    return {
      mode: "template_candidates",
      object_id: objectId,
      scene_id: sceneId || null,
      candidates: context.mode === "ready" ? [] : candidates,
    };
  }
  function search(query) {
    const needle = String(query || "")
      .trim()
      .toLowerCase();
    if (!needle) return [];
    return [
      ...data.objects,
      ...data.tasks,
      ...data.scenes,
      ...data.states,
      ...data.intents,
      ...data.skills,
      ...data.claims,
    ]
      .filter((item) =>
        [
          item.id,
          item.name_en,
          item.name_ja,
          item.canonical_name,
          item.statement,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      )
      .map((item) =>
        nodeFromRecord(item, {
          result_type:
            item.node_type === "ObjectInstance"
              ? "object"
              : item.node_type === "TaskInstance"
                ? "task"
                : String(item.node_type || "claim").toLowerCase(),
        }),
      )
      .slice(0, 80);
  }
  return {
    root: ROOT,
    data,
    maps,
    listObjects,
    getObject,
    getTask,
    listTasks,
    getObjectDetail,
    getTaskDetail,
    collectionCard,
    neighbors,
    generateTasks,
    search,
    contextOptions: () => deriveOptions(data, data.planning),
    getScenes: () => clone(data.scenes),
    getStates: () => clone(data.states),
    getIntents: () => clone(data.intents),
    getSkills: () => clone(data.skills),
    getTemplates: () => clone(data.taskTemplates),
    getEvidence: () => clone(data.evidence),
  };
}
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
function tasksToCsv(tasks, maps) {
  const columns = [
    "id",
    "name_en",
    "name_ja",
    "template_id",
    "object_id",
    "scene_id",
    "intent_id",
    "review_status",
    "frequency_status",
    "frequency_value",
  ];
  const claims = maps?.claims ? [...maps.claims.values()] : [];
  return `${[
    columns.join(","),
    ...tasks
      .map((task) => {
        const frequency = claims.find(
          (claim) =>
            claim.subject_id === task.id &&
            claim.claim_type === "population_frequency",
        );
        return [
          task.id,
          task.name_en,
          task.name_ja,
          task.template_id,
          task.object_id,
          task.scene_id,
          task.intent_id,
          task.review_status,
          frequency?.status || "unknown",
          frequency?.value ?? "",
        ];
      })
      .map((row) => row.map(csvCell).join(",")),
  ].join("\n")}\n`;
}
module.exports = { createStore, tasksToCsv, STATUS_ORDER };
