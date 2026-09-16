# Physical AI Task Atlas: Concept and Implementation Handoff

English · [日本語](physical_ai_task_atlas_handoff_ja.md)

> **Historical handoff note.** This file preserves the original design context.
> Its single-hierarchy diagrams, score-ranking proposals, and A–F evidence-level
> proposal are superseded. The maintained model uses a typed graph, contextual
> assessment, optional procedures, and claim-scoped sources; see the
> [foundation contract](docs/foundation-contract.md), [architecture](docs/architecture.md),
> and [evidence policy](docs/evidence_policy.md).

Last updated (original): 2026-09-04  
Document type: Design and implementation handoff for Codex  
Working title: **Physical AI Task Atlas** (possible abbreviation: PATA)

## 1. Purpose of this document

Build a **large-scale map for exploring actions systematically through objects, places, states, people, and goals**, so that Physical AI data-collection tasks can be explored, generated, and compared instead of being chosen from researchers' ideas or the limited task lists of existing benchmarks.

The first implementation will be a web tool with the YCB Object Set as its entry point. Clicking an object will reveal branches for possible actions, scenes, goals, states, required skills, and data-collection conditions.

This document provides enough detail for another Codex session to start designing and implementing the MVP without access to the original conversation.

---

## 2. Background and motivation

Datasets for robot learning, VLA models, and imitation learning are often created in this order:

1. Researchers select a small number of tasks.
2. They prepare scenes and objects.
3. They collect data through teleoperation or automatic generation.
4. They train and evaluate a model.

This approach leads to several problems:

- It is difficult to explain why particular tasks were selected.
- Selection favors tasks that are convenient for research, such as `pick and place`.
- Actions common in everyday human life do not necessarily match those common in benchmarks.
- Variations in object state, location of use, user, and responses to abnormal situations are missed.
- It is difficult to compare actions that are abundant in existing data with those that are missing.
- Task names, goal states, skills, and trajectories are conflated.

This concept reverses that order:

1. Explore objects, scenes, human life, and states.
2. Generate possible task candidates.
3. Rank them by human frequency, naturalness, feasibility, collection cost, and gaps in existing data.
4. Convert selected tasks into concrete data-collection specifications or simulator task definitions.

---

## 3. Long-term product vision

### 3.1 Basic interaction

Users can begin exploring from any of these entry points:

- Object: mustard bottle, mug, scissors
- Scene: kitchen, supermarket, office
- State: empty, open, dirty, fallen
- Goal/Intent: store, serve, clean, discard
- Skill: grasp, pour, handover, wipe
- Agent: adult, child, worker, wheelchair user, robot
- Dataset: YCB, BEHAVIOR-1K, RoboCasa, Ego4D
- Robot/Embodiment: Franka, mobile manipulator, bimanual robot

Related nodes and tasks expand from the selected node as a clickable graph.

### 3.2 Zooming from macro to micro

```text
Society, country, culture
  └─ Life domain (home, workplace, public space)
      └─ Place (kitchen, store, office)
          └─ Scene (objects, people, arrangement)
              └─ Situation (object states, goals, abnormalities)
                  └─ Task
                      └─ Subtask
                          └─ Robot skill
                              └─ Motion, contact, sensor information
```

Objects serve as entry points across this hierarchy. For example, a mustard bottle can lead to different domains such as homes, restaurants, supermarkets, and waste management.

### 3.3 Intended outputs

Eventually, each task should support the following outputs:

- Natural-language task instructions
- Initial and goal states
- Required and optional objects
- Location and arrangement conditions
- Required skill sequences
- Success criteria
- Typical failure modes
- Safety considerations
- Candidates for initial-state randomization
- Execution requirements, such as single-arm, bimanual, or mobile capabilities
- Recommended cameras and sensors
- Suitability for simulation or real hardware
- Data-collection difficulty and recommended episode counts
- Export to JSON, CSV, BDDL-like definitions, and other formats

---

## 4. Distinguishing key concepts

Do not treat all of the following as the same kind of “action.”

| Concept | Meaning | Mustard example |
| --- | --- | --- |
| Physical affordance | A physically possible interaction | graspable, squeezable, placeable |
| Function | An intended use by design or social convention | Applying a condiment to food |
| Conventional action | An action people ordinarily perform | Returning the bottle to the refrigerator after use |
| Intent/Goal | The purpose to achieve | Preparing a meal, tidying up |
| Task | A semantic change from an initial state to a goal state | Placing mustard inside the refrigerator |
| Subtask | An intermediate unit within a task | Opening the refrigerator |
| Skill | A reusable robot capability | grasp, open, place, handover |
| Motion primitive | A low-level movement | approach, close gripper, lift |
| Trajectory/Demonstration | Actual time-series data | A sequence of joints, actions, and observations |

In particular, being throwable is a physical affordance, but throwing a mustard bottle is not necessarily a frequent or appropriate task.

---

## 5. Existing resources and how this concept differs

### 5.1 YCB Object and Model Set

A standard object set that serves as the entry point. It includes everyday items, food containers, and tools, with RGB-D data, point clouds, meshes, and physical information available.

- Official data: <https://registry.opendata.aws/ycb-benchmarks/>
- Paper: <https://arxiv.org/abs/1502.03143>

YCB provides a useful physical anchor but does not contain rich everyday-task semantics. This tool will connect it as follows:

```text
YCB object instance
  → General object category
  → WordNet / BEHAVIOR synset
  → Property / affordance
  → Task template
  → Grounded task instance
```

### 5.2 BEHAVIOR-1K / BEHAVIOR Knowledgebase

The resource closest to this concept and the highest priority to consider for reuse.

- 1,000 everyday activities
- 50 scenes
- More than 1,900 object categories
- More than 9,000 3D objects
- Synsets aligned with WordNet and other resources
- Object properties, predicates, states, and transition rules
- Initial and goal conditions expressed in BDDL

Links:

- Knowledgebase: <https://behavior.stanford.edu/behavior_components/behavior_knowledgebase.html>
- Paper: <https://arxiv.org/abs/2403.09227>
- Repository: <https://github.com/StanfordVL/BEHAVIOR-1K>
- BDDL: <https://github.com/StanfordVL/bddl-100>

The BEHAVIOR Knowledgebase allows web-based exploration among synsets, categories, objects, scenes, tasks, and transition rules.

The main differences from this concept are:

- BEHAVIOR is organized around predefined tasks.
- This concept generates task candidates by working backward from arbitrary objects, states, and scenes.
- BEHAVIOR's human surveys primarily measure preferences for activities people want robots to perform, which differs from their frequency in real life.
- This concept also considers data-collection costs, feasibility for a target robot, and gaps in existing data.

BDDL can express initial and goal conditions logically, but it is not a complete planning language with action symbols. Goal specifications and execution procedures should therefore remain separate.

### 5.3 VirtualHome

Represents household activities as programs of atomic actions and environment graphs.

- <https://github.com/xavierpuigf/virtualhome>

Potential uses:

- Decomposing natural-language tasks into subtask sequences
- Seeding an atomic action vocabulary
- Representing scene-graph state changes during task execution

### 5.4 RoboCasa / RoboCasa365

Provides many scenes, tasks, and demonstrations in the kitchen domain.

- <https://robocasa.ai/>

Use it as a dense source of kitchen tasks, scenes, and demonstrations, not as a representation of worldwide action frequencies.

### 5.5 Human activity frequency data

Consider the following evidence sources to distinguish task possibility from real-world frequency:

- ICATUS 2016: An international classification of time-use activities
  - <https://unstats.un.org/unsd/demographic-social/time-use/icatus-2016/tableview>
- MTUS: Multinational 24-hour time-use diaries
  - <https://www.timeuse.org/mtus>
- ATUS: Detailed U.S. activities, locations, companions, and demographic attributes
  - <https://www.bls.gov/tus/>
- Japan's Survey on Time Use and Leisure Activities
  - <https://www.stat.go.jp/english/data/shakai/index.html>
- OECD Time Use Database
  - <https://www.oecd.org/en/data/datasets/time-use-database.html>

Time-use activity codes are usually broad, such as “food preparation” or “cleaning up.” They do not directly provide the frequency of “returning mustard to the refrigerator.” When estimating lower-level task frequencies from higher-level activity statistics, distinguish estimates from direct observations.

### 5.6 Video and demonstration data

- Ego4D: <https://ego4d-data.org/>
- EPIC-KITCHENS: <https://epic-kitchens.github.io/>
- Charades: <https://prior.allenai.org/projects/charades>

Uses:

- Object–verb co-occurrence
- States and arrangements within scenes
- Task substeps
- Hand–object interactions
- Natural-language expressions

Do not interpret occurrence rates in video datasets as activity frequencies in the general population. Collectors, locations, and recording purposes introduce strong biases.

### 5.7 Disability and functioning classifications

- WHO ICF: <https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health>
- WHODAS 2.0: <https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule>
- UNICEF/Washington Group Child Functioning Module:
  - <https://data.unicef.org/topic/child-disability/data-collection-tools/module-on-child-functioning/>

Represent task difficulty, assistance needs, and the potential for robotic substitution through functional dimensions such as vision, hearing, cognition, mobility, self-care, and upper-limb manipulation, rather than diagnoses alone.

---

## 6. Data model

### 6.1 Basic approach

A simple `object -- action` graph is insufficient. Many tasks are multi-argument relationships involving a primary object, container, tool, target, place, person, initial state, and goal state.

Represent tasks as independent `TaskTemplate` / `TaskInstance` nodes or records, rather than simple edges.

### 6.2 Main node types

| Type | Example |
| --- | --- |
| ObjectClass | condiment bottle |
| ObjectInstance | YCB 006 mustard bottle |
| Material | mustard, water |
| ObjectPart | cap, nozzle, handle |
| Property | graspable, squeezable, breakable |
| State | open, empty, dirty, upright |
| SceneType | kitchen, supermarket |
| SceneInstance | specific kitchen layout |
| SpatialRelation | inside, on-top-of, near |
| AgentProfile | adult, child, worker, wheelchair user |
| Intent | prepare-food, store, discard |
| TaskTemplate | store-object, apply-condiment |
| TaskInstance | put YCB mustard in refrigerator |
| Skill | grasp, pour, wipe, handover |
| MotionPrimitive | approach, lift, rotate |
| Embodiment | Franka, mobile manipulator, bimanual robot |
| Dataset | YCB, BEHAVIOR-1K, RoboCasa |
| Evidence | observation, survey, manual, LLM proposal |

### 6.3 Main relations

```text
is_a
instance_of
part_of
contains
has_property
can_have_state
usually_located_in
located_in
located_on
affords
used_for
participates_in
requires
has_precondition
has_goal
produces_state
compatible_with_scene
incompatible_with
observed_in
performed_by
co_occurs_with
executable_by
supported_by
```

### 6.4 Recommended TaskTemplate fields

```yaml
id: apply_condiment
name:
  en: apply condiment to food
  ja: 食品に調味料をかける
verb: apply
roles:
  theme: condiment
  container: dispensing_container
  target: food
  tool: optional
compatible_scenes:
  - kitchen
  - dining_area
preconditions:
  - contains(container, theme)
  - openable(container)
  - near(container, target)
goals:
  - on_top_of(theme, target)
skills:
  - grasp
  - open
  - orient
  - dispense
  - close
failure_modes:
  - spill
  - over_dispense
  - drop_container
safety_tags:
  - food_handling
```

### 6.5 Recommended TaskInstance fields

```yaml
id: apply_ycb_mustard_to_hotdog
template_id: apply_condiment
bindings:
  theme: mustard
  container: ycb_006_mustard_bottle
  target: hot_dog
scene: dining_table
initial_state:
  - closed(ycb_006_mustard_bottle)
  - contains(ycb_006_mustard_bottle, mustard)
  - on_top_of(ycb_006_mustard_bottle, table)
goal_state:
  - on_top_of(mustard, hot_dog)
instruction_variants:
  - Put mustard on the hot dog.
  - Squeeze some mustard onto the hot dog.
  - ホットドッグにマスタードをかけてください。
scores:
  human_frequency: null
  scene_probability: null
  robot_feasibility: null
  collection_cost: null
evidence_ids: []
review_status: proposed
```

---

## 7. Task generation

### 7.1 Avoid manually registering large amounts of prose

Do not register these as separate task templates:

- Put mustard in the refrigerator.
- Put milk in the refrigerator.
- Put juice in the refrigerator.

Parameterize them instead:

```text
store_in_cold_storage(
    object: refrigerated_object,
    destination: refrigerator
)
```

Generate a concrete TaskInstance only when object properties and scene conditions match.

### 7.2 Candidate generation pipeline

```text
Selected Object/Scene/State
  → Retrieve synsets, properties, and affordances
  → Select applicable TaskTemplates
  → Bind roles
  → Check precondition consistency
  → Check scene compatibility
  → Check robot embodiment
  → Generate TaskInstances
  → Attach evidence
  → Rank by multiple scores
  → Human review
```

### 7.3 Role of LLMs

LLMs can be used for:

- Proposing unregistered task candidates
- Generating natural-language expressions
- Suggesting object-to-synset mappings
- Suggesting task substeps
- Suggesting failure modes
- Generating literature and video search queries

Do not automatically promote LLM output to confirmed data. Always record `generated_by: llm`, `review_status: proposed`, the model name, and the prompt or generation version.

---

## 8. Ranking and evidence

### 8.1 Do not rely on a single aggregate score

| Score | Meaning |
| --- | --- |
| physical_affordance | Is it physically possible? |
| functional_fit | Does it fit the intended function or use? |
| human_frequency | How often do people actually do it? |
| scene_probability | Is it natural in this location and arrangement? |
| semantic_confidence | How reliable is the ontology mapping? |
| robot_feasibility | Can the specified robot execute it? |
| safety | Is it safe for people, objects, food, and the environment? |
| collection_cost | What time, equipment, and failure rate does collection involve? |
| coverage_value | Is it missing from existing data? |
| transfer_value | How readily does it transfer to other objects or scenes? |

The UI should allow switching among ranking modes:

- Most frequent human activities
- Most natural scenes
- Easiest for the robot to execute
- Lowest data-collection cost
- Largest gaps in existing data
- Greatest transferability to other tasks

### 8.2 Evidence Level

```text
A: Directly observed in a representative time-use survey
B: Repeatedly observed in natural video or demonstration data
C: Present in peer-reviewed or widely used task definitions
D: Present in reliable materials such as product instructions, recipes, or work procedures
E: Confirmed as reasonable by a human expert or reviewer
F: An unverified candidate proposed only by an LLM
```

Store the following for each Evidence record:

```text
source_dataset
source_url_or_id
source_version
observed_count
population_or_scene
collection_method
confidence
reviewer
reviewed_at
notes
```

Clearly distinguish direct observations, estimates from higher-level categories, and LLM estimates.

---

## 9. Mustard vertical slice

### 9.1 Subject

- YCB ID: `006_mustard_bottle`
- General concepts: mustard bottle / condiment container / squeeze bottle
- Contents: mustard
- Main parts: body, cap, nozzle, label

### 9.2 Candidate states

```text
sealed / unsealed
open / closed
full / partially_full / nearly_empty / empty
upright / tilted / fallen
clean / dirty / sticky
leaking / not_leaking
refrigerated / room_temperature
held / on_surface / inside_receptacle
label_front / label_back
```

### 9.3 Candidate scenes

```text
home_kitchen
dining_table
refrigerator
pantry
restaurant_kitchen
restaurant_table
supermarket_shelf
shopping_cart
checkout_counter
trash_sorting_area
```

### 9.4 Candidate intents

```text
prepare_food
serve_food
store
retrieve
transport
handover
restock
inspect
clean
organize
discard
recover_from_error
```

### 9.5 Initial task candidates

1. Apply mustard to a hot dog.
2. Apply mustard to a sandwich.
3. Hand mustard to a person.
4. Return mustard from the dining table to the refrigerator.
5. Retrieve mustard from the refrigerator.
6. Carry mustard from the kitchen counter to the dining table.
7. Right a fallen mustard bottle.
8. Close an open cap.
9. Open the cap before use.
10. Wipe up leaked mustard.
11. Check whether the bottle is empty.
12. Discard an empty bottle in a trash bin.
13. Separate the cap and bottle for waste sorting.
14. Restock a supermarket shelf.
15. Align products to face the same direction.
16. Place the product in a shopping basket.
17. Place it on the checkout counter.
18. Organize it with other condiments.
19. Pick up a bottle that has fallen from the table.
20. Wipe dirt from the bottle's exterior.

### 9.6 Example decomposition

`Return mustard to the refrigerator`:

```text
locate(mustard_bottle)
approach(mustard_bottle)
grasp(mustard_bottle)
lift(mustard_bottle)
navigate_or_reach(refrigerator)
open(refrigerator)
place_inside(mustard_bottle, refrigerator)
release(mustard_bottle)
close(refrigerator)
verify(inside(mustard_bottle, refrigerator))
```

Example initial conditions:

```text
on_top_of(mustard_bottle, dining_table)
closed(mustard_bottle)
closed(refrigerator)
reachable(mustard_bottle)
```

Example goal conditions:

```text
inside(mustard_bottle, refrigerator)
closed(refrigerator)
upright(mustard_bottle)
```

Example failure modes:

```text
drop bottle
place bottle horizontally
leave refrigerator open
grasp cap instead of body
collide with shelf or door
place in wrong receptacle
```

---

## 10. MVP approach

### 10.1 MVP 1: Mustard vertical slice

Make the full YCB set browsable, but initially provide detailed semantic information only for `006_mustard_bottle`.

Minimum features:

- YCB object listing and search
- Object detail pages
- Mustard states, places, intents, tasks, and skills
- A graph with nodes that expand on click
- Task details
- Multi-axis ranking
- Evidence and confidence display
- JSON/CSV export
- Proposed/reviewed status management

Indicative initial data quantities:

- YCB object metadata: all records
- Deeply annotated objects: 1
- SceneTypes: 5–10
- TaskTemplates: 10–20
- Grounded TaskInstances: 50–100
- Skills: 15–30

### 10.2 MVP 2: Expansion to representative objects

Prioritize objects with different properties:

- cracker box
- tomato soup can
- mug
- bowl
- banana
- scissors
- power drill
- sponge
- pitcher

Questions to validate:

- Can TaskTemplates be reused for other objects?
- Can the model distinguish containers, food, tools, hazardous objects, and deformable objects?
- Can it adequately prune unnatural combinations from exhaustive generation?

### 10.3 MVP 3: Generating data-collection specifications

Generate the following from a task:

- simulator / real / both
- fixed-arm / mobile / bimanual
- Required objects and scenes
- Observation modalities
- Candidate action representations
- Success criteria
- Initial-state randomization
- Failure modes
- Difficulty
- Recommended episode counts
- Collection time estimates

---

## 11. Recommended technology stack

For the MVP, start with a structure that makes data easy to change and migrate rather than a dedicated graph database.

### 11.1 Recommended option

```text
Frontend: Next.js + TypeScript
Graph visualization: Cytoscape.js
Backend API: FastAPI or Next.js Route Handlers
Database MVP: SQLite
Database later: PostgreSQL
Validation: Pydantic / JSON Schema
Data import: Python scripts
Test: pytest + Vitest/Playwright
```

Reasons:

- Multi-argument TaskTemplate relationships are central, beyond nodes and relations alone.
- The schema will change frequently in the early stages.
- SQLite/PostgreSQL can support recursive queries and graph APIs.
- Cytoscape.js is sufficient for graph visualization in the UI.
- Synchronization to Neo4j or a similar system can be added when needed.

### 11.2 Recommended directory structure

```text
physical-ai-task-atlas/
├── README.md
├── LICENSE
├── docs/
│   ├── architecture.md
│   ├── ontology.md
│   ├── evidence_policy.md
│   └── data_sources.md
├── data/
│   ├── raw/
│   ├── mappings/
│   ├── seeds/
│   │   ├── objects.yaml
│   │   ├── scenes.yaml
│   │   ├── skills.yaml
│   │   ├── task_templates.yaml
│   │   └── mustard_tasks.yaml
│   └── generated/
├── schemas/
│   ├── object.schema.json
│   ├── task_template.schema.json
│   ├── task_instance.schema.json
│   └── evidence.schema.json
├── scripts/
│   ├── import_ycb.py
│   ├── import_behavior.py
│   ├── validate_seed_data.py
│   └── generate_task_instances.py
├── backend/
│   ├── app/
│   └── tests/
└── frontend/
    ├── app/
    ├── components/
    └── tests/
```

### 11.3 Proposed API

```text
GET  /api/objects
GET  /api/objects/{id}
GET  /api/nodes/{id}/neighbors
GET  /api/tasks
GET  /api/tasks/{id}
GET  /api/tasks/generate?object_id=...&scene_id=...
GET  /api/scenes
GET  /api/skills
GET  /api/search?q=...
POST /api/proposals
POST /api/reviews
GET  /api/export/tasks.json
GET  /api/export/tasks.csv
```

### 11.4 Proposed UI

```text
┌──────────────────────────────────────────────────────────────┐
│ Search: object / scene / state / skill / task               │
├──────────────┬───────────────────────────┬───────────────────┤
│ Filters      │ Interactive graph         │ Selected details  │
│              │                           │                   │
│ Object       │ Object → Intent → Task    │ Preconditions     │
│ Scene        │       → Scene → Skill     │ Goals             │
│ State        │                           │ Evidence          │
│ Robot        │ Click to expand/collapse  │ Scores            │
│ Rank mode    │                           │ Export            │
└──────────────┴───────────────────────────┴───────────────────┘
```

Avoid rendering the entire graph initially. Lazily expand only the selected node's neighborhood to prevent the view from becoming too large.

---

## 12. Initial database table proposal

```sql
CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    name_ja TEXT,
    description TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES nodes(id),
    relation_type TEXT NOT NULL,
    target_id TEXT NOT NULL REFERENCES nodes(id),
    confidence REAL,
    evidence_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE task_templates (
    id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    name_ja TEXT,
    definition_json TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'proposed'
);

CREATE TABLE task_instances (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES task_templates(id),
    bindings_json TEXT NOT NULL,
    initial_state_json TEXT NOT NULL,
    goal_state_json TEXT NOT NULL,
    score_json TEXT NOT NULL DEFAULT '{}',
    review_status TEXT NOT NULL DEFAULT 'proposed'
);

CREATE TABLE evidence (
    id TEXT PRIMARY KEY,
    evidence_level TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_version TEXT,
    source_locator TEXT,
    observation_count INTEGER,
    confidence REAL,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);
```

Allow JSON columns in the initial implementation, then normalize stable attributes later.

---

## 13. Important implementation rules

1. Do not use natural-language strings as IDs. Use stable canonical IDs.
2. Store Japanese and English names in separate fields.
3. Separate the YCB product instance from the general concept of a mustard bottle.
4. Separate the bottle from its mustard contents.
5. Separate affordance, function, task, skill, and trajectory.
6. Separate TaskTemplate and TaskInstance.
7. Separate possibility from frequency.
8. Separate human frequency from how much people want a robot to perform an activity.
9. Separate direct observations from estimates.
10. Keep LLM-generated data in the proposed state and preserve its provenance.
11. Record data-source versions, licenses, and acquisition dates.
12. Treat differences in behavior associated with attributes as probability distributions, not deterministic rules.
13. Indicate insufficient sample sizes when subdividing by age × gender × occupation × disability × country or similar dimensions.
14. Do not hide evidence behind a single aggregate score.
15. Do not use a simulator-specific format as the core schema.

---

## 14. MVP acceptance criteria

The first milestone is complete when all the following are satisfied:

- [ ] The README includes development environment setup instructions.
- [ ] The YCB object list can be displayed locally.
- [ ] `006_mustard_bottle` can be searched for and selected.
- [ ] Users can branch from mustard to Scene, State, Intent, Task, and Skill.
- [ ] Clicking nodes expands and collapses their neighborhoods.
- [ ] At least 20 mustard-related TaskInstances are registered.
- [ ] Each TaskInstance has initial conditions, goal conditions, and required skills.
- [ ] Each TaskInstance has an evidence level or an unverified indicator.
- [ ] Tasks can be sorted using at least two ranking methods.
- [ ] TaskInstances can be exported as JSON and CSV.
- [ ] Seed YAML/JSON can be validated against schemas.
- [ ] Unit tests pass.
- [ ] The main screens have been visually checked in a browser.
- [ ] Incomplete data is not displayed as confirmed data.

---

## 15. Recommended initial implementation order

1. Create the repository and README.
2. Establish core terminology and ID rules in `docs/ontology.md`.
3. Create JSON Schemas or Pydantic models.
4. Create manual mustard seed data.
5. Create seed validation tests.
6. Implement loading into SQLite.
7. Implement object, task, and neighbor APIs.
8. Build a minimal UI for lists, details, and neighborhood graphs.
9. Implement JSON/CSV export.
10. Add a YCB metadata importer.
11. Add mappings to BEHAVIOR synsets.
12. Add automatic TaskInstance generation and pruning.
13. Add ranking and Evidence display.
14. Run end-to-end checks with Playwright or similar tools.

Do not start by launching OmniGibson or importing all BEHAVIOR data. First use a small manual seed to validate the information structure and the value of the UI.

---

## 16. Open decisions

These decisions will need to be made during implementation but do not block starting the MVP:

- Official project and repository names
- License
- Whether to use a separate FastAPI backend or Next.js alone
- When to migrate from SQLite to PostgreSQL
- Whether WordNet synsets should be the primary canonical ontology
- How much BEHAVIOR data to import directly
- Whether to include BDDL-compatible export in the MVP
- The specific method for estimating human frequency
- When to add user submissions and reviews
- The linking format for real-robot datasets
- Export adapters for LIBERO, LeRobot, Open X-Embodiment, and similar formats

---

## 17. Initial prompt for Codex

Pass the following to a new Codex session together with this document:

```text
Read the attached physical_ai_task_atlas_handoff_en.md as the design
specification and begin implementing the Physical AI Task Atlas MVP.

The first goal is a local web application that uses the YCB object list
as its entry point and lets users branch from 006_mustard_bottle to
Scene, State, Intent, Task, and Skill.

First inspect existing files, available dependencies, and the execution
environment, then present an implementation plan and technology choices.
After that, implement autonomously wherever user approval is not needed,
and complete testing and browser display checks.

Important requirements:
- Separate TaskTemplate and TaskInstance.
- Do not conflate Affordance, Function, Task, Skill, and Trajectory.
- Do not treat LLM-generated candidates as confirmed information.
- Require Evidence and review_status.
- Validate seed data against schemas.
- Deliver a complete, locally working implementation, not just examples
  or pseudocode.
- Document setup, startup, and testing in the README.
- Finally, run actual test commands and inspect the main screens in a browser.
```

---

## 18. Concept summary

Physical AI Task Atlas goes beyond searching the task lists of existing benchmarks. It connects the following into one workflow:

```text
Objects, scenes, states, human life
  → Explore possible actions
  → Evaluate realism and evidence
  → Formalize tasks for robots
  → Convert them into data-collection specifications
```

The minimal implementation explores the YCB mustard bottle in depth and shows how a small number of general TaskTemplates generate many TaskInstances, and which evidence and conditions inform their ranking. Once this vertical slice works, expand progressively to the full YCB set, BEHAVIOR-1K, RoboCasa, time-use surveys, video data, and real-robot datasets.
