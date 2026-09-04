# Ontology and ID rules

## 用語の分離

| 種別 | 役割 |
| --- | --- |
| ObjectClass | 一般概念。例: condiment squeeze bottle |
| ObjectInstance | YCBの具体的な個体。例: `ycb_006_mustard_bottle` |
| State | 物体やシーンの状態。例: `state_open` |
| SceneType | 場所・文脈。例: `scene_home_kitchen` |
| Intent | 目的。例: `intent_store` |
| TaskTemplate | 役割を持つ再利用可能なタスク定義 |
| TaskInstance | templateに物体・場所・対象をbindingした具体例 |
| Skill | 再利用可能なロボット能力。例: `skill_grasp` |
| MotionPrimitive | 低レベル動作。MVPではSkillのmetadataとして扱う |
| Evidence | 候補や関係を支える出所・観測・レビュー記録 |

Affordance、function、task、skill、trajectoryは同じものとして保存しない。特に「物理的に可能」は「人間が通常行う」や「頻度が高い」を意味しない。

## ID規則

- IDは英小文字のsnake_caseを基本にし、自然言語表示をIDにしない。
- YCB object instanceは`ycb_{三桁ID}_{canonical_name}`とする。
- Scene / State / Intent / Skillは`scene_` / `state_` / `intent_` / `skill_`で始める。
- Templateは動詞中心の`apply_condiment`形式にする。
- Instanceはbindingを含む`{verb}_{object}_{target}`形式にする。
- 日本語と英語は`name_ja`と`name_en`を分ける。

## スコアの向き

`human_frequency`、`scene_probability`、`robot_feasibility`、`coverage_value`、`transfer_value`は高いほど優先する。`collection_cost`だけは低いほど望ましいため、ランキングでは昇順にする。スコアは0から1の正規化値で、統計的な確率を意味しない場合がある。
