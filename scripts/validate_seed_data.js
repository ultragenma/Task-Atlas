#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SEED_DIR = path.join(ROOT, 'data', 'seeds');
const SCHEMA_DIR = path.join(ROOT, 'schemas');

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function typeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function validateSchema(value, schema, location, errors) {
  if (schema.type) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some((type) => typeMatches(value, type))) {
      errors.push(`${location}: expected ${allowedTypes.join(' or ')}`);
      return;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${location}: value is not one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location}: string is too short`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${location}: does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${location}: number is below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${location}: number is above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location}: array has fewer than ${schema.minItems} items`);
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${location}[${index}]`, errors));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) {
      if (!(required in value)) errors.push(`${location}: missing required property ${required}`);
    }
    for (const [property, propertySchema] of Object.entries(schema.properties || {})) {
      if (property in value) validateSchema(value[property], propertySchema, `${location}.${property}`, errors);
    }
  }
}

function assertForeignKey(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateCollection(name, values, errors) {
  if (!Array.isArray(values) || values.length === 0) {
    errors.push(`${name}: expected a non-empty array`);
    return new Map();
  }
  const ids = new Map();
  values.forEach((value, index) => {
    if (!value || typeof value.id !== 'string') return errors.push(`${name}[${index}]: id is required`);
    if (!/^[a-z0-9_]+$/.test(value.id)) errors.push(`${name}[${index}].id: invalid canonical id ${value.id}`);
    if (ids.has(value.id)) errors.push(`${name}: duplicate id ${value.id}`);
    ids.set(value.id, value);
  });
  return ids;
}

function run() {
  const errors = [];
  const objects = readJson(path.join(SEED_DIR, 'objects.json'));
  const scenes = readJson(path.join(SEED_DIR, 'scenes.json'));
  const states = readJson(path.join(SEED_DIR, 'states.json'));
  const intents = readJson(path.join(SEED_DIR, 'intents.json'));
  const skills = readJson(path.join(SEED_DIR, 'skills.json'));
  const templates = readJson(path.join(SEED_DIR, 'task_templates.json'));
  const tasks = readJson(path.join(SEED_DIR, 'mustard_tasks.json'));
  const evidence = readJson(path.join(SEED_DIR, 'evidence.json'));

  const objectMap = validateCollection('objects', objects, errors);
  const sceneMap = validateCollection('scenes', scenes, errors);
  const stateMap = validateCollection('states', states, errors);
  const intentMap = validateCollection('intents', intents, errors);
  const skillMap = validateCollection('skills', skills, errors);
  const templateMap = validateCollection('task_templates', templates, errors);
  const taskMap = validateCollection('mustard_tasks', tasks, errors);
  const evidenceMap = validateCollection('evidence', evidence, errors);

  const objectSchema = readJson(path.join(SCHEMA_DIR, 'object.schema.json'));
  const templateSchema = readJson(path.join(SCHEMA_DIR, 'task_template.schema.json'));
  const taskSchema = readJson(path.join(SCHEMA_DIR, 'task_instance.schema.json'));
  const evidenceSchema = readJson(path.join(SCHEMA_DIR, 'evidence.schema.json'));
  objects.forEach((item, index) => validateSchema(item, objectSchema, `objects[${index}]`, errors));
  templates.forEach((item, index) => validateSchema(item, templateSchema, `task_templates[${index}]`, errors));
  tasks.forEach((item, index) => validateSchema(item, taskSchema, `mustard_tasks[${index}]`, errors));
  evidence.forEach((item, index) => validateSchema(item, evidenceSchema, `evidence[${index}]`, errors));

  assertForeignKey(objects.length === 77, `objects: expected 77 YCB entries, got ${objects.length}`, errors);
  for (let number = 1; number <= 77; number += 1) {
    const ycbId = String(number).padStart(3, '0');
    assertForeignKey(objects.some((object) => object.ycb_id.startsWith(`${ycbId}_`)), `objects: missing YCB id ${ycbId}`, errors);
  }
  assertForeignKey(objectMap.has('ycb_006_mustard_bottle'), 'objects: missing ycb_006_mustard_bottle', errors);
  assertForeignKey(tasks.length >= 20, `mustard_tasks: expected at least 20 instances, got ${tasks.length}`, errors);
  assertForeignKey(evidenceMap.get('evidence_mvp_seed')?.evidence_level === 'F', 'evidence_mvp_seed must remain level F', errors);

  for (const template of templates) {
    for (const sceneId of template.compatible_scenes || []) assertForeignKey(sceneMap.has(sceneId), `${template.id}: unknown scene ${sceneId}`, errors);
    for (const skillId of template.skills || []) assertForeignKey(skillMap.has(skillId), `${template.id}: unknown skill ${skillId}`, errors);
  }

  for (const task of tasks) {
    assertForeignKey(templateMap.has(task.template_id), `${task.id}: unknown template ${task.template_id}`, errors);
    assertForeignKey(objectMap.has(task.object_id), `${task.id}: unknown object ${task.object_id}`, errors);
    assertForeignKey(sceneMap.has(task.scene_id), `${task.id}: unknown scene ${task.scene_id}`, errors);
    assertForeignKey(intentMap.has(task.intent_id), `${task.id}: unknown intent ${task.intent_id}`, errors);
    for (const stateId of task.state_ids || []) assertForeignKey(stateMap.has(stateId), `${task.id}: unknown state ${stateId}`, errors);
    for (const skillId of task.skills || []) assertForeignKey(skillMap.has(skillId), `${task.id}: unknown skill ${skillId}`, errors);
    for (const evidenceId of task.evidence_ids || []) assertForeignKey(evidenceMap.has(evidenceId), `${task.id}: unknown evidence ${evidenceId}`, errors);
    for (const [scoreName, score] of Object.entries(task.scores || {})) {
      assertForeignKey(typeof score === 'number' && score >= 0 && score <= 1, `${task.id}: score ${scoreName} must be a number in [0, 1]`, errors);
    }
    assertForeignKey(task.review_status !== 'reviewed' || (task.evidence_ids || []).some((id) => evidenceMap.get(id)?.evidence_level !== 'F'), `${task.id}: a reviewed task cannot rely only on level F evidence`, errors);
  }

  if (errors.length) {
    console.error(`Seed validation failed with ${errors.length} error(s):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log('Seed validation passed.');
  console.log(`  YCB objects: ${objects.length}`);
  console.log(`  mustard task instances: ${tasks.length}`);
  console.log(`  task templates: ${templates.length}`);
  console.log(`  skills: ${skills.length}`);
  console.log(`  evidence records: ${evidence.length}`);
}

run();
