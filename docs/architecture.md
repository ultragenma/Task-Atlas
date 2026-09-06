# Architecture

Task Atlas is a local, read-only explorer that turns a situated task candidate into a reviewable collection specification. It is deliberately a graph explorer, not a ranked catalog or a fixed task tree.

```text
typed seed records
  ├─ catalog objects, scenes, states, intents, skills
  ├─ task definitions and context-dependent planning
  ├─ claim records and source records
  └─ collection requirements
             ↓ validation at startup
in-memory store and assessment engine
  ├─ typed graph lenses
  ├─ context-aware task assessment
  ├─ optional procedure assessment
  └─ collection-card export
             ↓ local HTTP API
English-first browser UI and JSON / CSV consumers
```

## Typed graph, not a single hierarchy

Objects, scenes, states, intents, task definitions, procedures, skills, claims, and sources are separate node types. Relationships have types and direction, so a reader can traverse from an object to possible contexts, or from a goal to the objects and capabilities it needs. The UI's lenses are views over this same typed graph:

- `all` shows every supported relationship.
- `context` emphasizes scenes, roles, states, and resource requirements.
- `goals` emphasizes intents, goal states, and task definitions.
- `execution` emphasizes capabilities and proposed procedures.

No lens establishes an ontology order. A procedure is connected to a goal, but is not the definition of that goal.

## Context assessment

The task API receives a declared context: scene, contents, role, confirmed objects, capabilities, conditions, blockers, an asset profile, and a mode. The assessment engine compares those declarations with the planning requirements. It returns one of four statuses:

| Status | Meaning |
| --- | --- |
| `ready` | Declared planning requirements are met. This is not a robot-success result. |
| `needs_changes` | A known resource or context mismatch can be repaired, such as adding a required object. |
| `unknown` | A requirement has not been confirmed. |
| `blocked` | A safety blocker or unsupported asset capability prevents the proposed setup. |

`explore` mode keeps all candidates so missing prerequisites remain discoverable. `ready` mode only retains candidates whose declared requirements are met. The engine does not calculate a combined priority score; it orders by assessment and English name.

## API boundaries

The server owns seed loading, validation, graph traversal, assessment, and export. The browser owns context selection and presentation. There is no persistence or claim-review workflow yet.

| Endpoint | Responsibility |
| --- | --- |
| `GET /api/context-options` | Enumerates valid roles, contents, profiles, resources, capabilities, and conditions. |
| `GET /api/tasks` | Lists candidates assessed against declared context. |
| `GET /api/tasks/:id` | Returns task identity, planning, claims, assessment, and proposed procedures. |
| `GET /api/tasks/:id/collection-card` | Turns one candidate and a declared context into a collection specification. |
| `GET /api/nodes/:id/neighbors` | Returns typed graph neighbors under an optional lens. |
| `GET /api/export/tasks.json` and `.csv` | Exports candidates while preserving unknown claim values. |

Detailed query parameters and response semantics are maintained in the [foundation contract](foundation-contract.md). The API is at schema/API version `0.2`; it replaces the former `scores` and global `evidence_level` presentation with assessments and claim-scoped sources.

## Collection-card workflow

A collection card does not claim that a demonstration has worked. It records the initial state, goal, success criteria, required resources, setup, reset, quality checks, failure modes, consumables, context assumptions, asset status, sources, and unresolved requirements needed to try a collection session. A caller may choose one optional procedure, or leave it unset and retain the task goal plus alternative procedures.

This boundary makes the first MVP success test concrete: a reviewer can take a candidate into simulation or teleoperation preparation, identify an unmet condition or reset burden, and record that finding as a claim or planning update.
