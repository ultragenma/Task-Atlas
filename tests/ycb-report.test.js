const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { defaultData } = require("../scripts/validate_seed_data");

const ROOT = path.resolve(__dirname, "..");
const REPORT_SCRIPT = path.join(ROOT, "scripts", "report_ycb_coverage.js");

function runReport() {
  return JSON.parse(
    execFileSync(process.execPath, [REPORT_SCRIPT], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  );
}

function expectedReportData() {
  const data = defaultData();
  const catalogIds = new Set(data.objects.map((object) => object.id));
  const planning = new Map(data.planning.map((plan) => [plan.task_id, plan]));
  const rounds = [
    ...new Set(data.tasks.map((task) => task.generation_version).filter(Boolean)),
  ].sort();
  const requiredCatalogObjects = (task) => [
    ...new Set(
      (planning.get(task.id)?.requirements || [])
        .filter(
          (requirement) =>
            requirement.key === "object" &&
            requirement.value !== task.object_id &&
            catalogIds.has(requirement.value),
        )
        .map((requirement) => requirement.value),
    ),
  ];
  return { data, catalogIds, planning, rounds, requiredCatalogObjects };
}

test("YCB coverage CLI reconciles counts, catalog dependencies, and round summaries", () => {
  const report = runReport();
  const {
    data,
    catalogIds,
    planning,
    rounds,
    requiredCatalogObjects,
  } = expectedReportData();
  const tasksByObject = new Map();
  for (const task of data.tasks) {
    if (!tasksByObject.has(task.object_id)) tasksByObject.set(task.object_id, []);
    tasksByObject.get(task.object_id).push(task);
  }

  assert.equal(report.catalog_objects, data.objects.length);
  assert.equal(
    report.covered_objects,
    data.objects.filter((object) => (tasksByObject.get(object.id) || []).length).length,
  );
  assert.equal(report.task_count, data.tasks.length);
  assert.deepEqual(report.generation_rounds, rounds);
  assert.deepEqual(
    report.missing_objects,
    data.objects
      .filter((object) => !(tasksByObject.get(object.id) || []).length)
      .map((object) => object.id),
  );
  assert.equal(report.objects.length, data.objects.length);

  for (const [index, object] of data.objects.entries()) {
    const row = report.objects[index];
    const tasks = tasksByObject.get(object.id) || [];
    assert.equal(row.object_id, object.id);
    assert.equal(row.task_count, tasks.length);
    assert.deepEqual(
      row.rounds,
      Object.fromEntries(
        rounds.map((round) => [
          round,
          tasks.filter((task) => task.generation_version === round).length,
        ]),
      ),
    );
    assert.deepEqual(
      row.tasks.map((task) => task.id),
      tasks.map((task) => task.id),
    );

    for (const taskRow of row.tasks) {
      const task = data.tasks.find((candidate) => candidate.id === taskRow.id);
      assert.ok(task, `${taskRow.id} must resolve to a seed task`);
      const expected = requiredCatalogObjects(task);
      assert.deepEqual(taskRow.required_catalog_objects, expected, task.id);
      assert.equal(
        new Set(taskRow.required_catalog_objects).size,
        taskRow.required_catalog_objects.length,
        `${task.id}: catalog dependencies must be deduplicated`,
      );
      assert.ok(
        taskRow.required_catalog_objects.every((id) => catalogIds.has(id)),
        `${task.id}: fixtures must not appear as catalog dependencies`,
      );
      assert.ok(
        !taskRow.required_catalog_objects.includes(task.object_id),
        `${task.id}: primary object must not appear as a catalog dependency`,
      );
      assert.ok(planning.has(task.id), `${task.id}: planning must resolve`);
    }
  }

  const partnerCase = report.objects
    .flatMap((row) => row.tasks)
    .find((task) => task.id === "task_ycb_round2_069_box_lid");
  assert.ok(partnerCase);
  assert.deepEqual(partnerCase.required_catalog_objects, ["ycb_068_clear_box"]);

  const expectedRoundSummary = rounds.map((round) => {
    const tasks = data.tasks.filter((task) => task.generation_version === round);
    const dependencies = tasks.map(requiredCatalogObjects);
    return {
      round,
      tasks: tasks.length,
      covered_objects: new Set(tasks.map((task) => task.object_id)).size,
      tasks_with_catalog_partners: dependencies.filter((items) => items.length > 0)
        .length,
      catalog_dependency_edges: dependencies.reduce(
        (count, items) => count + items.length,
        0,
      ),
    };
  });
  assert.deepEqual(report.round_summary, expectedRoundSummary);
});
