(() => {
  const UI = {
    en: {
      unspecified: "Unspecified (unknown)",
      unknown: "Unknown",
      noneConfirmed: "None confirmed",
      candidates: "candidates",
      readyNote:
        "Only declared-ready candidates are shown. This is not proof of robot success.",
      exploreNote:
        "Explore retains non-ready candidates and explains what would change their assessment.",
      noReady: "No candidates meet the declared requirements.",
      noCandidates: "No candidates are available.",
      noObjects: "No matching objects.",
      noNode: "No matching node.",
      graphHint:
        "Explore this node’s typed relationships with the active graph lens.",
      taskHint: "Open for assessment details",
      source: "Source",
      sourceIds: "Source IDs",
      noSource: "No supporting source recorded.",
      noSourceLimitations: "No source limitations recorded.",
      scopeUnknown: "Scope unknown",
      limitationsUnknown: "No limitations recorded.",
      goalMissing: "Goal criteria are not recorded.",
      initialUnknown: "Initial conditions are unknown.",
      capabilityMissing: "No capability inventory is recorded.",
      assessmentMissing: "No assessment reasons were returned.",
      timeUnknown: "unknown",
      noProcedure: "No procedure is required to define this task goal.",
      noProcedureChoice: "No procedure selected",
      noSteps: "Steps have not been proposed.",
      frequencyUnknown:
        "Unknown unless a claim above records a direct observation or scoped estimate.",
      catalogCaveat:
        "Catalog identity does not establish task frequency or robot execution.",
      collection: "Collection preparation",
      goals: "Goal and success criteria",
      initial: "Initial state",
      capabilities: "Capability inventory (unordered)",
      assessment: "Assessment",
      procedures: "Procedures are alternatives",
      claims: "Claims, sources, and limitations",
      frequency: "Frequency",
      setup: "Setup",
      reset: "Reset",
      quality: "Quality checks",
      consumables: "Consumables",
      download: "Download collection card",
      unknownAffordances: "No affordances have been reviewed.",
    },
    ja: {
      unspecified: "未指定（不明）",
      unknown: "不明",
      noneConfirmed: "なし（確認済み）",
      candidates: "件の候補",
      readyNote:
        "宣言済み要件を満たす候補だけを表示します。これはロボット成功の証明ではありません。",
      exploreNote: "探索では、成立しない候補も必要な変更とともに表示します。",
      noReady: "宣言済み要件を満たす候補はありません。",
      noCandidates: "利用できる候補はありません。",
      noObjects: "一致する物体はありません。",
      noNode: "一致するノードはありません。",
      graphHint: "現在のグラフレンズで、このノードの型付き関係を探索します。",
      taskHint: "評価詳細を開く",
      source: "出典",
      sourceIds: "出典ID",
      noSource: "対応する出典は記録されていません。",
      noSourceLimitations: "出典の制約は記録されていません。",
      scopeUnknown: "対象範囲は不明です",
      limitationsUnknown: "制約は記録されていません。",
      goalMissing: "目標条件は記録されていません。",
      initialUnknown: "初期条件は不明です。",
      capabilityMissing: "能力インベントリは記録されていません。",
      assessmentMissing: "評価理由は返却されませんでした。",
      timeUnknown: "不明",
      noProcedure: "この目標定義には固定手順を必要としません。",
      noProcedureChoice: "手順を選択しない",
      noSteps: "手順ステップは提案されていません。",
      frequencyUnknown:
        "直接観測または対象範囲を持つ推定が主張として記録されない限り、頻度は不明です。",
      catalogCaveat:
        "カタログ上の同定は、タスク頻度やロボット実行を裏づけません。",
      collection: "収集準備",
      goals: "目標と成功条件",
      initial: "初期状態",
      capabilities: "能力インベントリ（順序なし）",
      assessment: "評価",
      procedures: "手順は代替案です",
      claims: "主張・出典・制約",
      frequency: "頻度",
      setup: "セットアップ",
      reset: "リセット",
      quality: "品質確認",
      consumables: "消耗品",
      download: "収集カードをダウンロード",
      unknownAffordances: "アフォーダンスはまだレビューされていません。",
    },
  };

  const state = {
    language: localStorage.getItem("atlas-lang") || "en",
    objects: [],
    selectedObjectId: null,
    selectedTaskId: null,
    selectedProcedureId: null,
    selectedNodeId: null,
    taskDetail: null,
    tasks: [],
    graph: null,
    history: [],
    lens: "all",
    requestVersion: 0,
    graphVersion: 0,
    contextOptions: null,
    context: {
      scene_id: "",
      contents: "unknown",
      role: "unknown",
      profile: "unknown",
      available_objects: null,
      capabilities: null,
      confirmed_conditions: null,
      blocked_conditions: [],
      mode: "explore",
    },
  };

  const byId = (id) => document.getElementById(id);
  const elements = {
    objects: byId("objects"),
    objectCount: byId("object-count"),
    status: byId("status"),
    heroTitle: byId("hero-title"),
    heroSubtitle: byId("hero-subtitle"),
    heroDescription: byId("hero-description"),
    heroTags: byId("hero-tags"),
    scene: byId("scene"),
    contents: byId("contents"),
    role: byId("role"),
    profile: byId("profile"),
    checks: byId("checks"),
    blockers: byId("blockers"),
    graph: byId("graph"),
    empty: byId("empty"),
    crumbs: byId("crumbs"),
    back: byId("back"),
    taskCount: byId("task-count"),
    taskList: byId("task-list"),
    modeNote: byId("mode-note"),
    inspectorType: byId("inspector-type"),
    inspector: byId("inspector"),
    search: byId("search"),
    language: byId("language"),
  };

  const text = (key) => UI[state.language][key] || UI.en[key] || key;
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>'"]/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#039;",
          '"': "&quot;",
        })[character],
    );
  const safeHttpUrl = (value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  };
  const readable = (value) => String(value || "unknown").replace(/_/g, " ");
  const label = (item) =>
    state.language === "ja"
      ? item?.name_ja ||
        item?.label_ja ||
        item?.label ||
        item?.name_en ||
        item?.id
      : item?.name_en || item?.label || item?.name_ja || item?.id;

  function contextQuery() {
    const query = new URLSearchParams();
    const context = state.context;
    for (const key of ["scene_id", "contents", "role", "profile", "mode"]) {
      if (context[key]) query.set(key, context[key]);
    }
    for (const key of [
      "available_objects",
      "capabilities",
      "confirmed_conditions",
      "blocked_conditions",
    ]) {
      if (Array.isArray(context[key])) query.set(key, context[key].join(","));
    }
    return query.toString();
  }

  async function api(path) {
    const response = await fetch(path, {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || `Request failed: ${response.status}`);
    return payload.data === undefined ? payload : payload.data;
  }

  function renderError(target, reason) {
    target.innerHTML = `<div class="message">${escapeHtml(reason.message || reason)}</div>`;
  }

  function setStaticLanguage() {
    document.documentElement.lang = state.language;
    elements.language.textContent = state.language === "en" ? "日本語" : "EN";
    document.querySelectorAll("[data-copy]").forEach((node) => {
      const key = node.dataset.copy;
      const value =
        node.dataset[`copy${state.language === "ja" ? "Ja" : "En"}`];
      if (value) node.textContent = value;
      else if (key && UI[state.language][key])
        node.textContent = UI[state.language][key];
    });
    elements.search.placeholder =
      state.language === "ja"
        ? "物体・シーン・タスクを検索"
        : "Search object, scene, or task";
  }

  function renderLanguage() {
    setStaticLanguage();
    renderContextOptions(state.contextOptions);
    renderObjects();
    renderTasks(state.tasks);
    if (state.taskDetail) renderTaskInspector(state.taskDetail);
    if (state.graph) renderGraph();
  }

  function populateSelect(select, items, selected, includeUnspecified = true) {
    const unspecified = includeUnspecified
      ? `<option value="">${escapeHtml(text("unspecified"))}</option>`
      : "";
    select.innerHTML =
      unspecified +
      (items || [])
        .map(
          (item) =>
            `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(label(item))}</option>`,
        )
        .join("");
  }

  function checkedValues(fieldset) {
    return [...fieldset.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.value,
    );
  }

  function renderContextOptions(options) {
    if (!options) return;
    state.contextOptions = options;
    populateSelect(
      elements.scene,
      options.scenes || [],
      state.context.scene_id,
    );
    populateSelect(
      elements.contents,
      options.contents || [],
      state.context.contents,
      false,
    );
    populateSelect(
      elements.role,
      options.roles || [],
      state.context.role,
      false,
    );
    populateSelect(
      elements.profile,
      options.profiles || [],
      state.context.profile,
      false,
    );
    populateSelect(
      elements.blockers,
      options.blocked_conditions || [],
      "",
      false,
    );
    [...elements.blockers.options].forEach((option) => {
      option.selected = state.context.blocked_conditions.includes(option.value);
    });

    const groups = [
      [
        "available_objects",
        state.language === "ja" ? "利用可能な資源" : "Available resources",
        options.resources,
      ],
      [
        "capabilities",
        state.language === "ja" ? "利用可能な能力" : "Available capabilities",
        options.capabilities,
      ],
      [
        "confirmed_conditions",
        state.language === "ja" ? "確認済み条件" : "Confirmed conditions",
        options.conditions,
      ],
    ];
    elements.checks.innerHTML = groups
      .map(([key, title, items]) => {
        const values = state.context[key];
        return `<fieldset data-context-key="${key}">
        <legend>${escapeHtml(title)}</legend>
        <label><input type="radio" name="${key}" value="unknown" ${values === null ? "checked" : ""}> ${escapeHtml(text("unknown"))}</label>
        <label><input type="radio" name="${key}" value="none" ${Array.isArray(values) && values.length === 0 ? "checked" : ""}> ${escapeHtml(text("noneConfirmed"))}</label>
        <div class="check-list">${(items || [])
          .map(
            (item) =>
              `<label><input type="checkbox" value="${escapeHtml(item.id)}" ${Array.isArray(values) && values.includes(item.id) ? "checked" : ""}> ${escapeHtml(label(item))}</label>`,
          )
          .join("")}</div>
      </fieldset>`;
      })
      .join("");

    elements.checks.querySelectorAll("fieldset").forEach((fieldset) => {
      fieldset.addEventListener("change", (event) => {
        const key = fieldset.dataset.contextKey;
        if (event.target.matches('input[type="checkbox"]')) {
          // A checkbox means the person has declared the list. Never leave it unknown.
          fieldset.querySelector('input[value="none"]').checked = false;
          fieldset.querySelector('input[value="unknown"]').checked = false;
          state.context[key] = checkedValues(fieldset);
        } else {
          const choice = fieldset.querySelector(
            `input[name="${key}"]:checked`,
          )?.value;
          fieldset
            .querySelectorAll('input[type="checkbox"]')
            .forEach((checkbox) => {
              checkbox.checked = false;
            });
          state.context[key] = choice === "unknown" ? null : [];
        }
        refreshContext();
      });
    });
  }

  function renderObjects() {
    const search = elements.search.value.trim().toLowerCase();
    const rows = state.objects.filter(
      (object) =>
        !search ||
        [
          object.id,
          object.ycb_id,
          object.name_en,
          object.name_ja,
          object.category,
          ...(object.tags || []),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
    );
    elements.objectCount.textContent = search
      ? `${rows.length}/${state.objects.length}`
      : String(state.objects.length);
    elements.objects.innerHTML = rows.length
      ? rows
          .map(
            (
              object,
            ) => `<button class="object ${object.id === state.selectedObjectId ? "selected" : ""}" data-object-id="${escapeHtml(object.id)}">
      <b>${escapeHtml(object.ycb_id?.slice(0, 3) || "—")}</b>
      <span>${escapeHtml(label(object))}<small>${escapeHtml(state.language === "ja" ? object.name_en : object.name_ja || object.category || "")}</small></span>
    </button>`,
          )
          .join("")
      : `<div class="message">${escapeHtml(text("noObjects"))}</div>`;
    elements.objects.querySelectorAll("[data-object-id]").forEach((button) => {
      button.addEventListener("click", () =>
        selectObject(button.dataset.objectId),
      );
    });
  }

  function renderHero(detail) {
    const object = detail.object;
    elements.heroTitle.textContent = label(object);
    elements.heroSubtitle.textContent = `${object.ycb_id || object.id} · ${state.language === "ja" ? object.name_en : object.name_ja || object.category || ""}`;
    elements.heroDescription.textContent = object.description || "";
    elements.heroTags.innerHTML = [
      object.category,
      ...(object.tags || []),
      ...(object.affordances || []),
    ]
      .slice(0, 7)
      .map((value) => `<span>${escapeHtml(readable(value))}</span>`)
      .join("");
  }

  function assessmentFor(task) {
    return (
      task.assessment || {
        status: task.review_status || "unknown",
        reasons: [],
      }
    );
  }

  function renderTasks(rows) {
    elements.taskCount.textContent = `${rows.length} ${text("candidates")}`;
    elements.modeNote.textContent =
      state.context.mode === "ready" ? text("readyNote") : text("exploreNote");
    elements.taskList.innerHTML = rows.length
      ? rows
          .map((task) => {
            const assessment = assessmentFor(task);
            const priority = {
              safety: 0,
              unsupported: 1,
              conflict: 2,
              missing: 3,
              unknown: 4,
              satisfied: 5,
            };
            const reasons = [...(assessment.reasons || [])]
              .sort(
                (left, right) =>
                  (priority[left.kind] ?? 6) - (priority[right.kind] ?? 6),
              )
              .slice(0, 2)
              .map(
                (reason) =>
                  reason.message ||
                  `${readable(reason.kind)}: ${readable(reason.key)}`,
              )
              .join(" · ");
            return `<button class="task ${task.id === state.selectedTaskId ? "selected" : ""}" data-task-id="${escapeHtml(task.id)}">
        <span><b>${escapeHtml(label(task))}</b><small>${escapeHtml(task.scene_name_en || task.scene_id || "")}</small></span>
        <i class="assessment ${escapeHtml(assessment.status)}">${escapeHtml(readable(assessment.status))}</i>
        <small>${escapeHtml(reasons || text("taskHint"))}</small>
      </button>`;
          })
          .join("")
      : `<div class="message">${escapeHtml(state.context.mode === "ready" ? text("noReady") : text("noCandidates"))}</div>`;
    elements.taskList.querySelectorAll("[data-task-id]").forEach((button) => {
      button.addEventListener("click", () => selectTask(button.dataset.taskId));
    });
  }

  function section(title, items, empty = text("unknown")) {
    return `<section><h3>${escapeHtml(title)}</h3>${
      items?.length
        ? `<ul>${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : label(item) || item.message || item.statement || JSON.stringify(item))}</li>`).join("")}</ul>`
        : `<p class="unknown">${escapeHtml(empty)}</p>`
    }</section>`;
  }

  function renderObjectInspector(detail) {
    const object = detail.object;
    elements.inspectorType.textContent = "OBJECT";
    elements.inspector.innerHTML = `<h2>${escapeHtml(label(object))}</h2>
      <small>${escapeHtml(object.ycb_id || object.id)}</small>
      <p>${escapeHtml(object.description || "")}</p>
      ${section(state.language === "ja" ? "アフォーダンス" : "Affordances", object.affordances || [], text("unknownAffordances"))}
      ${section(
        state.language === "ja" ? "Atlasの対象範囲" : "Atlas coverage",
        [
          `${detail.related_task_count || 0} seeded task candidates`,
          `Concept: ${detail.general_concept?.name_en || object.general_concept_id || "unknown"}`,
        ],
      )}
      <aside class="warning">${escapeHtml(text("catalogCaveat"))}</aside>`;
  }

  function claimMarkup(claims, sources) {
    const sourceById = new Map(
      (sources || []).map((source) => [source.id, source]),
    );
    if (!claims?.length)
      return `<p class="unknown">${escapeHtml(text("noSource"))}</p>`;
    return claims
      .map((claim) => {
        const linked = (claim.source_ids || [])
          .map((id) => sourceById.get(id))
          .filter(Boolean);
        const sourceMarkup = linked.length
          ? linked
              .map((source) => {
                const locator = safeHttpUrl(
                  source.source_locator || source.locator,
                );
                const sourceName = escapeHtml(
                  source.source_name || source.name_en || source.id,
                );
                const sourceLink = locator
                  ? `<a href="${escapeHtml(locator)}" target="_blank" rel="noopener noreferrer">${sourceName}</a>`
                  : sourceName;
                return `<small>${escapeHtml(text("source"))}: ${sourceLink} — ${escapeHtml(source.limitations || text("noSourceLimitations"))}</small>`;
              })
              .join("")
          : `<small>${claim.source_ids?.length ? `${escapeHtml(text("sourceIds"))}: ${escapeHtml(claim.source_ids.join(", "))}` : escapeHtml(text("noSource"))}</small>`;
        return `<article class="claim">
        <b>${escapeHtml(readable(claim.claim_type))} · ${escapeHtml(claim.status)}</b>
        <p>${escapeHtml(claim.statement)}</p>
        <small>${escapeHtml(claim.scope || text("scopeUnknown"))}</small>
        <small>${escapeHtml(claim.limitations || text("limitationsUnknown"))}</small>
        ${sourceMarkup}
      </article>`;
      })
      .join("");
  }

  function renderTaskInspector(detail) {
    const task = detail.task;
    const assessment = detail.assessment || assessmentFor(task);
    const planning = detail.planning || {};
    const collection = planning.collection || detail.collection || {};
    const procedures = detail.procedures || planning.procedures || [];
    const selectedProcedure =
      procedures.find(
        (procedure) => procedure.id === state.selectedProcedureId,
      ) || null;
    if (state.selectedProcedureId && !selectedProcedure)
      state.selectedProcedureId = null;
    const activeAssessment = selectedProcedure?.assessment || assessment;
    const assessmentReasons = (candidateAssessment) =>
      (candidateAssessment?.reasons || [])
        .filter((reason) => reason.kind !== "satisfied")
        .map(
          (reason) =>
            reason.message ||
            `${readable(reason.kind)}: ${readable(reason.key)}`,
        );
    const procedureMarkup = procedures.length
      ? `<details open><summary>Proposed procedures (${procedures.length})</summary>
        <div class="procedure ${selectedProcedure ? "" : "selected"}">
          <label><input type="radio" name="procedure" value="" ${selectedProcedure ? "" : "checked"}> ${escapeHtml(text("noProcedureChoice"))}</label>
          <p class="unknown">${escapeHtml(text("noProcedure"))}</p>
        </div>
        ${procedures
          .map((procedure) => {
            const procedureAssessment = procedure.assessment || assessment;
            const gaps = assessmentReasons(procedureAssessment);
            return `<div class="procedure ${procedure.id === selectedProcedure?.id ? "selected" : ""}">
        <label><input type="radio" name="procedure" value="${escapeHtml(procedure.id)}" ${procedure.id === selectedProcedure?.id ? "checked" : ""}> ${escapeHtml(label(procedure))} <small>${escapeHtml(procedure.review_status || "proposed")}</small></label>
        <p><i class="assessment ${escapeHtml(procedureAssessment.status)}">${escapeHtml(readable(procedureAssessment.status))}</i> <i class="assessment unknown">${escapeHtml(readable(procedureAssessment.execution_status || "unverified"))}</i></p>
        ${gaps.length ? `<ul class="procedure-gaps">${gaps.map((gap) => `<li>${escapeHtml(gap)}</li>`).join("")}</ul>` : `<p class="unknown">${escapeHtml(text("assessmentMissing"))}</p>`}
        ${procedure.steps?.length ? `<ol>${procedure.steps.map((step) => `<li>${escapeHtml(step.description || step.skill_id)}</li>`).join("")}</ol>` : `<p class="unknown">${escapeHtml(text("noSteps"))}</p>`}
      </div>`;
          })
          .join("")}</details>`
      : `<p class="unknown">${escapeHtml(text("noProcedure"))}</p>`;
    const times = collection.time_estimates
      ? Object.entries(collection.time_estimates)
          .map(
            ([key, value]) =>
              `${readable(key)} ${value ?? text("timeUnknown")}`,
          )
          .join(" · ")
      : text("timeUnknown");

    elements.inspectorType.textContent = "TASK";
    elements.inspector.innerHTML = `<h2>${escapeHtml(label(task))}</h2>
      <small>${escapeHtml(task.id)}</small>
      <p><i class="assessment ${escapeHtml(activeAssessment.status)}">${escapeHtml(readable(activeAssessment.status))}</i>
      <i class="assessment unknown">${escapeHtml(readable(activeAssessment.execution_status || "unverified"))}</i></p>
      ${section(text("goals"), [...(task.goal_state || []), ...(collection.success_criteria || [])], text("goalMissing"))}
      ${section(text("initial"), task.initial_state || [], text("initialUnknown"))}
      ${section(
        text("capabilities"),
        (detail.skills || task.skills || []).map((skill) =>
          typeof skill === "string" ? readable(skill) : label(skill),
        ),
        text("capabilityMissing"),
      )}
      ${section(
        text("assessment"),
        (activeAssessment.reasons || []).map(
          (reason) =>
            reason.message ||
            `${readable(reason.kind)}: ${readable(reason.key)} = ${reason.value}`,
        ),
        text("assessmentMissing"),
      )}
      <section><h3>${escapeHtml(text("collection"))}</h3>
        ${section(text("setup"), collection.setup, text("unknown"))}
        ${section(text("reset"), collection.reset, text("unknown"))}
        ${section(text("quality"), collection.quality_checks, text("unknown"))}
        ${section(text("consumables"), collection.consumables, text("unknown"))}
        <p class="unknown">Time estimates: ${escapeHtml(times)}</p>
      </section>
      <section><h3>${escapeHtml(text("procedures"))}</h3>${procedureMarkup}</section>
      <section><h3>${escapeHtml(text("claims"))}</h3>${claimMarkup(detail.claims, detail.evidence || detail.sources || [])}</section>
      <section><h3>${escapeHtml(text("frequency"))}</h3><p class="unknown">${escapeHtml(text("frequencyUnknown"))}</p></section>
      <button id="download">${escapeHtml(text("download"))}</button>`;
    byId("download").addEventListener("click", downloadCollectionCard);
    elements.inspector
      .querySelectorAll('input[name="procedure"]')
      .forEach((input) => {
        input.addEventListener("change", () => {
          state.selectedProcedureId = input.value || null;
          renderTaskInspector(detail);
        });
      });
  }

  function nodeClass(node) {
    if (node.node_type?.includes("Object")) return "object-node";
    if (node.node_type?.includes("Task")) return "task-node";
    if (node.node_type === "Affordance") return "affordance-node";
    return "context-node";
  }

  function renderGraph() {
    const graph = state.graph;
    if (!graph?.nodes?.length) {
      elements.graph.innerHTML = "";
      elements.empty.hidden = false;
      return;
    }
    elements.empty.hidden = true;
    const nodes = graph.nodes;
    const root = nodes.find((node) => node.id === graph.center_id) || nodes[0];
    const width = 930;
    const height = Math.max(430, 160 + Math.ceil(nodes.length / 2) * 105);
    const positions = new Map([[root.id, { x: 150, y: height / 2 }]]);
    nodes
      .filter((node) => node.id !== root.id)
      .forEach((node, index) => {
        positions.set(node.id, {
          x: 480 + (index % 2) * 285,
          y: 65 + Math.floor(index / 2) * 95,
        });
      });
    elements.graph.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const edges = (graph.edges || [])
      .map((edge) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        return source && target
          ? `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"></line><text x="${(source.x + target.x) / 2}" y="${(source.y + target.y) / 2 - 5}">${escapeHtml(edge.relation)}</text>`
          : "";
      })
      .join("");
    const nodesMarkup = nodes
      .map((node) => {
        const position = positions.get(node.id);
        return `<g class="node ${nodeClass(node)} ${node.id === state.selectedNodeId ? "selected" : ""}" data-node-id="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="${escapeHtml(label(node))}">
        <rect x="${position.x - 108}" y="${position.y - 24}" width="216" height="48" rx="10"></rect>
        <text x="${position.x - 96}" y="${position.y - 3}">${escapeHtml(String(label(node)).slice(0, 32))}</text>
        <text class="node-sub" x="${position.x - 96}" y="${position.y + 14}" font-size="9" fill="#9bb1c4">
          ${escapeHtml(readable(node.node_type || "node"))}
        </text>
      </g>`;
      })
      .join("");
    elements.graph.innerHTML = `<g class="edges">${edges}</g><g>${nodesMarkup}</g>`;
    elements.graph.querySelectorAll("[data-node-id]").forEach((node) => {
      const go = () => navigateNode(node.dataset.nodeId);
      node.addEventListener("click", go);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          go();
        }
      });
    });
    renderBreadcrumbs();
  }

  function renderBreadcrumbs() {
    elements.crumbs.innerHTML = state.history
      .map(
        (entry, index) =>
          `<button data-history-index="${index}">${escapeHtml(entry.label)}</button>`,
      )
      .join("<span>/</span>");
    elements.crumbs
      .querySelectorAll("[data-history-index]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.dataset.historyIndex);
          const entry = state.history[index];
          state.history = state.history.slice(0, index);
          loadGraph(entry.id, false);
        });
      });
    elements.back.disabled = state.history.length === 0;
  }

  async function loadGraph(id, pushHistory = true) {
    const version = ++state.graphVersion;
    const previous = state.graph?.center_id;
    if (pushHistory && previous && previous !== id) {
      const previousNode = state.graph.nodes?.find(
        (node) => node.id === previous,
      );
      state.history.push({
        id: previous,
        label: label(previousNode || { id: previous }),
      });
    }
    try {
      const query = new URLSearchParams(contextQuery());
      query.set("lens", state.lens);
      const graph = await api(
        `/api/nodes/${encodeURIComponent(id)}/neighbors?${query}`,
      );
      if (version !== state.graphVersion) return;
      state.graph = graph;
      state.selectedNodeId = id;
      renderGraph();
    } catch (reason) {
      if (version === state.graphVersion)
        renderError(elements.inspector, reason);
    }
  }

  async function navigateNode(id) {
    const node = state.graph?.nodes?.find((candidate) => candidate.id === id);
    if (node?.node_type === "TaskInstance") return selectTask(id);
    if (node?.node_type === "ObjectInstance") return selectObject(id);
    const version = state.graphVersion + 1;
    await loadGraph(id);
    if (version !== state.graphVersion) return;
    elements.inspectorType.textContent = readable(
      node?.node_type || "node",
    ).toUpperCase();
    elements.inspector.innerHTML = `<h2>${escapeHtml(label(node || { id }))}</h2><p>${escapeHtml(text("graphHint"))}</p>`;
  }

  async function selectObject(id, { preserveTask = false } = {}) {
    const version = ++state.requestVersion;
    const taskToPreserve = preserveTask ? state.selectedTaskId : null;
    state.selectedObjectId = id;
    state.selectedTaskId = null;
    if (!taskToPreserve) {
      state.taskDetail = null;
      state.selectedProcedureId = null;
    }
    state.selectedNodeId = id;
    state.history = [];
    renderObjects();
    try {
      const query = contextQuery();
      const [detail, tasks] = await Promise.all([
        api(`/api/objects/${encodeURIComponent(id)}?${query}`),
        api(`/api/tasks?object_id=${encodeURIComponent(id)}&${query}`),
      ]);
      if (version !== state.requestVersion) return;
      renderHero(detail);
      state.tasks = tasks;
      renderTasks(tasks);
      if (taskToPreserve) {
        await selectTask(taskToPreserve, { replaceGraph: true });
      } else {
        renderObjectInspector(detail);
        await loadGraph(id, false);
      }
    } catch (reason) {
      if (version === state.requestVersion)
        renderError(elements.inspector, reason);
    }
  }

  async function selectTask(id, { replaceGraph = false } = {}) {
    const version = ++state.requestVersion;
    state.selectedTaskId = id;
    state.selectedNodeId = id;
    renderTasks(state.tasks);
    try {
      const detail = await api(
        `/api/tasks/${encodeURIComponent(id)}?${contextQuery()}`,
      );
      if (version !== state.requestVersion) return;
      state.taskDetail = detail;
      renderTaskInspector(detail);
      await loadGraph(id, !replaceGraph);
    } catch (reason) {
      if (version === state.requestVersion)
        renderError(elements.inspector, reason);
    }
  }

  async function refreshContext() {
    if (!state.selectedObjectId) return;
    await selectObject(state.selectedObjectId, {
      preserveTask: Boolean(state.selectedTaskId),
    });
  }

  async function downloadCollectionCard() {
    if (!state.selectedTaskId) return;
    const procedureId = state.selectedProcedureId;
    const query = new URLSearchParams(contextQuery());
    if (procedureId) query.set("procedure_id", procedureId);
    try {
      const card = await api(
        `/api/tasks/${encodeURIComponent(state.selectedTaskId)}/collection-card?${query}`,
      );
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob([JSON.stringify(card, null, 2)], { type: "application/json" }),
      );
      link.download = `task-atlas-${state.selectedTaskId}-collection-card.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (reason) {
      renderError(elements.inspector, reason);
    }
  }

  async function search() {
    const query = elements.search.value.trim();
    if (!query) return renderObjects();
    const exact = state.objects.find((object) =>
      [object.id, object.ycb_id, object.name_en, object.name_ja].some(
        (value) => String(value || "").toLowerCase() === query.toLowerCase(),
      ),
    );
    if (exact) return selectObject(exact.id);
    try {
      const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
      const hit = results[0];
      if (["object", "objectinstance"].includes(hit?.result_type))
        return selectObject(hit.id);
      if (["task", "taskinstance"].includes(hit?.result_type))
        return selectTask(hit.id);
      if (hit) return navigateNode(hit.id);
      elements.inspector.innerHTML = `<div class="message">${escapeHtml(text("noNode"))}</div>`;
    } catch (reason) {
      renderError(elements.inspector, reason);
    }
  }

  function bindEvents() {
    byId("search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      search();
    });
    elements.search.addEventListener("input", renderObjects);
    elements.language.addEventListener("click", () => {
      state.language = state.language === "en" ? "ja" : "en";
      localStorage.setItem("atlas-lang", state.language);
      renderLanguage();
    });
    [
      ["scene", "scene_id"],
      ["contents", "contents"],
      ["role", "role"],
      ["profile", "profile"],
    ].forEach(([element, key]) => {
      elements[element].addEventListener("change", () => {
        state.context[key] = elements[element].value;
        refreshContext();
      });
    });
    elements.blockers.addEventListener("change", () => {
      state.context.blocked_conditions = [
        ...elements.blockers.selectedOptions,
      ].map((option) => option.value);
      refreshContext();
    });
    document.querySelectorAll("[data-mode]").forEach((button) =>
      button.addEventListener("click", () => {
        state.context.mode = button.dataset.mode;
        document
          .querySelectorAll("[data-mode]")
          .forEach((candidate) =>
            candidate.classList.toggle("on", candidate === button),
          );
        refreshContext();
      }),
    );
    document.querySelectorAll("[data-lens]").forEach((button) =>
      button.addEventListener("click", () => {
        state.lens = button.dataset.lens;
        document
          .querySelectorAll("[data-lens]")
          .forEach((candidate) =>
            candidate.classList.toggle("on", candidate === button),
          );
        if (state.graph?.center_id) loadGraph(state.graph.center_id, false);
      }),
    );
    elements.back.addEventListener("click", () => {
      const previous = state.history.pop();
      if (previous) loadGraph(previous.id, false);
    });
  }

  async function init() {
    bindEvents();
    setStaticLanguage();
    try {
      const [health, objects, contextOptions, scenes] = await Promise.all([
        api("/api/health"),
        api("/api/objects"),
        api("/api/context-options"),
        api("/api/scenes"),
      ]);
      state.objects = objects;
      // Context options deliberately excludes scenes in the current API. Keep this
      // fallback local so the selector is never silently empty.
      state.contextOptions = {
        ...contextOptions,
        scenes: contextOptions.scenes || scenes,
      };
      renderContextOptions(state.contextOptions);
      renderObjects();
      elements.status.textContent = `${health.seed_counts.objects} objects ready`;
      elements.status.className = "ok";
      const initial =
        objects.find((object) => object.ycb_id === "006_mustard_bottle") ||
        objects[0];
      if (initial) await selectObject(initial.id);
    } catch (reason) {
      elements.status.textContent = "Offline";
      elements.status.className = "bad";
      renderError(elements.objects, reason);
      renderError(elements.taskList, reason);
    }
  }

  init();
})();
