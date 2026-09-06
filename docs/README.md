# Documentation

The maintained product documentation is English-first. The repository's top page links to a synchronized Japanese overview.

## Start here

- [Foundation contract](foundation-contract.md) — the `0.2` normative data and HTTP contract.
- [Architecture](architecture.md) — typed graph, context assessment, API boundaries, and collection-card workflow.
- [Ontology and ID rules](ontology.md) — distinctions among goals, procedures, capabilities, claims, and sources.
- [Evidence and claim policy](evidence_policy.md) — claim-scoped support and explicit unknown frequency.
- [Mustard walkthrough](walkthrough.md) — a concrete exploration-to-collection path.

## Migration from 0.1

The prior MVP exposed per-task `scores`, ranking controls, and a global evidence-level presentation. Version `0.2` removes those concepts. Clients and data contributions should use context assessment, claim records, source scope, planning requirements, and optional procedures. Unknown is a first-class value; it is not a zero, a default score, or an inferred ranking.

## Research and historical notes

- [Research source report (Japanese)](../report-source.md) contains the source-backed research record. Portions describing fixed rankings or earlier evidence proposals are historical and are superseded by the foundation contract.
- [Project handoff (Japanese)](../physical_ai_task_atlas_handoff_ja.md) preserves earlier product notes. Its historical status banner points to the current model.
- [Research keyword candidates](../data/research/task_keyword_candidates.json) remain review inputs; they are not collection-ready tasks or frequency statistics.

## Contribution and checks

Read [CONTRIBUTING.md](../CONTRIBUTING.md). Run `npm run check` after changing data, schemas, API behavior, or documentation. GitHub Actions runs the same command on Node.js 22 and 24 for pushes and pull requests.
