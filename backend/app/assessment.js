const STATUS_ORDER = Object.freeze({
  ready: 0,
  needs_changes: 1,
  unknown: 2,
  blocked: 3,
});
const ENUMS = Object.freeze({
  contents: ["unknown", "full", "empty"],
  role: ["unknown", "home_user", "customer", "staff"],
  profile: ["unknown", "rigid_sim", "real_world"],
  mode: ["explore", "ready"],
});

const RIGID_SIM_CAPABILITIES = new Set([
  "rigid_manipulation",
  "visual_inspection",
]);
const SAFETY_CONDITIONS = new Set([
  "safe_to_continue",
  "food_safe",
  "human_clearance",
  "no_sharp_hazard",
]);

function unique(values) {
  return [...new Set(values)];
}

function option(id, label) {
  return { id, label };
}

function parseCsv(value, parameter) {
  if (value === null || value === undefined)
    return { provided: false, values: [] };
  const values =
    value === ""
      ? []
      : unique(
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        );
  if (values.some((item) => item.length > 160))
    throw new Error(`${parameter} contains an invalid value`);
  return { provided: true, values };
}

function parseContext(query) {
  const context = {};
  for (const [key, allowed, fallback] of [
    ["contents", ENUMS.contents, "unknown"],
    ["role", ENUMS.role, "unknown"],
    ["profile", ENUMS.profile, "unknown"],
    ["mode", ENUMS.mode, "explore"],
  ]) {
    const value = query.get(key) || fallback;
    if (!allowed.includes(value)) throw new Error(`Invalid ${key}`);
    context[key] = value;
  }
  context.scene_id = query.get("scene_id") || null;
  for (const key of [
    "available_objects",
    "capabilities",
    "confirmed_conditions",
    "blocked_conditions",
  ]) {
    context[key] = parseCsv(query.get(key), key);
  }
  return context;
}

function requirementSatisfied(requirement, context) {
  const key = requirement.key;
  const value = requirement.value;
  if (key === "scene_id") return context.scene_id === value;
  if (key === "contents" || key === "role") return context[key] === value;
  if (key === "object") return context.available_objects.values.includes(value);
  if (key === "capability") return context.capabilities.values.includes(value);
  if (key === "condition")
    return context.confirmed_conditions.values.includes(value);
  return false;
}

function assessRequirements(requirements, context) {
  const reasons = [];
  const missingObjects = [];
  const unverifiedConditions = [];
  const capabilityGaps = [];
  const safetyBlockers = [];
  const byKey = new Map();
  for (const requirement of requirements || []) {
    if (!byKey.has(requirement.key)) byKey.set(requirement.key, []);
    byKey.get(requirement.key).push(requirement);
  }

  for (const [key, alternatives] of byKey) {
    const alternativesAreAllowed = ["role", "contents", "scene_id"].includes(
      key,
    );
    const requirementGroups = alternativesAreAllowed
      ? [alternatives]
      : alternatives.map((requirement) => [requirement]);
    for (const candidates of requirementGroups) {
      const blocked =
        key === "condition" &&
        candidates.filter((requirement) =>
          context.blocked_conditions.values.includes(requirement.value),
        );
      if (blocked.length) {
        safetyBlockers.push(...blocked.map((requirement) => requirement.value));
        const blockedValues = blocked.map((requirement) => requirement.value);
        reasons.push({
          kind: "safety",
          key,
          value: blockedValues.length === 1 ? blockedValues[0] : blockedValues,
          message:
            blocked
              .map((requirement) => requirement.reason)
              .filter(Boolean)
              .join(" ") || "A required condition is blocked.",
        });
        continue;
      }
      const satisfied = candidates.some((requirement) =>
        requirementSatisfied(requirement, context),
      );
      if (satisfied) {
        const requirement = candidates.find((item) =>
          requirementSatisfied(item, context),
        );
        reasons.push({
          kind: "satisfied",
          key,
          value: requirement.value,
          message: requirement.reason || `${key} is confirmed.`,
        });
        continue;
      }
      const values = candidates.map((item) => item.value);
      const message =
        candidates
          .map((item) => item.reason)
          .filter(Boolean)
          .join(" ") || `Requires ${values.join(" or ")}.`;
      if (key === "object") {
        if (!context.available_objects.provided) {
          unverifiedConditions.push(...values);
          reasons.push({ kind: "unknown", key, value: values, message });
        } else {
          missingObjects.push(...values);
          reasons.push({ kind: "missing", key, value: values, message });
        }
      } else if (key === "capability") {
        if (!context.capabilities.provided) {
          capabilityGaps.push(...values);
          reasons.push({
            kind: "unknown",
            key,
            value: values,
            message: `${message} Robot capability is unverified.`,
          });
        } else {
          capabilityGaps.push(...values);
          reasons.push({ kind: "unsupported", key, value: values, message });
        }
      } else if (key === "condition") {
        if (!context.confirmed_conditions.provided) {
          unverifiedConditions.push(...values);
          reasons.push({ kind: "unknown", key, value: values, message });
        } else {
          unverifiedConditions.push(...values);
          reasons.push({ kind: "missing", key, value: values, message });
        }
      } else {
        const actual = key === "scene_id" ? context.scene_id : context[key];
        if (actual === null || actual === "unknown") {
          unverifiedConditions.push(key);
          reasons.push({ kind: "unknown", key, value: values, message });
        } else {
          reasons.push({ kind: "conflict", key, value: values, message });
        }
      }
    }
  }

  if (context.profile === "rigid_sim") {
    const unsupported = (requirements || [])
      .filter((requirement) => requirement.key === "capability")
      .map((requirement) => requirement.value)
      .filter((capability) => !RIGID_SIM_CAPABILITIES.has(capability));
    if (unsupported.length) {
      capabilityGaps.push(...unsupported);
      reasons.push({
        kind: "unsupported",
        key: "profile",
        value: unsupported,
        message: `Rigid simulation is limited to rigid manipulation and visual inspection; it cannot establish ${unsupported.join(", ")}.`,
      });
    }
  }
  for (const condition of context.blocked_conditions.values) {
    if (!safetyBlockers.includes(condition)) {
      safetyBlockers.push(condition);
      reasons.push({
        kind: "safety",
        key: "condition",
        value: condition,
        message: `Blocked safety condition: ${condition}.`,
      });
    }
  }
  let status = "ready";
  if (
    safetyBlockers.length ||
    reasons.some(
      (reason) => reason.kind === "unsupported" && reason.key === "profile",
    )
  )
    status = "blocked";
  else if (
    reasons.some((reason) =>
      ["missing", "conflict", "unsupported"].includes(reason.kind),
    )
  )
    status = "needs_changes";
  else if (reasons.some((reason) => reason.kind === "unknown"))
    status = "unknown";

  return {
    status,
    reasons,
    missing_objects: unique(missingObjects),
    unverified_conditions: unique(unverifiedConditions),
    capability_gaps: unique(capabilityGaps),
    safety_blockers: unique(safetyBlockers),
    execution_status: "unverified",
  };
}

function mergeAssessments(...assessments) {
  const status = assessments.reduce(
    (current, assessment) =>
      STATUS_ORDER[assessment.status] > STATUS_ORDER[current]
        ? assessment.status
        : current,
    "ready",
  );
  const fields = [
    "missing_objects",
    "unverified_conditions",
    "capability_gaps",
    "safety_blockers",
  ];
  const merged = {
    status,
    reasons: assessments.flatMap((assessment) => assessment.reasons),
    execution_status: "unverified",
  };
  for (const field of fields)
    merged[field] = unique(
      assessments.flatMap((assessment) => assessment[field]),
    );
  return merged;
}

function deriveOptions(data, planning) {
  const resources = new Map(
    data.objects.map((item) => [item.id, item.name_en || item.id]),
  );
  const capabilities = new Set();
  const conditions = new Map();
  for (const record of planning) {
    for (const requirement of [
      ...(record.requirements || []),
      ...(record.procedures || []).flatMap(
        (procedure) => procedure.requirements || [],
      ),
    ]) {
      if (requirement.key === "object")
        resources.set(requirement.value, requirement.value);
      if (requirement.key === "capability") capabilities.add(requirement.value);
      if (requirement.key === "condition")
        conditions.set(
          requirement.value,
          requirement.reason || requirement.value.replace(/_/g, " "),
        );
    }
  }
  return {
    roles: [
      option("unknown", "Unknown"),
      option("home_user", "Home user"),
      option("customer", "Customer"),
      option("staff", "Staff"),
    ],
    contents: [
      option("unknown", "Unknown"),
      option("full", "Full"),
      option("empty", "Empty"),
    ],
    profiles: [
      option("unknown", "Unknown"),
      option("rigid_sim", "Rigid simulation"),
      option("real_world", "Real world"),
    ],
    resources: [...resources]
      .map(([id, label]) => option(id, label))
      .sort((a, b) => a.label.localeCompare(b.label, "en")),
    capabilities: [...capabilities]
      .sort()
      .map((id) => option(id, id.replace(/_/g, " "))),
    conditions: [...conditions]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([id, label]) => option(id, label)),
    blocked_conditions: [...conditions]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([id, label]) => option(id, label)),
  };
}

module.exports = {
  STATUS_ORDER,
  parseContext,
  assessRequirements,
  mergeAssessments,
  deriveOptions,
};
