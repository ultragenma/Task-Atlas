#!/usr/bin/env node
const { defaultData } = require("./validate_seed_data");

const data = defaultData();
const rounds = [...new Set(data.tasks.map((task) => task.generation_version).filter(Boolean))].sort();
const rows = data.objects.map((object) => {
  const tasks = data.tasks.filter((task) => task.object_id === object.id);
  return {
    object_id: object.id,
    name: object.name_en,
    task_count: tasks.length,
    rounds: Object.fromEntries(rounds.map((round) => [round, tasks.filter((task) => task.generation_version === round).length])),
    tasks: tasks.map((task) => ({ id: task.id, name: task.name_en, scene: task.scene_id, intent: task.intent_id })),
  };
});
const missing = rows.filter((row) => row.task_count === 0).map((row) => row.object_id);
const result = {
  catalog_objects: rows.length,
  covered_objects: rows.length - missing.length,
  task_count: data.tasks.length,
  generation_rounds: rounds,
  missing_objects: missing,
  objects: rows,
};
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exitCode = 1;
