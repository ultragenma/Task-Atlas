# Mustard walkthrough: from exploration to a collection card

This walkthrough uses the YCB resource `ycb_006_mustard_bottle` and the task
`task_return_mustard_to_refrigerator`. It demonstrates a collection-preparation
flow. It does not report a robot or simulator success.

## 1. Explore the object through a lens

Start the local server, then request the mustard object's neighborhood:

```bash
curl 'http://127.0.0.1:3000/api/nodes/ycb_006_mustard_bottle/neighbors?lens=context'
```

Repeat with `lens=goals` and `lens=execution`. These are different views of typed
relationships, not levels of a single tree. The context lens exposes scenes and
states; the goals lens reaches intents and task definitions; the execution lens
shows capability inventory and proposed procedures where planning exists.

## 2. Compare an unspecified and a declared context

Without resource and condition declarations, the task remains discoverable but
its readiness is unknown:

```bash
curl 'http://127.0.0.1:3000/api/tasks/task_return_mustard_to_refrigerator'
```

For a concrete real-world preparation declaration, state the scene, role, named
resources, capabilities, and conditions from the mustard planning record:

```bash
curl 'http://127.0.0.1:3000/api/tasks/task_return_mustard_to_refrigerator?scene_id=scene_dining_table&role=home_user&profile=real_world&available_objects=ycb_006_mustard_bottle,scene_refrigerator&capabilities=rigid_manipulation,articulated_closure&confirmed_conditions=initial_on_top_of_ycb_006_mustard_bottle_dining_table,initial_closed_ycb_006_mustard_bottle,initial_closed_refrigerator,initial_reachable_ycb_006_mustard_bottle'
```

The returned `assessment` explains each match or gap. A `ready` result means only
that the declared planning requirements are met. `execution_status` remains
`unverified` unless a separate robot-execution claim supports it.

To model a known absence, pass an explicitly empty `available_objects=` value. To
leave availability unknown, omit the parameter entirely. The first produces a
repairable missing-resource assessment; the second preserves uncertainty.

## 3. Keep the goal separate from alternatives

The task detail includes the goal state and two proposed procedures. For the
refrigerator task, the goal is stable across alternatives: the bottle is upright
inside storage and its door is closed. `procedure_open_storage_first` opens the
refrigerator before grasping the bottle. `procedure_carry_bottle_first` retains
the bottle while opening it. Neither procedure changes the goal or becomes the
only correct action sequence.

Inspect the exact procedure IDs exposed by your local seed:

```bash
curl 'http://127.0.0.1:3000/api/tasks/task_return_mustard_to_refrigerator?scene_id=scene_dining_table&role=home_user&profile=real_world&available_objects=ycb_006_mustard_bottle,scene_refrigerator&capabilities=rigid_manipulation,articulated_closure&confirmed_conditions=initial_on_top_of_ycb_006_mustard_bottle_dining_table,initial_closed_ycb_006_mustard_bottle,initial_closed_refrigerator,initial_reachable_ycb_006_mustard_bottle'
```

The `procedures` array is optional. Leaving `procedure_id` unset in the next step
exports the goal and both alternatives without choosing an execution order.

## 4. Export a collection card

Export the declared task context as a collection card:

```bash
curl 'http://127.0.0.1:3000/api/tasks/task_return_mustard_to_refrigerator/collection-card?scene_id=scene_dining_table&role=home_user&profile=real_world&available_objects=ycb_006_mustard_bottle,scene_refrigerator&capabilities=rigid_manipulation,articulated_closure&confirmed_conditions=initial_on_top_of_ycb_006_mustard_bottle_dining_table,initial_closed_ycb_006_mustard_bottle,initial_closed_refrigerator,initial_reachable_ycb_006_mustard_bottle' \
  -o mustard-refrigerator-collection-card.json
```

The card includes initial and goal states, context assumptions, required
resources, assessment reasons, setup, reset, quality checks, failure modes,
consumables, null timing fields until measured, claims, resolved sources, and
unresolved requirements. To select a proposed procedure, append either
`&procedure_id=procedure_open_storage_first` or
`&procedure_id=procedure_carry_bottle_first`. The selected procedure adds its own
condition to the assessment. For example, the first procedure is ready only when
the request also includes `refrigerator_door_clear`:

```text
&procedure_id=procedure_open_storage_first&confirmed_conditions=initial_on_top_of_ycb_006_mustard_bottle_dining_table,initial_closed_ycb_006_mustard_bottle,initial_closed_refrigerator,initial_reachable_ycb_006_mustard_bottle,refrigerator_door_clear
```

Use `bottle_safe_to_hold_while_opening` instead for
`procedure_carry_bottle_first`.

Before a teleoperation or simulation session, treat the card as a review checklist:

1. Build the stated initial scene and verify the shelf clearance.
2. Check whether the available asset and robot can represent the required door and
   placement interaction.
3. Perform the setup and reset steps, recording any missing condition, safety
   issue, or reset burden.
4. Add the observation as a scoped claim or planning update rather than treating a
   single trial as general robot capability evidence.

For a dispensing task, choose the relevant mustard candidate in the task list and
declare its food target. If the target object is absent, explore mode keeps the
candidate visible and the card names the resource that must be added. A
`rigid_sim` profile may block squeezing, cap opening, or material flow; that says
the selected asset profile is insufficient, not that the everyday task is
meaningless.
