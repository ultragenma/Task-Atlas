# Catalog-wide YCB task proposals

The coverage target is every record in `data/seeds/objects.json`, including separately listed parts and variants. This is coverage of the repository catalog, not a claim that every YCB release or downloadable asset is represented.

Catalog-wide proposals are stored in `data/seeds/ycb_batches/`. Each JSON bundle contains `tasks`, `planning`, and `claims`, with optional `scenes` and `templates`. The runtime and validator share the same sorted bundle loader. Existing mustard seeds and its three expansion loops remain separate.

## First coverage round

| Bundle | Catalog range | New tasks |
| --- | --- | ---: |
| Food | 001–018 | 18 |
| Kitchen | 019–034 | 16 |
| Tools | 035–052 | 18 |
| Shapes and task objects | 053–077 | 25 |

The first round covers all 77 catalog records. Parts such as pitcher lids and box lids have their own tasks; both catalog rope instances remain distinct. Each new task has one planning record and four claim records. Earlier mustard tasks are retained separately.

Examples include matching a lid to its container, grouping fasteners, preparing table settings, organizing construction pieces, and recovering an object into a defined collection area. Review corrected detached-lid fitting, table-cloth use, recovery end states, and undeclared template roles before accepting the batch.

## Generation and review

The second round adds another distinct goal for every catalog object: 77 additional
tasks, plans, and sets of four claims in the `*_round2.json` bundles. Across both
rounds this is 154 new proposed tasks; together with the 68 existing mustard tasks,
the atlas contains 222 task definitions. These are collection proposals, not
demonstrations or measured successes.

The second round emphasizes inspection, alignment, assembly preparation, and
object-specific interactions: seating screwdriver tips, fitting a peg into a
checked hole, routing a rope, reading a timer, connecting compatible Duplo pieces,
and checking kitchen surfaces or packaging. Repeated goals across rounds are
rejected by the coverage test.

The generation brief assigns disjoint object groups to `gpt-5.6-luna` workers with `max` reasoning effort. Each worker reads the historical handoff and current foundation contract, then proposes an object-specific goal with observable initial and success conditions. Records include English and Japanese names, required objects and capabilities, setup, reset, quality checks, failure modes, and unmeasured time estimates. A later round must introduce a different goal or context for the object, not merely paraphrase its first task.

Review checks object identity, reference validity, goal specificity, explicit prerequisites, collection reset, and concept-level connections. Fragile objects, sharp tools, powered tools, chemicals, and food replicas need appropriate declared setup conditions; a catalog model does not establish functional or material behavior. Procedures are optional, and skill lists are unordered capability inventories.

All new tasks remain `proposed`. The `evidence_ycb_task_design` source supports proposed design suitability only. Population frequency, robot execution, and asset compatibility remain separate unknown claims. No success rates, frequency rankings, or collection durations are inferred.

## Graph connections

Tasks share scene, intent, skill, and template nodes. This supports paths such as object → task → intent → another task → another object, without imposing one hierarchy or claiming that tasks must occur in sequence. Graph neighborhoods support reverse traversal. The coverage regression checks connectivity using these concepts, excluding shared sources and claims so that provenance alone cannot make the graph appear connected.

Required objects also connect directly through `requires_resource` edges in the context lens. A lid-fitting task can connect its lid to the matching container. Additional fixtures such as trays and work surfaces appear as `resource:<id>` nodes, with reverse links to the tasks requiring them. These are declared collection resources, not additions to the YCB catalog.

## Validation

Run `npm run check` to validate references, schemas, planning, claims, catalog coverage, graph navigation, and collection-card access. Counts indicate catalog coverage only; they are not evidence of collected demonstrations or successful robot execution.

Run `npm run coverage:ycb` for a machine-readable inventory of each catalog object, its task IDs and titles, scenes, intents, and generation rounds. It exits with a nonzero status if any catalog object has no task.

The report also lists `required_catalog_objects` for each task and summarizes
cross-object dependencies by round. These are explicit collection prerequisites
from planning records. Shared scene/skill links and fixture resources are not
counted as catalog-partner edges, and edge counts do not measure task quality.
