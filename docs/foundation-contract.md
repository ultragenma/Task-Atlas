# Context-driven exploration contract

Task Atlas separates a task's goal, the conditions under which it makes sense,
optional ways to perform it, and the evidence supporting individual claims.
The mustard-bottle slice is a worked example, not a frequency benchmark.

## Acceptance scenarios

- Changing contents from full to empty changes the assessment of dispensing and disposal.
- Changing a retail role from customer to staff changes the assessment of shopping and restocking.
- Missing objects stay visible in exploration mode, with an explanation of what to add.
- A rigid simulation asset cannot establish support for opening, squeezing, or material flow.
- A task can have multiple proposed procedures while retaining one goal definition.
- Unknown population frequency stays unknown in the API, UI, and exports.
- A selected task exports a collection card with context, checks, setup, reset, and unresolved requirements.
- Object, scene, intent, state, skill, and concept nodes can be explored in both directions; graph lenses are views over typed relationships.

## Seed records

`data/seeds/task_planning.json` is an array of records with these fields:

```text
id, task_id, requirements[], procedures[], collection
requirement: { key, value, reason }
key: contents | role | scene_id | object | capability | condition
procedure: { id, label, steps: [{ skill_id, description }], requirements: [], review_status }
collection: { success_criteria: [], setup: [], reset: [], quality_checks: [],
              failure_modes: [], consumables: [],
              time_estimates: { setup_minutes, execution_minutes, reset_minutes, review_minutes } }
```

Requirement values are strings. Resource and condition IDs use `snake_case` without
commas; predicate text belongs in the explanation. Repeated requirements for `role`, `contents`, or
`scene_id` are alternatives (OR within each key); object, capability, and condition
requirements are cumulative (AND). Time estimates are null until measured.
The planning records and procedures are proposed designs. `skills` on a task or
template denotes an unordered capability inventory, not a required execution order.

`data/seeds/claims.json` is an array:

```text
{ id, subject_id, claim_type, statement, status, value, unit, source_ids, scope, limitations }
claim_type: catalog_identity | task_suitability | population_frequency | robot_execution | asset_compatibility
status: proposed | unknown | supported
```

`statement`, `scope`, and `limitations` are explanatory strings; `source_ids` is an array.
Unknown claims have null value/unit and no supporting sources. A proposed task
suitability claim may cite the design seed. Catalog metadata cannot support
population frequency or robot execution. Evidence records describe their source
type, supported claim types, scope and limitations; they have no global grade or
invented confidence. Existing numeric task scores are removed.

Task records do not carry a second task-level evidence list. Resolve support
through the task's claims and each claim's `source_ids`; this keeps catalog
identity, task suitability, frequency, execution, and asset claims distinct.

## Context and assessment

The following query parameters apply to task lists, task detail, generation, and
collection-card export:

```text
scene_id=<scene ID>                 omitted = unspecified
contents=unknown|full|empty          default unknown
role=unknown|home_user|customer|staff
available_objects=<comma-separated resource IDs>
capabilities=<comma-separated capability IDs>
confirmed_conditions=<comma-separated condition IDs>
blocked_conditions=<comma-separated condition IDs>
profile=unknown|rigid_sim|real_world
mode=explore|ready                  default explore
```

Omitted resource/capability/condition lists mean unknown; an explicitly empty list
means none are confirmed available. Conditions of the selected task's starting
state are not assumed from the task definition. Asset profiles describe assumed
capabilities and are not validation of a particular robot or simulator.

Each candidate includes `assessment`:

```text
{ status, reasons: [{ kind, key, value, message }], missing_objects: [],
  unverified_conditions: [], capability_gaps: [], safety_blockers: [],
  execution_status: "unverified" }
status: ready | needs_changes | unknown | blocked
kind: satisfied | missing | unknown | conflict | unsupported | safety
```

`ready` means the declared planning requirements are met, not that a robot has
succeeded. Explicit safety blockers and unsupported asset capabilities produce
`blocked`; repairable context mismatches or absent resources produce
`needs_changes`; unresolved requirements produce `unknown`. Blocking reasons take
precedence over missing and unknown requirements. `explore` retains all statuses;
`ready` shows only candidates whose declared requirements are met. Default order is
assessment status followed by English name, with no weighted score.

## HTTP interface

Existing endpoints remain available with updated semantics:

- `GET /api/context-options` returns `data: { roles, contents, profiles, resources, capabilities, conditions, blocked_conditions }`; each option is `{ id, label }`.
- `GET /api/tasks?...` returns candidate summaries including assessment and the existing identity fields. Scene context assesses candidates instead of silently discarding alternatives.
- `GET /api/tasks/:id?...` returns the existing detail envelope plus `planning`, `claims`, `assessment`, and `procedures`. Each procedure includes its own assessment.
- `GET /api/tasks/:id/collection-card?...&procedure_id=...` returns `data` with schema version, task identity, context, initial/goal states, required resources, assessment, chosen procedure (or null), alternative procedures, collection fields, claims, sources, and unresolved requirements. An invalid procedure ID is a client error.
- `GET /api/nodes/:id/neighbors?lens=all|context|goals|execution` provides typed neighbors filtered by lens. Object class and affordance nodes support reverse traversal.
- `GET /api/export/tasks.json` and `.csv` preserve unknown evidence values and do not expose obsolete scores or A–F grades.

Unsupported query enum values are client errors. Unknown task and graph identities
remain 404. Template proposals for other catalog objects remain incomplete and
unknown until role bindings and conditions are reviewed; they cannot be exported
as if they were complete collection cards.

## Product language

The default interface and maintained documentation are English. The top page
provides Japanese navigation. Historical Japanese research and handoff notes remain
available and are marked as historical where they describe superseded behavior.
