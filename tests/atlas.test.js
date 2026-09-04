const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../backend/server');

let server;
let baseUrl;

function request(pathname) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(pathname, baseUrl);
    const request = http.get(requestUrl, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on('error', reject);
  });
}

function jsonResponse(response) {
  return JSON.parse(response.body);
}

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health reports the seeded MVP counts', async () => {
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  const payload = jsonResponse(response);
  assert.equal(payload.ok, true);
  assert.equal(payload.seed_counts.objects, 77);
  assert.equal(payload.seed_counts.task_instances, 23);
});

test('object catalog contains the mustard vertical slice', async () => {
  const response = await request('/api/objects?q=mustard');
  assert.equal(response.status, 200);
  const payload = jsonResponse(response);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].id, 'ycb_006_mustard_bottle');
});

test('object detail exposes grounded tasks and catalog metadata', async () => {
  const response = await request('/api/objects/ycb_006_mustard_bottle');
  assert.equal(response.status, 200);
  const payload = jsonResponse(response);
  assert.equal(payload.data.object.ycb_id, '006_mustard_bottle');
  assert.equal(payload.data.related_task_count, 23);
  assert.ok(payload.data.related_tasks.some((task) => task.id === 'task_return_mustard_to_refrigerator'));
});

test('object neighborhood starts collapsed and group expansion returns children', async () => {
  const initialResponse = await request('/api/nodes/ycb_006_mustard_bottle/neighbors');
  assert.equal(initialResponse.status, 200);
  const initial = jsonResponse(initialResponse).data;
  assert.ok(initial.nodes.some((node) => node.id === 'group:ycb_006_mustard_bottle:tasks'));
  assert.ok(!initial.nodes.some((node) => node.id === 'task_return_mustard_to_refrigerator'));

  const groupId = encodeURIComponent('group:ycb_006_mustard_bottle:tasks');
  const expandedResponse = await request(`/api/nodes/${groupId}/neighbors`);
  assert.equal(expandedResponse.status, 200);
  const expanded = jsonResponse(expandedResponse).data;
  assert.equal(expanded.nodes.filter((node) => node.node_type === 'TaskInstance').length, 23);
  assert.ok(expanded.edges.some((edge) => edge.relation === 'contains'));
});

test('task detail keeps template, states, skills, and evidence separate', async () => {
  const response = await request('/api/tasks/task_return_mustard_to_refrigerator');
  assert.equal(response.status, 200);
  const payload = jsonResponse(response).data;
  assert.equal(payload.task.template_id, 'store_in_cold_storage');
  assert.equal(payload.template.node_type, 'TaskTemplate');
  assert.ok(payload.states.some((state) => state.id === 'state_refrigerated'));
  assert.ok(payload.skills.some((skill) => skill.id === 'skill_grasp'));
  assert.equal(payload.evidence.some((item) => item.evidence_level === 'F'), true);
  assert.equal(payload.task.review_status, 'proposed');
});

test('task ranking supports a low-cost ascending mode', async () => {
  const response = await request('/api/tasks?object_id=ycb_006_mustard_bottle&rank=collection_cost');
  assert.equal(response.status, 200);
  const tasks = jsonResponse(response).data;
  assert.equal(tasks.length, 23);
  for (let index = 1; index < tasks.length; index += 1) {
    assert.ok(tasks[index - 1].scores.collection_cost <= tasks[index].scores.collection_cost);
  }
});

test('template generation returns candidates for an unannotated YCB object', async () => {
  const response = await request('/api/tasks/generate?object_id=ycb_003_cracker_box&scene_id=scene_home_kitchen');
  assert.equal(response.status, 200);
  const payload = jsonResponse(response).data;
  assert.equal(payload.mode, 'template_candidates');
  assert.ok(payload.candidates.length > 0);
  assert.equal(payload.candidates[0].review_status, 'proposed');
  assert.equal(payload.candidates[0].generated, true);
});

test('JSON and CSV exports are available', async () => {
  const json = await request('/api/export/tasks.json');
  assert.equal(json.status, 200);
  assert.match(json.headers['content-disposition'], /physical-ai-task-atlas-tasks\.json/);
  assert.equal(jsonResponse(json).data.length, 23);

  const csv = await request('/api/export/tasks.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers['content-disposition'], /physical-ai-task-atlas-tasks\.csv/);
  assert.match(csv.body, /^id,name_en,name_ja/);
  assert.match(csv.body, /task_return_mustard_to_refrigerator/);
});

test('root serves the explorer UI', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/html/);
  assert.match(response.body, /Physical AI Task Atlas/);
  assert.match(response.body, /graph-svg/);
});
