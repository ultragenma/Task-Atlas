# Ontology and ID rules

Task Atlas represents a set of typed relationships. It does not flatten everyday activity into one parent-child hierarchy or make an execution trace the meaning of a task.

## Core records

| Record | Meaning | Example |
| --- | --- | --- |
| Object class | A reusable concept | condiment squeeze bottle |
| Object instance | A catalog or scene asset | `ycb_006_mustard_bottle` |
| Scene | A place and activity context | `scene_home_kitchen` |
| State / condition | A property that can affect suitability | contents are empty |
| Role | The situated actor's purpose | customer or staff |
| Intent | A goal category | storage or preparation |
| Task | A goal with initial and success states | return mustard to refrigeration |
| Requirement | A declared condition for a task or procedure | refrigerator space is available |
| Procedure | A proposed way to pursue a task | open first, then place; or hold first, then open |
| Skill | A capability inventory item | grasp or verify |
| Claim | One testable statement | the catalog contains a mustard-bottle asset |
| Source | Material supporting a claim | catalog, study, recording, or review |
| Collection card | A collection-ready rendering of a task and context | setup, reset, checks, and unresolved requirements |

Affordance, intent, task, skill, procedure, trajectory, source, and claim are not interchangeable. An object can be squeezable without a particular robot being able to squeeze its available asset; a task can make sense for a person even if a simulator cannot represent it.

## Requirements and context

Requirements are typed as `scene_id`, `role`, `contents`, `object`, `capability`, or `condition`. Repeated `scene_id`, `role`, or `contents` requirements are alternatives. Objects, capabilities, and conditions accumulate. A missing object therefore produces a repairable `needs_changes` assessment, while an omitted declaration remains `unknown`.

Task starting conditions are never silently inferred from a task definition. The caller declares what is present, missing, unknown, or blocked. This is why an explorer can retain a hot-dog dispensing task when the hot dog or plate is absent: the card explains what must be added rather than hiding the candidate.

## Capability and feasibility claims

Keep three questions distinct:

1. Is the task meaningful for the object concept?
2. Can the selected catalog or simulation asset represent the needed interaction?
3. Can a specified robot and setup execute it?

These are separate claims. A rigid asset profile may block fluid dispensing or squeezing, but it does not negate the concept-level task. `ready` only means the declared planning requirements match the context; robot execution remains `unverified` until supported by a claim.

## Claims and sources

Claims have an ID, subject, type, statement, status, value, unit, source IDs, scope, and limitations. Valid claim types include `catalog_identity`, `task_suitability`, `population_frequency`, `robot_execution`, and `asset_compatibility`. Task records do not duplicate this relationship with a task-level evidence list.

A source supports a particular claim type in a stated scope. A time-use survey can support a claim that food preparation occurs in a stated population; it does not directly establish the frequency of dispensing mustard. A catalog record can establish an asset identity; it cannot establish robot success. Unknown frequency is stored as an unknown claim with null value and unit, never converted into a numeric prior.

## IDs and language

- Use stable lowercase `snake_case` IDs.
- Use `ycb_{three-digit-id}_{canonical_name}` for YCB object instances.
- Use `scene_`, `state_`, `intent_`, and `skill_` prefixes for their respective records.
- Use verb-led IDs for reusable task definitions and unique IDs for bound tasks and procedures.
- Keep identifiers separate from display strings. Use `name_en` and `name_ja` where both translations are maintained.

The detailed planning and API wire format is the [foundation contract](foundation-contract.md).
