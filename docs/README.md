# Documentation index

This directory is the English-language entry point for the design, data model, and evidence practices behind Physical AI Task Atlas.

## Core documentation

- [Architecture](architecture.md) — MVP components, API boundaries, and data flow.
- [Ontology and ID rules](ontology.md) — distinctions between objects, states, intents, templates, instances, skills, and evidence.
- [Evidence policy](evidence_policy.md) — how claims, sources, review status, and scores should be interpreted.

## Research and project context

- [Research source report (Japanese)](../report-source.md) — the current canonical research record. It is written in Japanese and documents the source-backed snapshot, version caveats, and the interpretation limits of task keywords.
- [Project handoff (Japanese)](../physical_ai_task_atlas_handoff_ja.md) — implementation and product-design handoff notes for future work.
- [Task keyword candidates](../data/research/task_keyword_candidates.json) — 20 proposed P0/P1/P2 task families. These are review seeds, not approved templates or measured frequency statistics.
- [Task keyword candidate schema](../schemas/task_keyword_candidates.schema.json) — JSON Schema for the research candidate file.

## Seed schemas

- [Object schema](../schemas/object.schema.json)
- [Task template schema](../schemas/task_template.schema.json)
- [Task instance schema](../schemas/task_instance.schema.json)
- [Evidence schema](../schemas/evidence.schema.json)

## Working with the docs

Start with the ontology before adding IDs or relationships, then follow the evidence policy when adding a source-backed claim. Contributors should run `npm run check` after changing data or schemas; see [CONTRIBUTING.md](../CONTRIBUTING.md) for the complete contribution workflow.
