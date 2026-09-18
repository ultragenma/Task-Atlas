#!/usr/bin/env node
const { defaultData } = require("./validate_seed_data");

const data = defaultData();
const catalogIds = new Set(data.objects.map((object) => object.id));
const planning = new Map(data.planning.map((plan) => [plan.task_id, plan]));
const requiredCatalogObjects = (task) => [...new Set(
  (planning.get(task.id)?.requirements || [])
    .filter((requirement) => requirement.key === "object" && requirement.value !== task.object_id && catalogIds.has(requirement.value))
    .map((requirement) => requirement.value),
)];
const rounds = [...new Set(data.tasks.map((task) => task.generation_version).filter(Boolean))].sort();
const rows = data.objects.map((object) => {
  const tasks = data.tasks.filter((task) => task.object_id === object.id);
  return {
    object_id: object.id,
    name: object.name_en,
    task_count: tasks.length,
    rounds: Object.fromEntries(rounds.map((round) => [round, tasks.filter((task) => task.generation_version === round).length])),
    tasks: tasks.map((task) => ({ id: task.id, name: task.name_en, scene: task.scene_id, intent: task.intent_id, required_catalog_objects: requiredCatalogObjects(task) })),
  };
});
const missing = rows.filter((row) => row.task_count === 0).map((row) => row.object_id);
const result = {
  catalog_objects: rows.length,
  covered_objects: rows.length - missing.length,
  task_count: data.tasks.length,
  generation_rounds: rounds,
  round_summary: rounds.map((round) => {
    const tasks = data.tasks.filter((task) => task.generation_version === round);
    return {
      round,
      tasks: tasks.length,
      covered_objects: new Set(tasks.map((task) => task.object_id)).size,
      tasks_with_catalog_partners: tasks.filter((task) => requiredCatalogObjects(task).length > 0).length,
      catalog_dependency_edges: tasks.reduce((count, task) => count + requiredCatalogObjects(task).length, 0),
    };
  }),
  missing_objects: missing,
  objects: rows,
};
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exitCode = 1;
