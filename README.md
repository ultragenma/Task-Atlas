# Physical AI Task Atlas

> An evidence-aware local explorer for turning everyday activity into reviewable Physical AI task candidates.

[日本語版 README](README.ja.md) · [Research snapshot (JA)](report-source.md) · [Contributing](#contributing) · [License status](#license-status)

Physical AI Task Atlas is a small, dependency-free MVP for exploring task candidates through relationships between objects, scenes, states, intents, skills, and evidence. It starts with the [YCB Object Set](https://www.ycbbenchmarks.com/object-set-purchase-links/) and a deeply annotated mustard-bottle slice, while keeping research-derived keywords explicitly provisional.

## Highlights

- Browse and search 77 YCB object records.
- Explore a local relationship graph from object to scene, state, intent, task, and skill.
- Inspect 23 mustard-bottle task instances with templates, initial and goal conditions, and required skills.
- Rank candidates using explicit hypotheses for human frequency, scene naturalness, robot feasibility, collection cost, and coverage value.
- Surface evidence level and review status rather than presenting seeds as established facts.
- Export task instances as JSON or CSV.
- Validate seed data, research candidates, and API behavior with built-in Node.js tooling.

## Quick start

Requirements: Node.js 18 or newer. This project has zero runtime dependencies.

```bash
npm run check
npm start
```

Then open <http://localhost:3000>. For local development with automatic server restart:

```bash
npm run dev
```

## Research snapshot

The first research pass connects Physical AI task design and data collection with everyday activity taxonomies and time-use statistics. Its output is a proposed, review-before-use seed—not an observed frequency table.

- [Research report (Japanese source)](report-source.md): task-definition patterns, collection practices, dataset and time-use sources, and interpretation limits.
- [Keyword candidates](data/research/task_keyword_candidates.json): 20 task families prioritized as P0, P1, and P2.
- [Candidate schema](schemas/task_keyword_candidates.schema.json): the contract for those research records.

The candidate `skills` vocabulary is not yet a foreign-key reference to `data/seeds/skills.json`. A reviewed mapping is a future step.

## API

All endpoints are served locally by `npm start`.

```text
GET /api/objects
GET /api/objects/{id}
GET /api/nodes/{id}/neighbors
GET /api/tasks
GET /api/tasks/{id}
GET /api/tasks/generate?object_id=...&scene_id=...
GET /api/scenes
GET /api/skills
GET /api/search?q=...
GET /api/export/tasks.json
GET /api/export/tasks.csv
GET /api/health
```

`POST /api/proposals` and `POST /api/reviews` are intentionally not implemented: this MVP has no persistence or review workflow yet. Unreviewed records remain `proposed`.

## Repository layout

```text
backend/             Node.js HTTP API and static-file server
frontend/            Vanilla JavaScript exploration UI
data/seeds/          Curated MVP seed data
data/research/       Proposed research-derived keyword seeds
schemas/             JSON Schemas for seed and research records
scripts/             Data validation scripts
tests/               Node.js API and data tests
docs/                Architecture, ontology, and evidence policy
report-source.md     Research snapshot and source notes
```

## Data and evidence policy

The YCB identifiers and names in `data/seeds/objects.json` are local metadata for UI validation; this repository does not bundle official YCB models or images. See the [YCB paper](https://arxiv.org/abs/1502.03143) and [YCB Object Set](https://www.ycbbenchmarks.com/object-set-purchase-links/).

Task-candidate scores are hypotheses, not measured population frequencies or benchmarks. The MVP marks them with `evidence-mvp-seed`, retains a review status, and separates `population_frequency`, `dataset_recurrence`, and `research_signal` in the research materials. The detailed rules are in [docs/evidence_policy.md](docs/evidence_policy.md).

The ontology is designed to be compatible with richer task definitions such as [BEHAVIOR](https://behavior.stanford.edu/behavior_components/behavior_knowledgebase.html), while remaining intentionally lightweight at this stage.

## Development and checks

Run the complete local verification suite:

```bash
npm run check
```

This runs seed validation, research-candidate validation, and the Node.js test suite. Individual commands are also available:

```bash
npm run validate
npm run validate:research
npm test
```

## Roadmap

1. Add YCB metadata import with license and access-date tracking.
2. Map task definitions to BEHAVIOR synsets and BDDL-style conditions.
3. Introduce SQLite persistence and a proposal/review workflow.
4. Attach measured evidence and provenance to each score.
5. Export task instances as collection specifications and simulator-ready formats.

## Contributing

Contributions are welcome, especially source-backed task definitions, evidence reviews, schema feedback, and improvements to validation. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request; it explains how to state the source, release/version, access date, and whether a proposed record is measured evidence or a hypothesis.

## License status

No license file is currently included in this repository. Reuse terms have not yet been declared; do not assume an open-source license applies.
