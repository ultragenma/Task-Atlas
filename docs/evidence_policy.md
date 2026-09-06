# Evidence and claim policy

Task Atlas records evidence as support for a particular claim. It does not assign sources a universal A–F rank, and it does not turn source presence into a numeric task score.

## Claims are the unit of support

Each claim states a subject, claim type, statement, status, optional value and unit, scope, limitations, and source IDs. A claim can be `proposed`, `unknown`, or `supported`.

| Claim | Suitable source | What it does not establish |
| --- | --- | --- |
| A food-preparation activity appears in a surveyed population | Time-use survey with its population, period, and activity definition | Frequency of a particular mustard action |
| A mustard-bottle record exists in a catalog | Catalog metadata | Human prevalence or robot success |
| A proposed collection setup needs a plate | Design/planning record | That the setup has been run successfully |
| A robot completed an interaction | Run record or evaluated experiment | Cross-robot generality |

A source record must describe its type, the claim types it can support, scope, and limitations. Preserve a stable locator, release or paper version, and access date when available. Cite a source only where its supported claim type and scope match the claim.

## Frequency is explicit or unknown

`population_frequency` has a value only when the source, target population, activity granularity, and measurement meaning are recorded. A derived relation to a higher-level activity is kept as a distinct claim with its limitation. Dataset recurrence and research attention are different signals and must not be relabeled as population frequency.

The UI and exports show direct observations, derived indicators, and unknowns as different states. They do not compute a global priority, confidence, or frequency score from unrelated evidence.

## Proposed procedures and collection work

Procedures are proposed designs, with their own requirements and review status. They may cite planning sources, but no procedure implies that it is the only valid execution order or that it has been demonstrated. Use a collection card to expose what a future trial must settle: setup, reset, quality checks, failure modes, consumables, timing fields, and unresolved requirements.

When a simulation or teleoperation attempt reveals a missing condition or a reset burden, add a narrow claim or planning update describing the observation, its scope, and its limitation. Do not generalize one run into a robot-capability claim.

## Review practice

Review the source-to-claim connection, not a source's prestige in isolation. A review should answer: what does this source support, for whom or where, at what granularity, and what remains unknown? See the [contribution guide](../CONTRIBUTING.md) for the required provenance fields and [foundation contract](foundation-contract.md) for the record shape.
