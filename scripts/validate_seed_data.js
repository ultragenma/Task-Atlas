#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SEED_DIR = path.join(ROOT, "data", "seeds");
const SCHEMA_DIR = path.join(ROOT, "schemas");
const REQUIREMENT_KEYS = new Set([
  "contents",
  "role",
  "scene_id",
  "object",
  "capability",
  "condition",
]);
const CLAIM_TYPES = new Set([
  "catalog_identity",
  "task_suitability",
  "population_frequency",
  "robot_execution",
  "asset_compatibility",
]);
const SOURCE_ALLOWED_CLAIMS = Object.freeze({
  catalog: new Set(["catalog_identity"]),
  design_seed: new Set(["task_suitability"]),
  knowledgebase: new Set(["task_suitability"]),
});
const ROLES = new Set(["home_user", "customer", "staff"]);
const CONTENTS = new Set(["full", "empty"]);
const CAPABILITIES = new Set([
  "rigid_manipulation",
  "articulated_closure",
  "deformable_squeezing",
  "material_flow",
  "visual_inspection",
  "human_handover",
  "wiping",
]);
const MUSTARD_OBJECT_ID = "ycb_006_mustard_bottle";
const EXPANSION_ITERATIONS = Object.freeze([1, 2, 3]);
const GENERIC_GOAL_PREDICATES = new Set([
  "complete",
  "completed",
  "done",
  "goal",
  "ok",
  "success",
  "successful",
]);
const FREQUENCY_VALUE_FIELDS = Object.freeze([
  "frequency",
  "frequency_value",
  "frequency_score",
  "frequency_rank",
]);
const EXPANSION_BASELINE_NODE_IDS = new Set([
  "task_apply_mustard_hotdog",
  "task_apply_mustard_sandwich",
  "task_handover_mustard_to_person",
  "task_return_mustard_to_refrigerator",
  "task_retrieve_mustard_from_refrigerator",
  "task_transport_mustard_to_dining_table",
  "task_right_fallen_mustard",
  "task_close_mustard_cap",
  "task_open_mustard_cap",
  "task_clean_mustard_spill",
  "task_inspect_mustard_level",
  "task_discard_empty_mustard",
  "task_separate_mustard_cap",
  "task_restock_mustard_shelf",
  "task_face_mustard_label",
  "task_place_mustard_in_shopping_cart",
  "task_present_mustard_at_checkout",
  "task_organize_mustard_with_condiments",
  "task_pick_up_dropped_mustard",
  "task_wipe_mustard_bottle",
  "task_inspect_mustard_leak",
  "task_store_mustard_in_pantry",
  "task_recover_mustard_from_edge",
  "scene_home_kitchen",
  "scene_dining_table",
  "scene_refrigerator",
  "scene_pantry",
  "scene_restaurant_kitchen",
  "scene_restaurant_table",
  "scene_supermarket_shelf",
  "scene_shopping_cart",
  "scene_checkout_counter",
  "scene_trash_sorting_area",
  "scene_kitchen_counter",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number")
    return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}
function validateSchema(value, schema, at, errors) {
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) {
      errors.push(`${at}: expected ${types.join(" or ")}`);
      return;
    }
  }
  if (schema.enum && !schema.enum.includes(value))
    errors.push(`${at}: invalid enum value`);
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength)
      errors.push(`${at}: string too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push(`${at}: invalid format`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems)
      errors.push(`${at}: too few items`);
    if (schema.items)
      value.forEach((v, i) =>
        validateSchema(v, schema.items, `${at}[${i}]`, errors),
      );
  }
  if (typeMatches(value, "object")) {
    for (const key of schema.required || [])
      if (!(key in value)) errors.push(`${at}: missing ${key}`);
    for (const [key, child] of Object.entries(schema.properties || {}))
      if (key in value)
        validateSchema(value[key], child, `${at}.${key}`, errors);
  }
}
function mapCollection(name, rows, errors) {
  const result = new Map();
  if (!Array.isArray(rows)) {
    errors.push(`${name}: expected array`);
    return result;
  }
  rows.forEach((row, i) => {
    if (!row || !/^[a-z0-9_]+$/.test(row.id || ""))
      errors.push(`${name}[${i}]: invalid id`);
    else if (result.has(row.id)) errors.push(`${name}: duplicate id ${row.id}`);
    else result.set(row.id, row);
  });
  return result;
}
function defaultData() {
  const load = (name) => readJson(path.join(SEED_DIR, name));
  return {
    objects: load("objects.json"),
    scenes: load("scenes.json"),
    states: load("states.json"),
    intents: load("intents.json"),
    skills: load("skills.json"),
    templates: load("task_templates.json"),
    tasks: load("mustard_tasks.json"),
    evidence: load("evidence.json"),
    planning: load("task_planning.json"),
    claims: load("claims.json"),
    expansionLoops: load("expansion_loops.json"),
    expansionRelations: load("expansion_relations.json"),
  };
}
function goalPredicate(value) {
  if (typeof value !== "string") return null;
  const match = /^\s*([a-z][a-z0-9_]*)\s*(?:\([^)]*\))?\s*$/.exec(value);
  return match ? match[1] : null;
}
function validateExpansion(data, maps, errors) {
  const loops = data.expansionLoops;
  const relations = data.expansionRelations;
  if (!Array.isArray(loops)) {
    errors.push("expansion_loops: expected array");
    return;
  }
  if (!Array.isArray(relations)) {
    errors.push("expansion_relations: expected array");
    return;
  }
  if (loops.length !== EXPANSION_ITERATIONS.length)
    errors.push("expansion_loops: expected exactly 3 loops");
  const loopIds = new Set();
  const nodesByIteration = new Map();
  const iterationByNode = new Map();
  const expansionNodeIds = new Set();
  for (const [index, loop] of loops.entries()) {
    const at = `expansion_loops[${index}]`;
    if (!loop || typeof loop !== "object") {
      errors.push(`${at}: malformed loop`);
      continue;
    }
    if (!/^[a-z0-9_]+$/.test(loop.id || ""))
      errors.push(`${at}: invalid id`);
    else if (loopIds.has(loop.id)) errors.push(`${at}: duplicate id ${loop.id}`);
    else loopIds.add(loop.id);
    if (
      !Number.isInteger(loop.iteration) ||
      !EXPANSION_ITERATIONS.includes(loop.iteration)
    )
      errors.push(`${at}: iteration must be 1, 2, or 3`);
    if (!Array.isArray(loop.node_ids)) {
      errors.push(`${at}: node_ids must be an array`);
      continue;
    }
    if (loop.node_ids.length !== 20)
      errors.push(`${at}: expected exactly 20 node_ids`);
    const loopNodes = new Set();
    for (const nodeId of loop.node_ids) {
      if (loopNodes.has(nodeId)) errors.push(`${at}: duplicate node_id ${nodeId}`);
      loopNodes.add(nodeId);
      if (expansionNodeIds.has(nodeId))
        errors.push(`${at}: node_id ${nodeId} appears in multiple loops`);
      expansionNodeIds.add(nodeId);
      const task = maps.tasks.get(nodeId);
      const scene = maps.scenes.get(nodeId);
      if (!task && !scene)
        errors.push(`${at}: unknown task/scene node ${nodeId}`);
      if (task && scene)
        errors.push(`${at}: node ${nodeId} resolves to both task and scene`);
      const record = task || scene;
      if (record && record.review_status !== "proposed")
        errors.push(`${at}: node ${nodeId} must have review_status proposed`);
      if (record && (typeof record.granularity !== "string" || !record.granularity.trim()))
        errors.push(`${at}: node ${nodeId} must have a non-empty granularity`);
      if (record && "scores" in record)
        errors.push(`${at}: node ${nodeId} has obsolete scores`);
      if (task) {
        if (task.object_id !== MUSTARD_OBJECT_ID)
          errors.push(`${at}: task node ${nodeId} must use the mustard object`);
        const predicates = (task.goal_state || []).map(goalPredicate);
        if (!predicates.some((predicate) => predicate && !GENERIC_GOAL_PREDICATES.has(predicate)))
          errors.push(`${at}: task node ${nodeId} must have a semantic goal state`);
        for (const field of FREQUENCY_VALUE_FIELDS) {
          if (
            field in task &&
            task[field] !== null &&
            task[field] !== undefined &&
            task[field] !== "unknown"
          )
            errors.push(`${at}: task node ${nodeId} must not carry a frequency value`);
        }
      }
      if (EXPANSION_BASELINE_NODE_IDS.has(nodeId))
        errors.push(`${at}: node_id ${nodeId} is not a new expansion node`);
    }
    if (
      Number.isInteger(loop.iteration) &&
      EXPANSION_ITERATIONS.includes(loop.iteration)
    ) {
      if (nodesByIteration.has(loop.iteration))
        errors.push(`${at}: duplicate iteration ${loop.iteration}`);
      nodesByIteration.set(loop.iteration, loopNodes);
      for (const nodeId of loopNodes) {
        if (iterationByNode.has(nodeId))
          errors.push(`${at}: node_id ${nodeId} has multiple iterations`);
        iterationByNode.set(nodeId, loop.iteration);
      }
    }
  }
  if (expansionNodeIds.size !== 60)
    errors.push("expansion_loops: expected 60 unique new node_ids");
  const expansionTasks = [...expansionNodeIds].filter((id) => maps.tasks.has(id));
  const expansionScenes = [...expansionNodeIds].filter((id) => maps.scenes.has(id));
  if (expansionTasks.length !== 45)
    errors.push("expansion_loops: expected exactly 45 task nodes");
  if (expansionScenes.length !== 15)
    errors.push("expansion_loops: expected exactly 15 scene nodes");
  const taskGranularities = new Set(
    expansionTasks.map((id) => maps.tasks.get(id)?.granularity).filter(Boolean),
  );
  const sceneGranularities = new Set(
    expansionScenes.map((id) => maps.scenes.get(id)?.granularity).filter(Boolean),
  );
  if (taskGranularities.size < 2)
    errors.push("expansion_loops: task nodes must use varied granularity");
  if (sceneGranularities.size < 2)
    errors.push("expansion_loops: scene nodes must use varied granularity");
  const expansionTemplateIds = new Set(
    expansionTasks.map((id) => maps.tasks.get(id)?.template_id).filter(Boolean),
  );
  const expansionIntentIds = new Set(
    expansionTasks.map((id) => maps.tasks.get(id)?.intent_id).filter(Boolean),
  );
  if (expansionTemplateIds.size < 3)
    errors.push("expansion_loops: task nodes must use at least 3 templates");
  if (expansionIntentIds.size < 3)
    errors.push("expansion_loops: task nodes must use at least 3 intents");
  const semanticGoalPredicates = new Set(
    expansionTasks
      .flatMap((id) => maps.tasks.get(id)?.goal_state || [])
      .map(goalPredicate)
      .filter((predicate) => predicate && !GENERIC_GOAL_PREDICATES.has(predicate)),
  );
  if (semanticGoalPredicates.size < 4)
    errors.push("expansion_loops: task nodes must expose varied semantic goals");
  for (const iteration of EXPANSION_ITERATIONS)
    if (!nodesByIteration.has(iteration))
      errors.push(`expansion_loops: missing iteration ${iteration}`);

  const relationIds = new Set();
  const nodeExists = (id) => maps.tasks.has(id) || maps.scenes.has(id);
  const validRelations = [];
  for (const [index, relation] of relations.entries()) {
    const at = `expansion_relations[${index}]`;
    if (!relation || typeof relation !== "object") {
      errors.push(`${at}: malformed relation`);
      continue;
    }
    if (!/^[a-z0-9_]+$/.test(relation.id || ""))
      errors.push(`${at}: invalid id`);
    else if (relationIds.has(relation.id))
      errors.push(`${at}: duplicate id ${relation.id}`);
    else relationIds.add(relation.id);
    if (!nodeExists(relation.source)) errors.push(`${at}: unknown source ${relation.source}`);
    if (!nodeExists(relation.target)) errors.push(`${at}: unknown target ${relation.target}`);
    if (relation.source === relation.target)
      errors.push(`${at}: source and target must differ`);
    if (
      typeof relation.relation !== "string" ||
      !/^[a-z][a-z0-9_]*$/.test(relation.relation)
    )
      errors.push(`${at}: relation must be a lower_snake_case label`);
    if (
      typeof relation.rationale !== "string" ||
      relation.rationale.trim().length < 20
    )
      errors.push(`${at}: rationale must be a non-empty sentence of at least 20 characters`);
    if (
      !Number.isInteger(relation.iteration) ||
      !EXPANSION_ITERATIONS.includes(relation.iteration)
    )
      errors.push(`${at}: iteration must be 1, 2, or 3`);
    const currentNodes = nodesByIteration.get(relation.iteration);
    if (!currentNodes)
      errors.push(`${at}: iteration must resolve to an expansion loop`);
    else if (!currentNodes.has(relation.source) && !currentNodes.has(relation.target))
      errors.push(`${at}: relation must touch its iteration's loop`);
    if (
      nodeExists(relation.source) &&
      nodeExists(relation.target) &&
      relation.source !== relation.target
    )
      validRelations.push(relation);
  }
  for (const iteration of [2, 3]) {
    const currentNodes = nodesByIteration.get(iteration);
    const previousNodes = nodesByIteration.get(iteration - 1);
    if (!currentNodes || !previousNodes) continue;
    for (const nodeId of currentNodes) {
      const connected = validRelations.some(
        (relation) =>
          (relation.source === nodeId && previousNodes.has(relation.target)) ||
          (relation.target === nodeId && previousNodes.has(relation.source)),
      );
      if (!connected)
        errors.push(
          `expansion node ${nodeId}: iteration ${iteration} node must connect to immediate previous iteration ${iteration - 1}`,
        );
    }
  }
  const mustardGraphNodeIds = new Set(
    data.tasks
      .filter((task) => task.object_id === MUSTARD_OBJECT_ID)
      .flatMap((task) => [task.id, task.scene_id]),
  );
  const loopOneNodes = nodesByIteration.get(1);
  if (
    loopOneNodes &&
    !validRelations.some(
      (relation) =>
        (loopOneNodes.has(relation.source) &&
          mustardGraphNodeIds.has(relation.target) &&
          !expansionNodeIds.has(relation.target)) ||
        (loopOneNodes.has(relation.target) &&
          mustardGraphNodeIds.has(relation.source) &&
          !expansionNodeIds.has(relation.source)),
    )
  )
    errors.push(
      "expansion_loops: loop 1 must anchor to a reachable existing mustard graph node",
    );

  for (const taskId of expansionTasks) {
    const frequencyClaims = data.claims.filter(
      (claim) =>
        claim.subject_id === taskId &&
        claim.claim_type === "population_frequency",
    );
    if (frequencyClaims.length !== 1) {
      errors.push(
        `${taskId}: expansion task must have exactly one population_frequency claim`,
      );
    } else {
      const [frequencyClaim] = frequencyClaims;
      if (
        frequencyClaim.status !== "unknown" ||
        frequencyClaim.value !== null ||
        frequencyClaim.unit !== null ||
        (frequencyClaim.source_ids || []).length
      )
        errors.push(
          `${taskId}: expansion population frequency must remain unknown with null value/unit and no sources`,
        );
    }
  }
}
function validateRequirements(requirements, at, maps, errors) {
  if (!Array.isArray(requirements)) {
    errors.push(`${at}: requirements must be an array`);
    return;
  }
  for (const requirement of requirements) {
    if (!requirement || typeof requirement !== "object") {
      errors.push(`${at}: malformed requirement`);
      continue;
    }
    if (!REQUIREMENT_KEYS.has(requirement.key))
      errors.push(`${at}: invalid requirement key ${requirement.key}`);
    if (requirement.key === "scene_id" && !maps.scenes.has(requirement.value))
      errors.push(`${at}: unknown scene ${requirement.value}`);
    if (requirement.key === "role" && !ROLES.has(requirement.value))
      errors.push(`${at}: invalid role ${requirement.value}`);
    if (requirement.key === "contents" && !CONTENTS.has(requirement.value))
      errors.push(`${at}: invalid contents ${requirement.value}`);
    if (
      requirement.key === "capability" &&
      !CAPABILITIES.has(requirement.value)
    )
      errors.push(`${at}: invalid capability ${requirement.value}`);
    if (
      (requirement.key === "object" || requirement.key === "condition") &&
      !/^[a-z0-9_]+$/.test(requirement.value || "")
    )
      errors.push(`${at}: ${requirement.key} requirement must be snake_case`);
  }
}
function validateData(data = defaultData()) {
  const errors = [];
  const collectionNames = [
    "objects",
    "scenes",
    "states",
    "intents",
    "skills",
    "templates",
    "tasks",
    "evidence",
    "planning",
    "claims",
  ];
  const maps = Object.fromEntries(
    collectionNames.map((name) => [
      name,
      mapCollection(name, data[name], errors),
    ]),
  );
  const schemas = {
    objects: "object.schema.json",
    templates: "task_template.schema.json",
    tasks: "task_instance.schema.json",
    evidence: "evidence.schema.json",
    planning: "task_planning.schema.json",
    claims: "claim.schema.json",
  };
  for (const [name, file] of Object.entries(schemas))
    for (const [i, row] of (Array.isArray(data[name])
      ? data[name]
      : []
    ).entries())
      validateSchema(
        row,
        readJson(path.join(SCHEMA_DIR, file)),
        `${name}[${i}]`,
        errors,
      );
  if (!maps.objects.has("ycb_006_mustard_bottle"))
    errors.push("objects: missing ycb_006_mustard_bottle anchor");
  for (const template of Array.isArray(data.templates) ? data.templates : []) {
    for (const scene of template.compatible_scenes || [])
      if (!maps.scenes.has(scene))
        errors.push(`${template.id}: unknown scene ${scene}`);
    for (const skill of template.skills || [])
      if (!maps.skills.has(skill))
        errors.push(`${template.id}: unknown skill ${skill}`);
  }
  for (const task of Array.isArray(data.tasks) ? data.tasks : []) {
    for (const [field, map] of [
      ["template_id", maps.templates],
      ["object_id", maps.objects],
      ["scene_id", maps.scenes],
      ["intent_id", maps.intents],
    ])
      if (!map.has(task[field]))
        errors.push(`${task.id}: unknown ${field} ${task[field]}`);
    for (const state of task.state_ids || [])
      if (!maps.states.has(state))
        errors.push(`${task.id}: unknown state ${state}`);
    for (const skill of task.skills || [])
      if (!maps.skills.has(skill))
        errors.push(`${task.id}: unknown skill ${skill}`);
    if ("scores" in task)
      errors.push(`${task.id}: obsolete scores are not allowed`);
  }
  validateExpansion(data, maps, errors);
  for (const source of Array.isArray(data.evidence) ? data.evidence : []) {
    const allowedClaims = SOURCE_ALLOWED_CLAIMS[source.source_type];
    if (!allowedClaims)
      errors.push(`${source.id}: unknown source type ${source.source_type}`);
    for (const type of source.supported_claim_types || []) {
      if (!CLAIM_TYPES.has(type))
        errors.push(`${source.id}: invalid supported claim type ${type}`);
      else if (!allowedClaims?.has(type))
        errors.push(
          `${source.id}: cannot support ${type} for source type ${source.source_type}`,
        );
    }
    if ("evidence_level" in source || "confidence" in source)
      errors.push(`${source.id}: global grades and confidence are not allowed`);
  }
  const planningByTask = new Map();
  for (const plan of Array.isArray(data.planning) ? data.planning : []) {
    if (!maps.tasks.has(plan.task_id))
      errors.push(`${plan.id}: unknown task ${plan.task_id}`);
    if (planningByTask.has(plan.task_id))
      errors.push(`${plan.id}: duplicate planning for ${plan.task_id}`);
    planningByTask.set(plan.task_id, plan);
    validateRequirements(
      plan.requirements,
      `${plan.id}: planning`,
      maps,
      errors,
    );
    const procedureIds = new Set();
    if (!Array.isArray(plan.procedures))
      errors.push(`${plan.id}: procedures must be an array`);
    for (const procedure of Array.isArray(plan.procedures)
      ? plan.procedures
      : []) {
      if (procedureIds.has(procedure.id))
        errors.push(`${plan.id}: duplicate procedure id ${procedure.id}`);
      procedureIds.add(procedure.id);
      validateRequirements(
        procedure.requirements,
        `${procedure.id}: procedure`,
        maps,
        errors,
      );
      if (!Array.isArray(procedure.steps))
        errors.push(`${procedure.id}: steps must be an array`);
      for (const step of Array.isArray(procedure.steps) ? procedure.steps : [])
        if (!maps.skills.has(step.skill_id))
          errors.push(`${procedure.id}: unknown step skill ${step.skill_id}`);
    }
    for (const key of [
      "setup_minutes",
      "execution_minutes",
      "reset_minutes",
      "review_minutes",
    ])
      if (plan.collection?.time_estimates?.[key] !== null)
        errors.push(`${plan.id}: ${key} must be null until measured`);
  }
  for (const task of Array.isArray(data.tasks) ? data.tasks : [])
    if (!planningByTask.has(task.id))
      errors.push(`${task.id}: missing planning record`);
  const claimTypesByTask = new Map();
  for (const claim of Array.isArray(data.claims) ? data.claims : []) {
    if (!CLAIM_TYPES.has(claim.claim_type))
      errors.push(`${claim.id}: invalid claim type`);
    if (
      !maps.tasks.has(claim.subject_id) &&
      !maps.objects.has(claim.subject_id)
    )
      errors.push(`${claim.id}: unknown claim subject ${claim.subject_id}`);
    for (const sourceId of claim.source_ids || []) {
      const source = maps.evidence.get(sourceId);
      if (!source) errors.push(`${claim.id}: unknown source ${sourceId}`);
      else if (!source.supported_claim_types.includes(claim.claim_type))
        errors.push(
          `${claim.id}: ${sourceId} cannot support ${claim.claim_type}`,
        );
    }
    if (
      claim.status === "unknown" &&
      (claim.value !== null ||
        claim.unit !== null ||
        (claim.source_ids || []).length)
    )
      errors.push(
        `${claim.id}: unknown claims require null value/unit and no sources`,
      );
    if (
      claim.status === "supported" &&
      (!Array.isArray(claim.source_ids) || !claim.source_ids.length)
    )
      errors.push(`${claim.id}: supported claims require sources`);
    if (
      claim.status === "supported" &&
      (claim.source_ids || []).some(
        (id) => maps.evidence.get(id)?.source_type === "design_seed",
      )
    )
      errors.push(`${claim.id}: design seed cannot justify supported status`);
    if (maps.tasks.has(claim.subject_id)) {
      const types = claimTypesByTask.get(claim.subject_id) || new Set();
      types.add(claim.claim_type);
      claimTypesByTask.set(claim.subject_id, types);
    }
  }
  for (const task of Array.isArray(data.tasks) ? data.tasks : [])
    for (const type of [
      "task_suitability",
      "population_frequency",
      "robot_execution",
      "asset_compatibility",
    ])
      if (!claimTypesByTask.get(task.id)?.has(type))
        errors.push(`${task.id}: missing ${type} claim`);
  return { valid: errors.length === 0, errors };
}
function run() {
  const result = validateData();
  if (!result.valid) {
    console.error(
      `Seed validation failed with ${result.errors.length} error(s):`,
    );
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  const data = defaultData();
  console.log("Seed validation passed.");
  console.log(`  YCB object records: ${data.objects.length}`);
  console.log(`  task instances: ${data.tasks.length}`);
  console.log(`  planning records: ${data.planning.length}`);
  console.log(`  claims: ${data.claims.length}`);
}
if (require.main === module) run();
module.exports = { validateData, defaultData };
