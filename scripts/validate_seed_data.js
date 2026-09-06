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
  };
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
