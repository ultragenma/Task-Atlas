# Contributing to Physical AI Task Atlas

Thank you for helping make Physical AI task definitions easier to inspect, compare, and reuse.

## Before you start

- Use Node.js 18 or later. This repository has no runtime package dependencies.
- Read the [documentation index](docs/README.md), especially the ontology and evidence policy.
- Run the full local check before opening a pull request:

  ```bash
  npm run check
  ```

## Data and research contributions

Task and research candidates are evidence-aware records, not facts by default. In particular, entries in `data/research/task_keyword_candidates.json` are **proposed seeds**: they are review inputs, not validated task templates, measured human-frequency rankings, or production labels.

For every new or changed research-backed claim, retain enough provenance for another contributor to verify it:

- a stable source URL or identifier;
- source title, publisher or author, and access date when available;
- dataset release, paper version, or snapshot version when applicable;
- the meaning of the signal (`population_frequency`, `dataset_recurrence`, or `research_signal`), without converting one into another;
- an explicit `derived_task_hypothesis` when a task suggestion is inferred rather than directly reported by a source.

Do not merge counts from different dataset releases. Do not treat activity-time statistics as direct measurements of robot action frequency.

## Naming and schema rules

- Use lowercase `snake_case` IDs.
- Keep the established prefixes: `scene_`, `state_`, `intent_`, and `skill_`.
- Name reusable task templates with a verb-led ID such as `apply_condiment`.
- Name task instances with their bindings, such as `{verb}_{object}_{target}`.
- Keep display names separate from identifiers; use `name_en` and `name_ja` when both are needed.
- Update or add the relevant JSON Schema and validation coverage when introducing a new data shape.

See [docs/ontology.md](docs/ontology.md) for the complete vocabulary and ID guidance.

## Tests and validation

Run `npm run check` for all changes. It validates MVP seed data, validates research candidates, and runs the Node.js test suite.

For a focused iteration, you may also run:

```bash
npm run validate
npm run validate:research
npm test
```

Add or update tests when changing API behavior, validation rules, schemas, or data relationships. Keep changes small enough that a reviewer can trace a claim from source to record to UI behavior.

## Issues and pull requests

Use GitHub Issues for a clear bug, data-quality concern, source correction, task proposal, or design discussion. Include a minimal reproduction or source links where relevant.

Pull requests should describe the user-facing or data-model effect, identify affected schemas and source records, and state the commands run. Keep unrelated refactors out of the same pull request. Never add or choose a license on behalf of the project; raise it as an issue for maintainers to decide.

Write commit messages in English, using a concise imperative summary, for example: `Add provenance fields to research seeds`.
