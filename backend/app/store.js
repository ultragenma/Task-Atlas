const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_DIR = path.join(ROOT, 'data', 'seeds');

const RANK_DIRECTIONS = Object.freeze({
  human_frequency: 'desc',
  scene_probability: 'desc',
  robot_feasibility: 'desc',
  collection_cost: 'asc',
  coverage_value: 'desc',
  transfer_value: 'desc',
  semantic_confidence: 'desc'
});

const RANK_LABELS = Object.freeze({
  human_frequency: '人間頻度（仮説）',
  scene_probability: 'シーン自然さ',
  robot_feasibility: 'ロボット実行可能性',
  collection_cost: '収集コスト（低い順）',
  coverage_value: 'カバレッジ価値',
  transfer_value: '転用価値',
  semantic_confidence: '意味対応の信頼度'
});

const SEED_FILES = Object.freeze({
  objects: 'objects.json',
  scenes: 'scenes.json',
  states: 'states.json',
  intents: 'intents.json',
  skills: 'skills.json',
  taskTemplates: 'task_templates.json',
  tasks: 'mustard_tasks.json',
  evidence: 'evidence.json'
});

function readSeed(filename) {
  const filepath = path.join(SEED_DIR, filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en', { sensitivity: 'base' });
}

function unique(items) {
  return [...new Set(items)];
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scoreValue(task, key) {
  const value = task.scores && task.scores[key];
  return typeof value === 'number' ? value : null;
}

function sortTasks(tasks, rank = 'human_frequency') {
  const direction = RANK_DIRECTIONS[rank] || RANK_DIRECTIONS.human_frequency;
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((left, right) => {
    const leftScore = scoreValue(left, rank);
    const rightScore = scoreValue(right, rank);
    if (leftScore === null && rightScore !== null) return 1;
    if (leftScore !== null && rightScore === null) return -1;
    if (leftScore !== rightScore) {
      return ((leftScore ?? 0) - (rightScore ?? 0)) * multiplier;
    }
    return compareText(left.name_en || left.id, right.name_en || right.id);
  });
}

function taskSummary(task, maps) {
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
    intent_name_en: maps.intents.get(task.intent_id)?.name_en || task.intent_id,
    scores: task.scores,
    evidence_ids: task.evidence_ids,
    review_status: task.review_status,
    state_ids: task.state_ids || [],
    skills: task.skills || []
  };
}

function nodeFromRecord(record, extra = {}) {
  if (!record) return null;
  const label = record.name_en || record.canonical_name || record.id;
  return {
    id: record.id,
    node_type: record.node_type || extra.node_type || 'Node',
    label,
    name_en: label,
    name_ja: record.name_ja || label,
    ...extra
  };
}

function addNode(nodes, node) {
  if (!node || nodes.some((existing) => existing.id === node.id)) return;
  nodes.push(node);
}

function addEdge(edges, source, target, relation) {
  if (!source || !target || source === target) return;
  const id = `${source}|${relation}|${target}`;
  if (edges.some((edge) => edge.id === id)) return;
  edges.push({ id, source, target, relation });
}

function createStore() {
  const data = Object.fromEntries(
    Object.entries(SEED_FILES).map(([key, filename]) => [key, readSeed(filename)])
  );
  const maps = {
    objects: asMap(data.objects),
    scenes: asMap(data.scenes),
    states: asMap(data.states),
    intents: asMap(data.intents),
    skills: asMap(data.skills),
    taskTemplates: asMap(data.taskTemplates),
    tasks: asMap(data.tasks),
    evidence: asMap(data.evidence)
  };

  function listObjects(query = '') {
    const needle = query.trim().toLocaleLowerCase();
    return data.objects
      .filter((object) => {
        if (!needle) return true;
        return [object.id, object.ycb_id, object.canonical_name, object.name_en, object.name_ja, object.category, ...(object.tags || [])]
          .filter(Boolean)
          .some((field) => String(field).toLocaleLowerCase().includes(needle));
      })
      .sort((left, right) => compareText(left.ycb_id, right.ycb_id));
  }

  function getObject(id) {
    return maps.objects.get(id) || null;
  }

  function getTask(id) {
    return maps.tasks.get(id) || null;
  }

  function listTasks(filters = {}) {
    const needle = String(filters.q || '').trim().toLocaleLowerCase();
    let result = data.tasks.filter((task) => {
      if (filters.object_id && task.object_id !== filters.object_id) return false;
      if (filters.scene_id && task.scene_id !== filters.scene_id) return false;
      if (filters.intent_id && task.intent_id !== filters.intent_id) return false;
      if (filters.skill_id && !(task.skills || []).includes(filters.skill_id)) return false;
      if (!needle) return true;
      return [task.id, task.name_en, task.name_ja, task.template_id, task.intent_id, task.scene_id]
        .filter(Boolean)
        .some((field) => String(field).toLocaleLowerCase().includes(needle));
    });
    result = sortTasks(result, filters.rank);
    return result.map((task) => taskSummary(task, maps));
  }

  function getObjectDetail(id) {
    const object = getObject(id);
    if (!object) return null;
    const relatedTasks = listTasks({ object_id: id });
    const concepts = data.objects.filter((candidate) => candidate.general_concept_id === object.general_concept_id);
    return {
      object: clone(object),
      related_tasks: relatedTasks,
      related_task_count: relatedTasks.length,
      general_concept: {
        id: object.general_concept_id,
        name_en: titleCase(object.general_concept_id.replace(/^object_/, '')),
        related_object_count: concepts.length
      }
    };
  }

  function getTaskDetail(id) {
    const task = getTask(id);
    if (!task) return null;
    const template = maps.taskTemplates.get(task.template_id);
    const evidence = (task.evidence_ids || []).map((evidenceId) => maps.evidence.get(evidenceId)).filter(Boolean);
    return {
      task: clone(task),
      template: clone(template),
      object: clone(maps.objects.get(task.object_id)),
      scene: clone(maps.scenes.get(task.scene_id)),
      intent: clone(maps.intents.get(task.intent_id)),
      states: (task.state_ids || []).map((stateId) => maps.states.get(stateId)).filter(Boolean).map(clone),
      skills: (task.skills || []).map((skillId) => maps.skills.get(skillId)).filter(Boolean).map(clone),
      evidence: evidence.map(clone)
    };
  }

  function groupDefinitions(objectId) {
    const object = getObject(objectId);
    if (!object) return [];
    const related = data.tasks.filter((task) => task.object_id === objectId);
    const states = unique(related.flatMap((task) => task.state_ids || []));
    const scenes = unique(related.map((task) => task.scene_id));
    const intents = unique(related.map((task) => task.intent_id));
    const skills = unique(related.flatMap((task) => task.skills || []));
    return [
      { key: 'affordances', label: 'Affordance', label_ja: '物理的可能性', count: object.affordances?.length || 0 },
      { key: 'states', label: 'State', label_ja: '状態', count: states.length },
      { key: 'scenes', label: 'Scene', label_ja: 'シーン', count: scenes.length },
      { key: 'intents', label: 'Intent', label_ja: '目的', count: intents.length },
      { key: 'tasks', label: 'Task', label_ja: 'タスク', count: related.length },
      { key: 'skills', label: 'Skill', label_ja: 'スキル', count: skills.length }
    ];
  }

  function groupNode(objectId, definition) {
    return {
      id: `group:${objectId}:${definition.key}`,
      node_type: 'Group',
      label: `${definition.label} · ${definition.count}`,
      name_en: definition.label,
      name_ja: definition.label_ja,
      group_key: definition.key,
      object_id: objectId,
      count: definition.count,
      expandable: definition.count > 0
    };
  }

  function objectNeighborhood(objectId) {
    const object = getObject(objectId);
    if (!object) return null;
    const nodes = [];
    const edges = [];
    addNode(nodes, nodeFromRecord(object, { selected: true }));
    if (object.general_concept_id) {
      const concept = {
        id: `concept:${object.general_concept_id}`,
        node_type: 'ObjectClass',
        label: titleCase(object.general_concept_id.replace(/^object_/, '')),
        name_en: titleCase(object.general_concept_id.replace(/^object_/, '')),
        name_ja: '一般物体概念'
      };
      addNode(nodes, concept);
      addEdge(edges, object.id, concept.id, 'instance_of');
    }
    for (const definition of groupDefinitions(objectId)) {
      const group = groupNode(objectId, definition);
      addNode(nodes, group);
      addEdge(edges, object.id, group.id, 'explore');
    }
    return { center_id: objectId, nodes, edges, expanded: [] };
  }

  function groupChildren(objectId, key) {
    const object = getObject(objectId);
    if (!object) return null;
    const definition = groupDefinitions(objectId).find((item) => item.key === key);
    if (!definition) return null;
    const group = groupNode(objectId, definition);
    const nodes = [group];
    const edges = [];
    const related = data.tasks.filter((task) => task.object_id === objectId);
    let childIds = [];
    if (key === 'affordances') childIds = object.affordances || [];
    if (key === 'states') childIds = unique(related.flatMap((task) => task.state_ids || []));
    if (key === 'scenes') childIds = unique(related.map((task) => task.scene_id));
    if (key === 'intents') childIds = unique(related.map((task) => task.intent_id));
    if (key === 'tasks') childIds = related.map((task) => task.id);
    if (key === 'skills') childIds = unique(related.flatMap((task) => task.skills || []));

    for (const childId of childIds) {
      let child;
      if (key === 'affordances') {
        child = { id: `affordance:${childId}`, node_type: 'Affordance', label: titleCase(childId), name_en: titleCase(childId), name_ja: '物理的可能性' };
      } else if (key === 'tasks') {
        child = nodeFromRecord(maps.tasks.get(childId), taskSummary(maps.tasks.get(childId), maps));
      } else {
        const mapName = { states: 'states', scenes: 'scenes', intents: 'intents', skills: 'skills' }[key];
        child = nodeFromRecord(maps[mapName].get(childId));
      }
      if (!child) continue;
      addNode(nodes, child);
      addEdge(edges, group.id, child.id, 'contains');
    }
    return { center_id: group.id, nodes, edges, expanded: [group.id] };
  }

  function taskNeighborhood(taskId) {
    const task = getTask(taskId);
    if (!task) return null;
    const nodes = [];
    const edges = [];
    addNode(nodes, nodeFromRecord(task, { ...taskSummary(task, maps), selected: true }));
    const relatedRecords = [
      ['template', maps.taskTemplates.get(task.template_id), 'uses_template'],
      ['object', maps.objects.get(task.object_id), 'acts_on'],
      ['scene', maps.scenes.get(task.scene_id), 'compatible_with_scene'],
      ['intent', maps.intents.get(task.intent_id), 'serves_intent']
    ];
    for (const [, record, relation] of relatedRecords) {
      const node = nodeFromRecord(record);
      if (!node) continue;
      addNode(nodes, node);
      addEdge(edges, task.id, node.id, relation);
    }
    for (const skillId of task.skills || []) {
      const node = nodeFromRecord(maps.skills.get(skillId));
      if (!node) continue;
      addNode(nodes, node);
      addEdge(edges, task.id, node.id, 'requires');
    }
    for (const stateId of task.state_ids || []) {
      const node = nodeFromRecord(maps.states.get(stateId));
      if (!node) continue;
      addNode(nodes, node);
      addEdge(edges, task.id, node.id, 'has_state');
    }
    return { center_id: taskId, nodes, edges, expanded: [] };
  }

  function entityNeighborhood(nodeId) {
    const recordMaps = [maps.scenes, maps.states, maps.intents, maps.skills];
    const record = recordMaps.map((map) => map.get(nodeId)).find(Boolean);
    if (!record) return null;
    const matching = data.tasks.filter((task) =>
      task.scene_id === nodeId ||
      task.intent_id === nodeId ||
      (task.state_ids || []).includes(nodeId) ||
      (task.skills || []).includes(nodeId)
    );
    const nodes = [nodeFromRecord(record, { selected: true })];
    const edges = [];
    for (const task of matching) {
      addNode(nodes, nodeFromRecord(task, taskSummary(task, maps)));
      addEdge(edges, nodeId, task.id, 'participates_in');
    }
    return { center_id: nodeId, nodes, edges, expanded: [] };
  }

  function neighbors(nodeId) {
    if (maps.objects.has(nodeId)) return objectNeighborhood(nodeId);
    if (maps.tasks.has(nodeId)) return taskNeighborhood(nodeId);
    const groupMatch = /^group:([^:]+):(affordances|states|scenes|intents|tasks|skills)$/.exec(nodeId);
    if (groupMatch) return groupChildren(groupMatch[1], groupMatch[2]);
    return entityNeighborhood(nodeId);
  }

  function generateTasks(objectId, sceneId) {
    const object = getObject(objectId);
    if (!object) return null;
    const seeded = listTasks({ object_id: objectId, scene_id: sceneId });
    if (seeded.length) {
      return { mode: 'seeded_instances', object_id: objectId, scene_id: sceneId || null, candidates: seeded };
    }
    const candidates = data.taskTemplates
      .filter((template) => !sceneId || (template.compatible_scenes || []).includes(sceneId))
      .filter((template) => {
        const requiresDispense = template.id === 'apply_condiment';
        return !requiresDispense || (object.affordances || []).includes('dispensable');
      })
      .map((template) => ({
        id: `proposal_${template.id}_${objectId}`,
        node_type: 'TaskInstance',
        name_en: `${template.name_en} · ${object.name_en || object.canonical_name}`,
        name_ja: `${object.name_ja}：${template.name_ja}`,
        template_id: template.id,
        object_id: objectId,
        scene_id: sceneId || (template.compatible_scenes || [])[0] || null,
        bindings: { theme: objectId },
        initial_state: [],
        goal_state: [],
        skills: template.skills,
        scores: {},
        evidence_ids: ['evidence_mvp_seed'],
        review_status: 'proposed',
        generated: true,
        generation_note: 'Template compatibility candidate; role binding and preconditions still require review.'
      }));
    return { mode: 'template_candidates', object_id: objectId, scene_id: sceneId || null, candidates };
  }

  function search(query) {
    const needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle) return [];
    const results = [];
    for (const object of data.objects) {
      if ([object.id, object.ycb_id, object.canonical_name, object.name_en, object.name_ja].some((field) => String(field).toLocaleLowerCase().includes(needle))) {
        results.push(nodeFromRecord(object, { result_type: 'object' }));
      }
    }
    for (const task of data.tasks) {
      if ([task.id, task.name_en, task.name_ja, task.template_id].some((field) => String(field).toLocaleLowerCase().includes(needle))) {
        results.push(nodeFromRecord(task, { ...taskSummary(task, maps), result_type: 'task' }));
      }
    }
    for (const collection of [data.scenes, data.states, data.intents, data.skills]) {
      for (const record of collection) {
        if ([record.id, record.name_en, record.name_ja].some((field) => String(field).toLocaleLowerCase().includes(needle))) {
          results.push(nodeFromRecord(record, { result_type: record.node_type.toLocaleLowerCase() }));
        }
      }
    }
    return results.slice(0, 80);
  }

  return {
    root: ROOT,
    data,
    maps,
    rankDirections: RANK_DIRECTIONS,
    rankLabels: RANK_LABELS,
    listObjects,
    getObject,
    getTask,
    listTasks,
    getObjectDetail,
    getTaskDetail,
    neighbors,
    generateTasks,
    search,
    getScenes: () => clone(data.scenes),
    getStates: () => clone(data.states),
    getIntents: () => clone(data.intents),
    getSkills: () => clone(data.skills),
    getTemplates: () => clone(data.taskTemplates),
    getEvidence: () => clone(data.evidence)
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function tasksToCsv(tasks, maps) {
  const columns = [
    'id', 'name_en', 'name_ja', 'template_id', 'object_id', 'scene_id', 'intent_id',
    'review_status', 'evidence_levels', 'human_frequency', 'scene_probability',
    'robot_feasibility', 'collection_cost', 'coverage_value', 'transfer_value'
  ];
  const lines = [columns.join(',')];
  for (const task of tasks) {
    const evidenceLevels = (task.evidence_ids || [])
      .map((id) => maps.evidence.get(id)?.evidence_level)
      .filter(Boolean)
      .join('|');
    const row = [
      task.id, task.name_en, task.name_ja, task.template_id, task.object_id, task.scene_id,
      task.intent_id, task.review_status, evidenceLevels,
      task.scores?.human_frequency, task.scores?.scene_probability,
      task.scores?.robot_feasibility, task.scores?.collection_cost,
      task.scores?.coverage_value, task.scores?.transfer_value
    ];
    lines.push(row.map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  createStore,
  tasksToCsv,
  RANK_DIRECTIONS,
  RANK_LABELS
};
