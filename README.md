# Physical AI Task Atlas

> Explore everyday activity as a context-dependent task graph, then turn a selected candidate into a reviewable collection card.

[日本語](README.ja.md) · [Documentation](docs/README.md) · [Mustard walkthrough](docs/walkthrough.md) · [Contributing](CONTRIBUTING.md)

Task Atlas begins with the YCB object catalog and a mustard-bottle slice. It is a local, dependency-free application for asking better questions before collecting data: what goal makes sense in this scene and role, what is present or missing, what claims support the candidate, and what would a collection session require?

It does not present a fixed task hierarchy, a required action sequence, a universal evidence grade, an ungrounded frequency score, or record counts as proof of progress.

## What it models

- A typed graph connecting objects, scenes, states, roles, intents, tasks, skills, claims, and sources.
- Context-dependent assessment: `ready`, `needs_changes`, `unknown`, or `blocked`.
- Goals separated from optional proposed procedures.
- Claim-scoped sources: each source supports a stated claim within a stated scope.
- Frequency that is directly observed, explicitly derived, or unknown. Unknown is preserved rather than estimated.
- Collection cards containing the setup, reset, quality checks, consumables, failure modes, required resources, context assumptions, and unresolved requirements needed for a real trial.

The [foundation contract](docs/foundation-contract.md) defines the `0.2` data and HTTP interface. It is the authoritative specification for context semantics, assessments, planning records, claims, and exports.

## Start locally

Use Node.js 18 or newer. There are no runtime package dependencies.

```bash
npm run check
npm start
```

Open <http://localhost:3000>. During development, `npm run dev` restarts the server when files change.

The GitHub Actions workflow runs `npm run check` on Node.js 22 and 24 for pushes and pull requests.

## Try the core question

Select `ycb_006_mustard_bottle`, then compare candidates under different context declarations:

- A home meal context with a full bottle can surface preparation and dispensing candidates.
- An empty, post-meal context shifts attention to checking, replacement, disposal, and cleaning.
- A retail shelf changes when the role changes from customer to staff: purchase-oriented candidates differ from restocking, facing, and inventory work.
- A missing plate or hot dog keeps a dispensing candidate visible in explore mode and names the preparation needed to make it ready.

Use the [walkthrough](docs/walkthrough.md) for the exact API calls and the collection-card handoff. The card is a plan for a simulation or teleoperation session; it makes no claim that a robot has already succeeded.

## API at a glance

```text
GET /api/context-options
GET /api/tasks?...context
GET /api/tasks/{id}?...context
GET /api/tasks/{id}/collection-card?...context&procedure_id=...
GET /api/nodes/{id}/neighbors?lens=all|context|goals|execution
GET /api/export/tasks.json
GET /api/export/tasks.csv
```

See [architecture](docs/architecture.md) for component boundaries and [the foundation contract](docs/foundation-contract.md) for parameter and response details. Previous `0.1` clients that depend on task `scores`, ranking parameters, or a global evidence level must migrate to assessments and claim records.

## Documentation

- [Architecture](docs/architecture.md): typed graph, context assessment, and collection-card workflow.
- [Ontology](docs/ontology.md): record distinctions and context semantics.
- [Evidence and claim policy](docs/evidence_policy.md): scope-aware support and unknown frequency.
- [Mustard walkthrough](docs/walkthrough.md): use the vertical slice from exploration to collection preparation.
- [Research source report (Japanese)](report-source.md): source notes and research context. Historical proposals are marked as superseded where applicable.

## Contribute

Contributions should make a claim, its scope, its supporting source, and its remaining uncertainty inspectable. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a data, schema, API, or documentation change.

## License

No license file is currently included. Reuse terms have not been declared.
