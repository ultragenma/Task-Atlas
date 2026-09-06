#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CANDIDATES_PATH = path.join(
  ROOT,
  "data",
  "research",
  "task_keyword_candidates.json",
);
const SCHEMA_PATH = path.join(
  ROOT,
  "schemas",
  "task_keyword_candidates.schema.json",
);
const ID_PATTERN = /^[a-z][a-z0-9_]*$/;
const PRIORITIES = new Set(["P0", "P1", "P2"]);
const SIGNAL_TYPES = new Set([
  "population_frequency_prior",
  "dataset_recurrence",
  "research_signal",
]);
const ARRAY_FIELDS = [
  "verbs",
  "object_roles",
  "state_atoms",
  "scene_roots",
  "goal_patterns",
  "skills",
  "variant_axes",
  "failure_modes",
  "evidence",
];
const REQUIRED_FAMILY_FIELDS = [
  "id",
  "label_en",
  "label_ja",
  "priority",
  "signal_types",
  ...ARRAY_FIELDS,
  "selection_reason",
  "frequency_status",
];

function readJson(filepath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf8"));
  } catch (error) {
    errors.push(`${label}: invalid or unreadable JSON (${error.message})`);
    return null;
  }
}

function validateId(value, location, errors) {
  if (typeof value !== "string" || !ID_PATTERN.test(value))
    errors.push(`${location}: expected lower_snake_case id`);
}

function validateNonEmptyString(value, location, errors) {
  if (typeof value !== "string" || value.trim() === "")
    errors.push(`${location}: expected non-empty string`);
}

function validateKeywordArray(value, location, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${location}: expected non-empty array`);
    return;
  }
  value.forEach((entry, index) =>
    validateId(entry, `${location}[${index}]`, errors),
  );
}

function run() {
  const errors = [];
  const schema = readJson(SCHEMA_PATH, "schema", errors);
  const candidates = readJson(
    CANDIDATES_PATH,
    "task keyword candidates",
    errors,
  );
  if (!schema || !candidates) return fail(errors);

  [
    "schema_version",
    "status",
    "generated_at",
    "metadata",
    "source_registry",
    "families",
  ].forEach((field) => {
    if (!(field in candidates))
      errors.push(`root: missing required property ${field}`);
  });
  if (candidates.status !== "proposed")
    errors.push("root.status: expected proposed");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidates.generated_at || ""))
    errors.push("root.generated_at: expected YYYY-MM-DD");
  if (!schema.$defs?.family || !schema.$defs?.source)
    errors.push("schema: missing family or source definitions");

  const metadata = candidates.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    errors.push("root.metadata: expected object");
  } else {
    ["purpose", "frequency_interpretation"].forEach((field) =>
      validateNonEmptyString(metadata[field], `metadata.${field}`, errors),
    );
    if (
      !Array.isArray(metadata.version_caveats) ||
      metadata.version_caveats.length === 0
    )
      errors.push("metadata.version_caveats: expected source-version caveats");
  }

  const sourceIds = new Set();
  if (
    !Array.isArray(candidates.source_registry) ||
    candidates.source_registry.length === 0
  ) {
    errors.push("source_registry: expected non-empty array");
  } else {
    candidates.source_registry.forEach((source, index) => {
      const location = `source_registry[${index}]`;
      if (!source || typeof source !== "object" || Array.isArray(source))
        return errors.push(`${location}: expected object`);
      ["id", "kind", "source_version", "retrieved_at", "url", "use"].forEach(
        (field) => {
          if (!(field in source))
            errors.push(`${location}: missing required property ${field}`);
        },
      );
      validateId(source.id, `${location}.id`, errors);
      if (sourceIds.has(source.id))
        errors.push(`${location}.id: duplicate source id ${source.id}`);
      sourceIds.add(source.id);
      ["kind", "source_version", "use"].forEach((field) =>
        validateNonEmptyString(source[field], `${location}.${field}`, errors),
      );
      if (!/^\d{4}-\d{2}-\d{2}$/.test(source.retrieved_at || ""))
        errors.push(`${location}.retrieved_at: expected YYYY-MM-DD`);
      if (typeof source.url !== "string" || !source.url.startsWith("https://"))
        errors.push(`${location}.url: expected https URL`);
    });
  }

  const familyIds = new Set();
  const priorityCounts = { P0: 0, P1: 0, P2: 0 };
  if (!Array.isArray(candidates.families) || candidates.families.length === 0) {
    errors.push("families: expected non-empty array");
  } else {
    candidates.families.forEach((family, index) => {
      const location = `families[${index}]`;
      if (!family || typeof family !== "object" || Array.isArray(family))
        return errors.push(`${location}: expected object`);
      REQUIRED_FAMILY_FIELDS.forEach((field) => {
        if (!(field in family))
          errors.push(`${location}: missing required property ${field}`);
      });
      validateId(family.id, `${location}.id`, errors);
      if (familyIds.has(family.id))
        errors.push(`${location}.id: duplicate family id ${family.id}`);
      familyIds.add(family.id);
      ["label_en", "label_ja", "selection_reason", "frequency_status"].forEach(
        (field) =>
          validateNonEmptyString(family[field], `${location}.${field}`, errors),
      );
      if (!PRIORITIES.has(family.priority))
        errors.push(`${location}.priority: expected P0, P1, or P2`);
      else priorityCounts[family.priority] += 1;
      if (
        !Array.isArray(family.signal_types) ||
        family.signal_types.length === 0
      )
        errors.push(`${location}.signal_types: expected non-empty array`);
      else
        family.signal_types.forEach((signal, signalIndex) => {
          if (!SIGNAL_TYPES.has(signal))
            errors.push(
              `${location}.signal_types[${signalIndex}]: unknown signal type ${signal}`,
            );
        });
      ARRAY_FIELDS.filter((field) => field !== "evidence").forEach((field) =>
        validateKeywordArray(family[field], `${location}.${field}`, errors),
      );
      if (!Array.isArray(family.evidence) || family.evidence.length === 0)
        errors.push(`${location}.evidence: expected non-empty array`);
      else
        family.evidence.forEach((sourceId, evidenceIndex) => {
          validateId(
            sourceId,
            `${location}.evidence[${evidenceIndex}]`,
            errors,
          );
          if (!sourceIds.has(sourceId))
            errors.push(
              `${location}.evidence[${evidenceIndex}]: unknown source id ${sourceId}`,
            );
        });
    });
  }
  if (errors.length) return fail(errors);
  console.log("Research validation passed.");
  console.log(`  source records: ${sourceIds.size}`);
  console.log(
    `  task families: ${familyIds.size} (P0 ${priorityCounts.P0}, P1 ${priorityCounts.P1}, P2 ${priorityCounts.P2})`,
  );
}

function fail(errors) {
  console.error(`Research validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
}

run();
