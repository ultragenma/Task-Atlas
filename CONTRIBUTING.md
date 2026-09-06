# Contributing to Physical AI Task Atlas

Thank you for helping make task candidates inspectable before they become data-collection work.

## Before opening a change

Use Node.js 18 or later, read the [foundation contract](docs/foundation-contract.md), and run:

```bash
npm run check
```

GitHub Actions runs this check on Node.js 22 and 24 for every push and pull request.

## Data model rules

Contributions should preserve these distinctions:

- A task is a goal with initial and success states. A procedure is an optional, reviewable way to pursue that goal.
- Requirements and declared context determine an assessment. Do not add a weighted score or silently infer an absent condition.
- Record a source against the individual claim it supports, including the source type, scope, limitations, stable locator, and version or access date where available.
- Record population frequency only with its target population, measurement period, activity granularity, meaning, and source. Keep derived relationships and unknown values explicit.
- Keep concept suitability, asset compatibility, and robot execution as separate claims.
- A collection card is a preparation specification, not evidence of a successful robot run.

For a changed schema, update the validator and focused tests. Use stable lowercase `snake_case` IDs and keep display strings separate from IDs; see [ontology](docs/ontology.md).

## Pull requests

Describe the behavior a reviewer can inspect, the affected records or endpoints, and the commands you ran. Keep claims and source changes small enough to trace from source to record to UI or export. Write commit messages in English with a concise imperative summary, for example: `Add a scoped asset-compatibility claim`.

Maintainers decide repository licensing. Do not add a license file as an incidental part of an unrelated contribution.
