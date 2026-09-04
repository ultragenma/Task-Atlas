const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { createStore, tasksToCsv, RANK_LABELS } = require('./app/store');

const store = createStore();
const FRONTEND_DIR = path.join(store.root, 'frontend');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(response, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...headers
  });
  response.end(body);
}

function sendText(response, status, body, contentType, headers = {}) {
  response.writeHead(status, {
    'Content-Type': contentType,
    ...headers
  });
  response.end(body);
}

function notFound(response, message = 'Not found') {
  sendJson(response, 404, { error: message });
}

function badRequest(response, message) {
  sendJson(response, 400, { error: message });
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function parseLimit(value, fallback = 200) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

function serializeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function apiHandler(request, response, url) {
  const pathname = url.pathname;
  const segments = pathname.split('/').filter(Boolean).map(decodeSegment);
  if (segments.some((segment) => segment === null)) return badRequest(response, 'Invalid URL encoding');

  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, {
      ok: true,
      service: 'physical-ai-task-atlas',
      seed_counts: {
        objects: store.data.objects.length,
        scenes: store.data.scenes.length,
        states: store.data.states.length,
        intents: store.data.intents.length,
        skills: store.data.skills.length,
        task_templates: store.data.taskTemplates.length,
        task_instances: store.data.tasks.length,
        evidence: store.data.evidence.length
      }
    });
  }

  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'This MVP exposes read-only APIs. Proposal/review persistence is not implemented.' }, { Allow: 'GET' });
  }

  if (pathname === '/api/objects') {
    const query = url.searchParams.get('q') || url.searchParams.get('query') || '';
    const objects = store.listObjects(query).slice(0, parseLimit(url.searchParams.get('limit'), 200));
    return sendJson(response, 200, { data: objects, meta: { total: objects.length, query } });
  }

  if (segments[0] === 'api' && segments[1] === 'objects' && segments.length === 3) {
    const detail = store.getObjectDetail(segments[2]);
    return detail ? sendJson(response, 200, { data: detail }) : notFound(response, 'Object not found');
  }

  if (pathname === '/api/tasks/generate') {
    const objectId = url.searchParams.get('object_id');
    if (!objectId) return badRequest(response, 'object_id is required');
    const generated = store.generateTasks(objectId, url.searchParams.get('scene_id') || undefined);
    return generated ? sendJson(response, 200, { data: generated }) : notFound(response, 'Object not found');
  }

  if (pathname === '/api/tasks') {
    const filters = {
      q: url.searchParams.get('q') || '',
      object_id: url.searchParams.get('object_id') || '',
      scene_id: url.searchParams.get('scene_id') || '',
      intent_id: url.searchParams.get('intent_id') || '',
      skill_id: url.searchParams.get('skill_id') || '',
      rank: url.searchParams.get('rank') || 'human_frequency'
    };
    const tasks = store.listTasks(filters).slice(0, parseLimit(url.searchParams.get('limit'), 200));
    return sendJson(response, 200, { data: tasks, meta: { total: tasks.length, rank: filters.rank, rank_label: RANK_LABELS[filters.rank] || RANK_LABELS.human_frequency } });
  }

  if (segments[0] === 'api' && segments[1] === 'tasks' && segments.length === 3) {
    const detail = store.getTaskDetail(segments[2]);
    return detail ? sendJson(response, 200, { data: detail }) : notFound(response, 'Task not found');
  }

  if (segments[0] === 'api' && segments[1] === 'nodes' && segments[3] === 'neighbors' && segments.length === 4) {
    const graph = store.neighbors(segments[2]);
    return graph ? sendJson(response, 200, { data: graph }) : notFound(response, 'Node not found');
  }

  if (pathname === '/api/scenes') return sendJson(response, 200, { data: store.getScenes() });
  if (pathname === '/api/states') return sendJson(response, 200, { data: store.getStates() });
  if (pathname === '/api/intents') return sendJson(response, 200, { data: store.getIntents() });
  if (pathname === '/api/skills') return sendJson(response, 200, { data: store.getSkills() });
  if (pathname === '/api/templates') return sendJson(response, 200, { data: store.getTemplates() });

  if (pathname === '/api/search') {
    const query = url.searchParams.get('q') || '';
    return sendJson(response, 200, { data: store.search(query), meta: { query } });
  }

  if (pathname === '/api/export/tasks.json') {
    const body = JSON.stringify({
      schema_version: '0.1',
      generated_at: new Date().toISOString(),
      review_note: 'Task candidates retain their review_status and evidence_ids. Proposed records are not confirmed observations.',
      data: store.data.tasks
    }, null, 2);
    return sendText(response, 200, body, 'application/json; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="physical-ai-task-atlas-tasks.json"'
    });
  }

  if (pathname === '/api/export/tasks.csv') {
    const body = tasksToCsv(store.data.tasks, store.maps);
    return sendText(response, 200, body, 'text/csv; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="physical-ai-task-atlas-tasks.csv"'
    });
  }

  return notFound(response, 'API route not found');
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filepath = path.resolve(FRONTEND_DIR, requested);
  if (filepath !== FRONTEND_DIR && !filepath.startsWith(`${FRONTEND_DIR}${path.sep}`)) {
    return notFound(response, 'Invalid static path');
  }
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) return notFound(response);
  const extension = path.extname(filepath).toLocaleLowerCase();
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filepath).pipe(response);
}

function createServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    try {
      if (requestUrl.pathname.startsWith('/api/')) return apiHandler(request, response, requestUrl);
      if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      return serveStatic(response, requestUrl.pathname);
    } catch (error) {
      console.error(error);
      return sendJson(response, 500, { error: 'Internal server error', detail: serializeError(error) });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Physical AI Task Atlas listening on http://${HOST}:${PORT}`);
  });
}

module.exports = { createServer, store };
