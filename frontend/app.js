(() => {
  const state = {
    objects: [],
    selectedObjectId: null,
    selectedNodeId: null,
    selectedTaskId: null,
    objectDetail: null,
    currentTasks: [],
    graph: null,
    expandedGroups: new Set(),
    rank: 'human_frequency',
    objectQuery: ''
  };

  const elements = {
    apiStatus: document.querySelector('#api-status'),
    objectCount: document.querySelector('#object-count'),
    objectList: document.querySelector('#object-list'),
    searchForm: document.querySelector('#search-form'),
    searchInput: document.querySelector('#search-input'),
    rankSelect: document.querySelector('#rank-select'),
    resetGraph: document.querySelector('#reset-graph'),
    graphSvg: document.querySelector('#graph-svg'),
    graphEmpty: document.querySelector('#graph-empty'),
    heroTitle: document.querySelector('#hero-title'),
    heroSubtitle: document.querySelector('#hero-subtitle'),
    heroDescription: document.querySelector('#hero-description'),
    heroTags: document.querySelector('#hero-tags'),
    heroTaskCount: document.querySelector('#hero-task-count'),
    heroReview: document.querySelector('#hero-review'),
    taskListCount: document.querySelector('#task-list-count'),
    taskList: document.querySelector('#task-list'),
    inspectorType: document.querySelector('#inspector-type'),
    inspectorContent: document.querySelector('#inspector-content')
  };

  const rankLabels = {
    human_frequency: '人間頻度',
    scene_probability: 'シーン自然さ',
    robot_feasibility: 'ロボット実行可能性',
    collection_cost: '収集コスト',
    coverage_value: 'カバレッジ価値',
    transfer_value: '転用価値',
    semantic_confidence: '意味対応'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }

  function percent(value) {
    return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
  }

  function truncate(value, length = 30) {
    const text = String(value ?? '');
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  }

  function readableType(nodeType) {
    return ({
      ObjectInstance: 'OBJECT',
      ObjectClass: 'OBJECT CLASS',
      TaskInstance: 'TASK INSTANCE',
      TaskTemplate: 'TASK TEMPLATE',
      SceneType: 'SCENE',
      State: 'STATE',
      Intent: 'INTENT',
      Skill: 'SKILL',
      Affordance: 'AFFORDANCE',
      Group: 'EXPLORE GROUP'
    })[nodeType] || String(nodeType || 'NODE').toUpperCase();
  }

  function setStatus(kind, text) {
    elements.apiStatus.className = `status-pill status-${kind}`;
    elements.apiStatus.textContent = text;
  }

  async function api(path) {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
    return payload.data === undefined ? payload : payload.data;
  }

  function showError(target, error) {
    target.innerHTML = `<div class="error-state">${escapeHtml(error.message || error)}</div>`;
  }

  function renderObjectList() {
    const needle = state.objectQuery.trim().toLocaleLowerCase();
    const visible = state.objects.filter((object) => {
      if (!needle) return true;
      return [object.ycb_id, object.name_en, object.name_ja, object.category, ...(object.tags || [])]
        .filter(Boolean)
        .some((field) => String(field).toLocaleLowerCase().includes(needle));
    });
    elements.objectCount.textContent = needle ? `${visible.length}/${state.objects.length}` : String(state.objects.length);
    if (!visible.length) {
      elements.objectList.innerHTML = '<div class="empty-state">一致するオブジェクトがありません。</div>';
      return;
    }
    elements.objectList.innerHTML = visible.map((object) => `
      <button class="object-button ${object.id === state.selectedObjectId ? 'selected' : ''}" type="button" data-object-id="${escapeHtml(object.id)}">
        <span class="object-index">${escapeHtml(object.ycb_id.slice(0, 3))}</span>
        <span class="object-name"><strong>${escapeHtml(object.name_en || object.canonical_name)}</strong><small>${escapeHtml(object.name_ja)} · ${escapeHtml(object.category)}</small></span>
      </button>
    `).join('');
    elements.objectList.querySelectorAll('[data-object-id]').forEach((button) => {
      button.addEventListener('click', () => selectObject(button.dataset.objectId));
    });
  }

  function renderHero(detail) {
    const object = detail.object;
    elements.heroTitle.textContent = object.name_en || object.canonical_name;
    elements.heroSubtitle.textContent = `${object.ycb_id} · ${object.name_ja}`;
    elements.heroDescription.textContent = object.description || 'No description.';
    elements.heroTaskCount.textContent = String(detail.related_task_count ?? detail.related_tasks?.length ?? 0);
    elements.heroReview.textContent = object.review_status === 'reviewed' ? 'catalogued' : object.review_status;
    const tags = [object.category, ...(object.tags || []), ...(object.affordances || []).slice(0, 5)];
    elements.heroTags.innerHTML = tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  }

  function renderTaskList(tasks) {
    elements.taskListCount.textContent = `${tasks.length} tasks · rank: ${rankLabels[state.rank] || state.rank}`;
    if (!tasks.length) {
      elements.taskList.innerHTML = '<div class="empty-state">この条件で生成された候補はありません。</div>';
      return;
    }
    elements.taskList.innerHTML = tasks.map((task) => {
      const score = task.scores?.[state.rank];
      return `
        <button class="task-row ${task.id === state.selectedTaskId ? 'selected' : ''}" type="button" data-task-id="${escapeHtml(task.id)}">
          <span class="task-title"><strong>${escapeHtml(task.name_en)}</strong><small>${escapeHtml(task.name_ja)} · ${escapeHtml(task.scene_name_en || task.scene_id)}</small></span>
          <span class="task-score"><span class="score-line"><span>${escapeHtml(rankLabels[state.rank] || state.rank)}</span><b>${percent(score)}</b></span><span class="score-track"><i style="width:${typeof score === 'number' ? Math.round(score * 100) : 0}%"></i></span></span>
          <span class="task-status">${escapeHtml(task.review_status || 'proposed')}</span>
        </button>
      `;
    }).join('');
    elements.taskList.querySelectorAll('[data-task-id]').forEach((button) => {
      button.addEventListener('click', () => selectTask(button.dataset.taskId));
    });
  }

  function renderObjectInspector(detail) {
    const object = detail.object;
    elements.inspectorType.textContent = readableType(object.node_type);
    elements.inspectorContent.innerHTML = `
      <h2 class="detail-heading">${escapeHtml(object.name_en || object.canonical_name)}</h2>
      <p class="detail-subtitle">${escapeHtml(object.ycb_id)} · ${escapeHtml(object.name_ja)}</p>
      <p class="detail-description muted">${escapeHtml(object.description)}</p>
      <div class="detail-section">
        <h3>Catalog identity</h3>
        <dl class="kv-list">
          <div class="kv-row"><dt>Canonical ID</dt><dd>${escapeHtml(object.id)}</dd></div>
          <div class="kv-row"><dt>Category</dt><dd>${escapeHtml(object.category)}</dd></div>
          <div class="kv-row"><dt>General concept</dt><dd>${escapeHtml(detail.general_concept?.name_en || object.general_concept_id)}</dd></div>
          <div class="kv-row"><dt>Catalog status</dt><dd>${escapeHtml(object.review_status)}</dd></div>
        </dl>
      </div>
      <div class="detail-section">
        <h3>Affordance</h3>
        <div class="tag-row">${(object.affordances || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}</div>
      </div>
      <div class="detail-section">
        <h3>Atlas coverage</h3>
        <p class="muted">このオブジェクトに紐づくTaskInstanceは ${escapeHtml(detail.related_task_count)} 件です。深い意味注釈は現在 mustard vertical slice に限定されています。</p>
      </div>
      <div class="warning-box">Object catalog membership is reviewed. Task candidates below are still <strong>proposed</strong> and must not be read as observed human frequency.</div>
    `;
  }

  function renderGroupInspector(node) {
    elements.inspectorType.textContent = readableType(node.node_type);
    elements.inspectorContent.innerHTML = `
      <h2 class="detail-heading">${escapeHtml(node.name_en)}</h2>
      <p class="detail-subtitle">${escapeHtml(node.name_ja)} · ${escapeHtml(node.object_id)}</p>
      <p class="detail-description muted">この分類ノードを展開すると、選択中オブジェクトに関連する${escapeHtml(node.name_ja)}の候補が表示されます。</p>
      <div class="detail-section"><h3>Nodes in group</h3><p class="metric-card"><strong>${escapeHtml(node.count)}</strong><small>click the group to expand / collapse</small></p></div>
      <div class="warning-box">グループの展開は表示操作です。展開されたTaskもEvidenceとreview_statusを保持します。</div>
    `;
  }

  function renderEntityInspector(node) {
    elements.inspectorType.textContent = readableType(node.node_type);
    elements.inspectorContent.innerHTML = `
      <h2 class="detail-heading">${escapeHtml(node.name_en || node.label)}</h2>
      <p class="detail-subtitle">${escapeHtml(node.name_ja || '')}</p>
      <p class="detail-description muted">${escapeHtml(node.description || 'このノードを中心に関連タスクを探索できます。')}</p>
      <div class="detail-section"><h3>Node identity</h3><dl class="kv-list"><div class="kv-row"><dt>ID</dt><dd>${escapeHtml(node.id)}</dd></div><div class="kv-row"><dt>Type</dt><dd>${escapeHtml(readableType(node.node_type))}</dd></div></dl></div>
      <div class="warning-box">意味、頻度、実行可能性は別々の軸で評価します。単一スコアは表示していません。</div>
    `;
  }

  function scoreEntries(scores) {
    const keys = ['physical_affordance', 'functional_fit', 'human_frequency', 'scene_probability', 'semantic_confidence', 'robot_feasibility', 'safety', 'collection_cost', 'coverage_value', 'transfer_value'];
    return keys.filter((key) => scores && typeof scores[key] === 'number').map((key) => `
      <div class="score-item"><span>${escapeHtml(rankLabels[key] || key.replace(/_/g, ' '))}</span><strong>${percent(scores[key])}</strong></div>
    `).join('');
  }

  function renderTaskInspector(detail) {
    const task = detail.task;
    elements.inspectorType.textContent = readableType(task.node_type);
    const evidence = (detail.evidence || []).map((item) => `
      <li class="evidence-card"><strong>Level ${escapeHtml(item.evidence_level)} · ${escapeHtml(item.source_name)}</strong><span>${escapeHtml(item.notes)}</span></li>
    `).join('');
    elements.inspectorContent.innerHTML = `
      <h2 class="detail-heading">${escapeHtml(task.name_en)}</h2>
      <p class="detail-subtitle">${escapeHtml(task.name_ja)} · ${escapeHtml(task.id)}</p>
      <div class="tag-row"><span class="tag">${escapeHtml(task.review_status)}</span><span class="tag">${escapeHtml(detail.template?.id || task.template_id)}</span><span class="tag">${escapeHtml(detail.scene?.name_en || task.scene_id)}</span></div>
      <div class="detail-section"><h3>Template / intent</h3><dl class="kv-list"><div class="kv-row"><dt>Template</dt><dd>${escapeHtml(detail.template?.name_en || task.template_id)}</dd></div><div class="kv-row"><dt>Intent</dt><dd>${escapeHtml(detail.intent?.name_en || task.intent_id)}</dd></div><div class="kv-row"><dt>Object</dt><dd>${escapeHtml(detail.object?.name_en || task.object_id)}</dd></div><div class="kv-row"><dt>Scene</dt><dd>${escapeHtml(detail.scene?.name_en || task.scene_id)}</dd></div></dl></div>
      <div class="detail-section"><h3>Initial state</h3><ul class="state-list">${(task.initial_state || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      <div class="detail-section"><h3>Goal state</h3><ul class="state-list">${(task.goal_state || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      <div class="detail-section"><h3>Required skills</h3><ul class="skill-list">${(detail.skills || []).map((skill) => `<li>${escapeHtml(skill.name_en)} <span class="muted">· ${escapeHtml(skill.name_ja)}</span></li>`).join('')}</ul></div>
      <div class="detail-section"><h3>Scores / prioritization hypotheses</h3><div class="score-grid">${scoreEntries(task.scores)}</div></div>
      <div class="detail-section"><h3>Evidence</h3><ul class="evidence-list">${evidence || '<li class="muted">Evidence not attached.</li>'}</ul></div>
      <div class="warning-box">このTaskInstanceは <strong>${escapeHtml(task.review_status)}</strong> です。Evidence level Fを含むため、現実の行動頻度や実行成功を確認したデータとして扱わないでください。</div>
    `;
  }

  function nodeClass(node) {
    if (node.node_type === 'ObjectInstance') return 'node-object';
    if (node.node_type === 'Group') return 'node-group';
    if (node.node_type === 'TaskInstance') return 'node-task';
    if (node.node_type === 'Affordance') return 'node-affordance';
    return node.node_type === 'ObjectClass' ? 'node-class' : 'node-context';
  }

  function mergeGraph(fragment, parentGroupId = null) {
    if (!state.graph) {
      state.graph = { ...fragment, nodes: [], edges: [] };
    }
    const nodesById = new Map(state.graph.nodes.map((node) => [node.id, node]));
    for (const node of fragment.nodes || []) {
      const previous = nodesById.get(node.id);
      nodesById.set(node.id, { ...(previous || {}), ...node, ...(parentGroupId && node.node_type !== 'Group' ? { parent_group: parentGroupId } : {}) });
    }
    const edgesById = new Map(state.graph.edges.map((edge) => [edge.id, edge]));
    for (const edge of fragment.edges || []) edgesById.set(edge.id, edge);
    state.graph.nodes = [...nodesById.values()];
    state.graph.edges = [...edgesById.values()];
  }

  function collapseGroup(groupId) {
    if (!state.graph) return;
    const childIds = new Set(state.graph.nodes.filter((node) => node.parent_group === groupId).map((node) => node.id));
    state.graph.nodes = state.graph.nodes.filter((node) => !childIds.has(node.id));
    state.graph.edges = state.graph.edges.filter((edge) => !childIds.has(edge.source) && !childIds.has(edge.target));
    state.expandedGroups.delete(groupId);
  }

  function svgText(x, y, text, className, anchor = 'start') {
    return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
  }

  function layoutGraph(graph) {
    const nodes = graph.nodes || [];
    const groups = nodes.filter((node) => node.node_type === 'Group');
    const root = nodes.find((node) => node.id === graph.center_id) || nodes[0];
    const positions = new Map();
    const blocks = [];
    let cursor = 36;
    for (const group of groups) {
      const children = nodes.filter((node) => node.parent_group === group.id);
      const blockHeight = Math.max(58, children.length * 31);
      const groupY = cursor + blockHeight / 2;
      positions.set(group.id, { x: 291, y: groupY });
      children.forEach((child, index) => positions.set(child.id, { x: 584, y: cursor + 18 + index * 31 }));
      blocks.push({ group, y: groupY });
      cursor += blockHeight + 19;
    }
    const unparented = nodes.filter((node) => !positions.has(node.id) && node.id !== root?.id && node.node_type !== 'Group');
    unparented.forEach((node, index) => positions.set(node.id, { x: 584, y: 44 + index * 42 }));
    const height = Math.max(478, cursor + 24, 90 + unparented.length * 42);
    if (root) positions.set(root.id, { x: 77, y: Math.max(86, height / 2) });
    return { positions, width: 880, height };
  }

  function renderGraph() {
    const graph = state.graph;
    if (!graph || !graph.nodes?.length) {
      elements.graphSvg.innerHTML = '';
      elements.graphEmpty.classList.remove('hidden');
      return;
    }
    elements.graphEmpty.classList.add('hidden');
    const layout = layoutGraph(graph);
    elements.graphSvg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    elements.graphSvg.setAttribute('width', layout.width);
    elements.graphSvg.setAttribute('height', layout.height);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgeMarkup = (graph.edges || []).map((edge) => {
      const source = layout.positions.get(edge.source);
      const target = layout.positions.get(edge.target);
      if (!source || !target) return '';
      const x1 = source.x + (edge.source === graph.center_id ? 106 : 86);
      const x2 = target.x - (nodeById.get(edge.target)?.node_type === 'TaskInstance' ? 108 : 80);
      const y1 = source.y;
      const y2 = target.y;
      const label = edge.relation === 'contains' || edge.relation === 'explore' ? '' : `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" class="graph-edge-label" text-anchor="middle">${escapeXml(edge.relation)}</text>`;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="graph-edge" marker-end="url(#edge-arrow)"></line>${label}`;
    }).join('');
    const nodeMarkup = graph.nodes.map((node) => {
      const position = layout.positions.get(node.id);
      if (!position) return '';
      const isSelected = node.id === state.selectedNodeId || node.id === state.selectedTaskId;
      const kind = nodeClass(node);
      const isGroup = node.node_type === 'Group';
      const isTask = node.node_type === 'TaskInstance';
      const width = isTask ? 230 : isGroup ? 166 : node.node_type === 'ObjectInstance' ? 188 : 190;
      const height = isTask ? 49 : 45;
      const x = position.x - width / 2;
      const y = position.y - height / 2;
      const primary = truncate(node.label || node.name_en || node.id, isTask ? 31 : 24);
      const secondary = isGroup ? `${node.name_ja || ''} · ${node.count}` : truncate(node.name_ja || node.node_type, isTask ? 34 : 27);
      const hint = isGroup && node.expandable ? svgText(x + width - 12, y + 17, state.expandedGroups.has(node.id) ? '−' : '+', 'node-expand-hint', 'middle') : '';
      return `<g class="graph-node ${kind} ${isSelected ? 'selected' : ''}" data-node-id="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="${escapeHtml(primary)}">
        <title>${escapeXml(node.label || node.name_en || node.id)} · ${escapeXml(node.name_ja || '')}</title>
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="11"></rect>
        ${svgText(x + 12, y + 20, primary, 'node-label')}
        ${svgText(x + 12, y + 35, secondary, 'node-sub')}
        ${hint}
      </g>`;
    }).join('');
    elements.graphSvg.innerHTML = `<defs><marker id="edge-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="rgba(143,181,205,.4)"></path></marker></defs><g>${edgeMarkup}</g><g>${nodeMarkup}</g>`;
    elements.graphSvg.querySelectorAll('[data-node-id]').forEach((nodeElement) => {
      const handler = () => handleGraphNode(nodeElement.dataset.nodeId);
      nodeElement.addEventListener('click', handler);
      nodeElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(); }
      });
    });
  }

  async function handleGraphNode(nodeId) {
    const node = state.graph?.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;
    state.selectedNodeId = nodeId;
    if (node.node_type === 'ObjectInstance') return selectObject(node.id);
    if (node.node_type === 'TaskInstance') return selectTask(node.id);
    if (node.node_type === 'Group') {
      renderGroupInspector(node);
      if (state.expandedGroups.has(node.id)) {
        collapseGroup(node.id);
      } else {
        try {
          const fragment = await api(`/api/nodes/${encodeURIComponent(node.id)}/neighbors`);
          mergeGraph(fragment, node.id);
          state.expandedGroups.add(node.id);
        } catch (error) {
          showError(elements.inspectorContent, error);
        }
      }
      renderGraph();
      return;
    }
    renderEntityInspector(node);
    renderGraph();
  }

  async function selectObject(objectId) {
    state.selectedObjectId = objectId;
    state.selectedTaskId = null;
    state.selectedNodeId = objectId;
    state.expandedGroups.clear();
    renderObjectList();
    elements.heroTitle.textContent = 'Loading…';
    try {
      const [detail, graph, tasks] = await Promise.all([
        api(`/api/objects/${encodeURIComponent(objectId)}`),
        api(`/api/nodes/${encodeURIComponent(objectId)}/neighbors`),
        api(`/api/tasks?object_id=${encodeURIComponent(objectId)}&rank=${encodeURIComponent(state.rank)}`)
      ]);
      state.objectDetail = detail;
      state.currentTasks = tasks;
      state.graph = graph;
      renderHero(detail);
      renderObjectInspector(detail);
      renderTaskList(tasks);
      renderGraph();
    } catch (error) {
      showError(elements.inspectorContent, error);
      setStatus('error', 'error');
    }
  }

  async function selectTask(taskId) {
    state.selectedTaskId = taskId;
    state.selectedNodeId = taskId;
    try {
      const [detail, graph] = await Promise.all([
        api(`/api/tasks/${encodeURIComponent(taskId)}`),
        api(`/api/nodes/${encodeURIComponent(taskId)}/neighbors`)
      ]);
      renderTaskInspector(detail);
      state.graph = graph;
      renderTaskList(state.currentTasks);
      renderGraph();
    } catch (error) {
      showError(elements.inspectorContent, error);
    }
  }

  async function searchAll(query) {
    const needle = query.trim();
    if (!needle) return;
    const exactObject = state.objects.find((object) => object.id === needle || object.ycb_id === needle || object.name_en?.toLocaleLowerCase() === needle.toLocaleLowerCase());
    if (exactObject) return selectObject(exactObject.id);
    try {
      const results = await api(`/api/search?q=${encodeURIComponent(needle)}`);
      const firstObject = results.find((result) => result.result_type === 'object');
      if (firstObject) return selectObject(firstObject.id);
      const firstTask = results.find((result) => result.result_type === 'task');
      if (firstTask) return selectTask(firstTask.id);
      elements.inspectorType.textContent = 'SEARCH';
      elements.inspectorContent.innerHTML = `<h2 class="detail-heading">No direct selection</h2><p class="detail-description muted">「${escapeHtml(needle)}」の検索結果は ${results.length} 件です。</p><div class="detail-section"><ul class="state-list">${results.slice(0, 12).map((result) => `<li>${escapeHtml(result.name_en || result.label)} <span class="muted">· ${escapeHtml(readableType(result.node_type))}</span></li>`).join('') || '<li>結果なし</li>'}</ul></div>`;
    } catch (error) {
      showError(elements.inspectorContent, error);
    }
  }

  async function resetGraph() {
    if (!state.selectedObjectId) return;
    state.selectedTaskId = null;
    state.selectedNodeId = state.selectedObjectId;
    state.expandedGroups.clear();
    try {
      state.graph = await api(`/api/nodes/${encodeURIComponent(state.selectedObjectId)}/neighbors`);
      if (state.objectDetail) renderObjectInspector(state.objectDetail);
      renderGraph();
    } catch (error) {
      showError(elements.inspectorContent, error);
    }
  }

  async function init() {
    elements.searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      searchAll(elements.searchInput.value);
    });
    elements.searchInput.addEventListener('input', () => {
      state.objectQuery = elements.searchInput.value;
      renderObjectList();
    });
    elements.rankSelect.addEventListener('change', async () => {
      state.rank = elements.rankSelect.value;
      if (!state.selectedObjectId) return;
      try {
        const tasks = await api(`/api/tasks?object_id=${encodeURIComponent(state.selectedObjectId)}&rank=${encodeURIComponent(state.rank)}`);
        state.currentTasks = tasks;
        renderTaskList(tasks);
      } catch (error) {
        showError(elements.taskList, error);
      }
    });
    elements.resetGraph.addEventListener('click', resetGraph);
    try {
      const [health, objects] = await Promise.all([api('/api/health'), api('/api/objects')]);
      state.objects = objects;
      renderObjectList();
      setStatus('ok', `${health.seed_counts.objects} objects ready`);
      const mustard = state.objects.find((object) => object.ycb_id === '006_mustard_bottle') || state.objects[0];
      if (mustard) await selectObject(mustard.id);
    } catch (error) {
      setStatus('error', 'offline');
      showError(elements.objectList, error);
      showError(elements.taskList, error);
    }
  }

  init();
})();
