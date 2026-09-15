# Mustard expansion

The mustard expansion is a deliberately bounded set of proposed task and scene
designs. It contains three iterations of 20 new nodes each (60 total), recorded
in `data/seeds/expansion_loops.json`. The nodes are ordinary task or scene seed
records; each loop only names its members.

`data/seeds/expansion_relations.json` makes the cross-node design choices
inspectable. Every relation identifies its source, target, relationship label,
rationale, and iteration. Later loops link to an earlier loop, and graph
traversal is available from either endpoint.

This scope is not a measured catalogue of common activities. It does not report
observed frequency, rank candidates, establish robot success, or replace
claim-specific evidence. It is a proposed design surface for review and future
collection planning. Unknown frequency remains unknown.

Use `GET /api/expansion-loops` to inspect loops with their relations. The task
JSON export at `/api/export/tasks.json` includes `scenes`, `expansion_loops`,
and `expansion_relations` alongside the task-planning records.
