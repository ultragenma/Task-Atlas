# Physical AI Task Atlas 構想・実装引き継ぎメモ

> **Historical handoff note.** This file preserves the original design context.
> Its single-hierarchy diagrams, score-ranking proposals, and A–F evidence-level
> proposal are superseded. The maintained model uses a typed graph, contextual
> assessment, optional procedures, and claim-scoped sources; see the
> [foundation contract](docs/foundation-contract.md), [architecture](docs/architecture.md),
> and [evidence policy](docs/evidence_policy.md).

更新日: 2026-09-04  
文書種別: Codex向け設計・実装引き継ぎ  
仮称: **Physical AI Task Atlas**（略称候補: PATA）

## 1. この文書の目的

Physical AI向けのデータ収集タスクを、研究者の思いつきや既存ベンチマークの限定的なタスク一覧から選ぶのではなく、**物体・場所・状態・人・目的から体系的に探索、生成、比較できる大規模な行動探索マップ**を構築する。

最初の実装はYCB Object Setを入口とし、オブジェクトをクリックすると、その物体に対して考えられる行動、シーン、目的、状態、必要スキル、データ収集条件が分岐表示されるWebツールとする。

この文書は、別のCodexセッションが元の会話を参照できなくても、設計とMVP実装を開始できる粒度でまとめている。

---

## 2. 背景と問題意識

現在のロボット学習・VLA・模倣学習では、多くの場合、次の順序でデータセットが作られる。

1. 研究者が少数のタスクを選ぶ。
2. シーンと物体を準備する。
3. テレオペレーションまたは自動生成でデータを収集する。
4. モデルを学習・評価する。

この方法では、以下の問題が起きる。

- なぜそのタスクを選んだのか説明しにくい。
- `pick and place` のような研究上扱いやすいタスクへ偏る。
- 人間の日常生活で頻度の高い行動と、ベンチマーク上頻出する行動が一致しない。
- 物体の状態、使用場所、使用者、異常時対応などのバリエーションが抜ける。
- 既存データに多い行動と不足している行動を比較できない。
- タスク名、目標状態、スキル、軌道が混同される。

本構想では順序を逆転させる。

1. 物体、シーン、人間生活、状態を探索する。
2. 可能なタスク候補を生成する。
3. 人間頻度、自然さ、実行可能性、収集コスト、既存データの不足度で順位付けする。
4. 選択したタスクを、具体的なデータ収集仕様やシミュレータ用タスク定義へ変換する。

---

## 3. 最終的なプロダクト像

### 3.1 基本操作

ユーザーは以下のどの入口からでも探索を開始できる。

- Object: mustard bottle、mug、scissors
- Scene: kitchen、supermarket、office
- State: empty、open、dirty、fallen
- Goal/Intent: store、serve、clean、discard
- Skill: grasp、pour、handover、wipe
- Agent: adult、child、worker、wheelchair user、robot
- Dataset: YCB、BEHAVIOR-1K、RoboCasa、Ego4D
- Robot/Embodiment: Franka、mobile manipulator、bimanual robot

選択したノードから、関連するノードとタスクがクリック可能なグラフとして展開される。

### 3.2 マクロからミクロへのズーム

```text
社会・国・文化
  └─ 生活領域（家庭・職場・公共空間）
      └─ 場所（キッチン・店舗・オフィス）
          └─ シーン（物体・人・配置）
              └─ 状況（物体状態・目的・異常）
                  └─ タスク
                      └─ サブタスク
                          └─ ロボットスキル
                              └─ 運動・接触・センサー情報
```

オブジェクトはこの階層を横断する入口であり、例えばマスタードボトルから家庭、飲食店、スーパー、廃棄物処理など異なる領域へ移動できる。

### 3.3 最終的に生成したい出力

各タスクについて、将来的には以下を出力できるようにする。

- 自然言語タスク指示
- 初期状態と目標状態
- 必要物体と任意物体
- 場所と配置条件
- 必要スキル列
- 成功判定
- 代表的な失敗モード
- 安全上の注意
- 初期状態ランダム化候補
- 片腕・両腕・移動能力などの実行要件
- 推奨カメラ・センサー
- シミュレータ適性／実機適性
- データ収集難易度と推奨エピソード数
- JSON、CSV、BDDL風定義などへのエクスポート

---

## 4. 重要な概念の分離

このプロジェクトでは、以下を同じ「行動」として扱わないこと。

| 概念 | 意味 | マスタードでの例 |
|---|---|---|
| Physical affordance | 物理的に可能な相互作用 | graspable、squeezable、placeable |
| Function | 設計上または社会的に想定された用途 | 調味料を食品に付ける |
| Conventional action | 人間が通常行う行為 | 使用後に冷蔵庫へ戻す |
| Intent/Goal | 達成したい目的 | 食事を準備する、片付ける |
| Task | 初期状態から目標状態への意味的変化 | マスタードを冷蔵庫内に置く |
| Subtask | タスクを構成する中間単位 | 冷蔵庫を開ける |
| Skill | 再利用可能なロボット能力 | grasp、open、place、handover |
| Motion primitive | 低レベルの動作 | approach、close gripper、lift |
| Trajectory/Demonstration | 実際の時系列データ | joint/action/observation列 |

特に、`投げられる`ことは物理的affordanceだが、マスタードボトルの高頻度・高妥当性タスクとは限らない。

---

## 5. 既存資源と本構想との差分

### 5.1 YCB Object and Model Set

入口となる標準物体セット。日用品、食品容器、工具などを含み、RGB-D、点群、メッシュ、物理的情報を利用できる。

- 公式データ: <https://registry.opendata.aws/ycb-benchmarks/>
- 論文: <https://arxiv.org/abs/1502.03143>

YCBは物理アンカーとして優秀だが、豊富な日常タスク意味論は持たない。本ツールでは次のように接続する。

```text
YCB object instance
  → 一般物体カテゴリ
  → WordNet / BEHAVIOR synset
  → property / affordance
  → task template
  → grounded task instance
```

### 5.2 BEHAVIOR-1K / BEHAVIOR Knowledgebase

本構想に最も近く、最優先で再利用を検討すべき資源。

- 1,000の日常活動
- 50シーン
- 1,900以上の物体カテゴリ
- 9,000以上の3D物体
- WordNet等に対応したsynset
- 物体属性、述語、状態、transition rule
- BDDLによる初期条件と目標条件

リンク:

- Knowledgebase: <https://behavior.stanford.edu/behavior_components/behavior_knowledgebase.html>
- 論文: <https://arxiv.org/abs/2403.09227>
- リポジトリ: <https://github.com/StanfordVL/BEHAVIOR-1K>
- BDDL: <https://github.com/StanfordVL/bddl-100>

BEHAVIOR Knowledgebaseは、synset、カテゴリ、物体、シーン、タスク、transition rule間をWeb上で探索できる。

ただし本構想との主な差は以下。

- BEHAVIORは定義済みタスクを中心に整理している。
- 本構想は、任意の物体・状態・シーンからタスク候補を逆引き生成する。
- BEHAVIORの人間調査は主に「ロボットにしてほしい活動」の選好であり、実生活での発生頻度とは異なる。
- 本構想はデータ収集コスト、対象ロボットの実行可能性、既存データの不足度も扱う。

BDDLは初期条件と目標条件を論理的に表せるが、行動記号を持つ完全なプランニング言語ではない。したがって、目標仕様と実行手順は分離する。

### 5.3 VirtualHome

家庭活動を、原子的行動のプログラムと環境グラフとして表現する。

- <https://github.com/xavierpuigf/virtualhome>

利用候補:

- 自然言語タスクからサブタスク列への分解
- atomic action vocabularyの種
- タスク実行に伴うシーングラフの状態変化

### 5.4 RoboCasa / RoboCasa365

キッチン領域の多数のシーン、タスク、実演データを持つ。

- <https://robocasa.ai/>

本ツールでは、キッチン領域の高密度なタスク・シーン・実演データとして利用する。世界全体の行動頻度を表すものとしては扱わない。

### 5.5 人間の行動頻度データ

タスクの「可能性」と「現実の頻度」を分けるため、以下を根拠候補とする。

- ICATUS 2016: 国際的な生活行動分類
  - <https://unstats.un.org/unsd/demographic-social/time-use/icatus-2016/tableview>
- MTUS: 多国間の24時間生活時間日記
  - <https://www.timeuse.org/mtus>
- ATUS: 米国の詳細な行動、場所、同行者、属性
  - <https://www.bls.gov/tus/>
- 日本の社会生活基本調査
  - <https://www.stat.go.jp/english/data/shakai/index.html>
- OECD Time Use Database
  - <https://www.oecd.org/en/data/datasets/time-use-database.html>

生活時間調査の行動コードは、通常「食品の準備」「片付け」など粒度が粗く、「マスタードを冷蔵庫へ戻す」そのものの頻度は得られない。そのため上位活動の統計から下位タスク頻度を推定する際は、推定値と直接観測値を区別する。

### 5.6 映像・実演データ

- Ego4D: <https://ego4d-data.org/>
- EPIC-KITCHENS: <https://epic-kitchens.github.io/>
- Charades: <https://prior.allenai.org/projects/charades>

用途:

- 物体と動詞の共起
- シーン内での状態・配置
- タスクのサブステップ
- 手と物体の相互作用
- 自然言語表現

注意: 映像データ内の出現割合を一般人口の行動頻度とみなさないこと。収集者、場所、撮影目的による強いバイアスがある。

### 5.7 障害・機能分類

- WHO ICF: <https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health>
- WHODAS 2.0: <https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health/who-disability-assessment-schedule>
- UNICEF/Washington Group Child Functioning Module:
  - <https://data.unicef.org/topic/child-disability/data-collection-tools/module-on-child-functioning/>

診断名だけでなく、視覚、聴覚、認知、移動、セルフケア、上肢操作などの機能単位で、タスク難易度・支援需要・ロボットによる代替可能性を表現する。

---

## 6. データモデル

### 6.1 基本方針

単純な `object -- action` グラフでは不十分。多くのタスクは、主対象、容器、道具、適用先、場所、人物、初期状態、目標状態を含む多項関係である。

そのため、タスクを単なるエッジではなく、独立した `TaskTemplate` / `TaskInstance` ノードまたはレコードとして扱う。

### 6.2 主要ノード

| 種別 | 例 |
|---|---|
| ObjectClass | condiment bottle |
| ObjectInstance | YCB 006 mustard bottle |
| Material | mustard、water |
| ObjectPart | cap、nozzle、handle |
| Property | graspable、squeezable、breakable |
| State | open、empty、dirty、upright |
| SceneType | kitchen、supermarket |
| SceneInstance | specific kitchen layout |
| SpatialRelation | inside、on-top-of、near |
| AgentProfile | adult、child、worker、wheelchair user |
| Intent | prepare-food、store、discard |
| TaskTemplate | store-object、apply-condiment |
| TaskInstance | put YCB mustard in refrigerator |
| Skill | grasp、pour、wipe、handover |
| MotionPrimitive | approach、lift、rotate |
| Embodiment | Franka、mobile manipulator、bimanual robot |
| Dataset | YCB、BEHAVIOR-1K、RoboCasa |
| Evidence | observation、survey、manual、LLM proposal |

### 6.3 主要リレーション

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

### 6.4 TaskTemplateの推奨フィールド

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

### 6.5 TaskInstanceの推奨フィールド

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

## 7. タスク生成方式

### 7.1 文章を大量に手登録しない

以下を別々のタスクテンプレートとして登録しない。

- マスタードを冷蔵庫に入れる
- 牛乳を冷蔵庫に入れる
- ジュースを冷蔵庫に入れる

代わりにパラメータ化する。

```text
store_in_cold_storage(
    object: refrigerated_object,
    destination: refrigerator
)
```

物体属性とシーン条件が一致する場合だけ、具体的なTaskInstanceを生成する。

### 7.2 候補生成パイプライン

```text
選択されたObject/Scene/State
  → synset・属性・affordance取得
  → 適用可能なTaskTemplate抽出
  → role binding
  → precondition整合性検査
  → scene compatibility検査
  → robot embodiment検査
  → TaskInstance生成
  → evidence付与
  → 複数スコアでランキング
  → 人間レビュー
```

### 7.3 LLMの位置付け

LLMは次に利用できる。

- 未登録タスク候補の提案
- 自然言語表現の生成
- オブジェクトとsynsetの対応候補
- タスクのサブステップ候補
- 失敗モード候補
- 文献・映像検索用クエリ生成

ただしLLM出力は自動的に確定データへ昇格させない。必ず `generated_by: llm`、`review_status: proposed`、モデル名、プロンプトまたは生成バージョンを保存する。

---

## 8. ランキングと根拠

### 8.1 単一の総合スコアだけにしない

| スコア | 意味 |
|---|---|
| physical_affordance | 物理的に可能か |
| functional_fit | 本来の機能・用途に合うか |
| human_frequency | 人が現実に行う頻度 |
| scene_probability | その場所・配置で自然か |
| semantic_confidence | オントロジー対応の信頼度 |
| robot_feasibility | 指定ロボットで実行可能か |
| safety | 人、物、食品、環境への安全性 |
| collection_cost | 収集に必要な時間・設備・失敗率 |
| coverage_value | 既存データに不足しているか |
| transfer_value | 他物体・他シーンへ転用しやすいか |

UI上では、以下のランキングモードを切り替えられるようにする。

- 人間がよく行う順
- シーンとして自然な順
- ロボットが実行しやすい順
- データ収集コストが低い順
- 既存データが不足している順
- 他タスクへ転用しやすい順

### 8.2 Evidence Level

```text
A: 代表性のある生活時間調査で直接観測
B: 自然な映像・実演データで反復観測
C: 査読済みまたは広く利用されるタスク定義に存在
D: 製品説明、レシピ、作業手順など信頼できる資料に存在
E: 人間の専門家またはレビュー担当者が妥当と確認
F: LLMのみが提案した未検証候補
```

各Evidenceには以下を保存する。

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

直接観測、上位カテゴリからの推定、LLM推定を明確に区別する。

---

## 9. Mustard vertical slice

### 9.1 対象

- YCB ID: `006_mustard_bottle`
- 一般概念: mustard bottle / condiment container / squeeze bottle
- 内容物: mustard
- 主要部品: body、cap、nozzle、label

### 9.2 状態候補

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

### 9.3 シーン候補

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

### 9.4 Intent候補

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

### 9.5 初期タスク候補

1. ホットドッグにマスタードをかける。
2. サンドイッチにマスタードをかける。
3. マスタードを人へ手渡す。
4. 食卓のマスタードを冷蔵庫へ戻す。
5. 冷蔵庫からマスタードを取り出す。
6. キッチンカウンターから食卓へ運ぶ。
7. 倒れたマスタードボトルを起こす。
8. 開いたキャップを閉じる。
9. 使用前にキャップを開ける。
10. 漏れたマスタードを拭き取る。
11. 空かどうか確認する。
12. 空ボトルをゴミ箱へ捨てる。
13. 分別のためキャップとボトルを分ける。
14. スーパーの商品棚に補充する。
15. 商品の向きを揃える。
16. 商品を買い物かごへ入れる。
17. レジ台へ置く。
18. 他の調味料とまとめて整頓する。
19. テーブルから落ちたボトルを拾う。
20. ボトル外面の汚れを拭く。

### 9.6 代表的な分解

`マスタードを冷蔵庫へ戻す`:

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

初期条件例:

```text
on_top_of(mustard_bottle, dining_table)
closed(mustard_bottle)
closed(refrigerator)
reachable(mustard_bottle)
```

目標条件例:

```text
inside(mustard_bottle, refrigerator)
closed(refrigerator)
upright(mustard_bottle)
```

失敗モード例:

```text
drop bottle
place bottle horizontally
leave refrigerator open
grasp cap instead of body
collide with shelf or door
place in wrong receptacle
```

---

## 10. MVP方針

### 10.1 MVP 1: Mustard vertical slice

YCB全体を一覧表示可能にするが、意味情報を深く整備するのは最初は `006_mustard_bottle` のみとする。

最低機能:

- YCBオブジェクト一覧と検索
- オブジェクト詳細ページ
- Mustardの状態、場所、目的、タスク、スキル表示
- クリックでノードを展開するグラフ
- タスク詳細表示
- 複数軸のランキング
- Evidenceと信頼度表示
- JSON/CSV出力
- 提案／レビュー済みの状態管理

初期データ量の目安:

- YCB object metadata: 全件
- 深く注釈したobject: 1件
- SceneType: 5～10件
- TaskTemplate: 10～20件
- Grounded TaskInstance: 50～100件
- Skill: 15～30件

### 10.2 MVP 2: 代表物体への水平展開

性質が異なる以下の物体を優先する。

- cracker box
- tomato soup can
- mug
- bowl
- banana
- scissors
- power drill
- sponge
- pitcher

検証事項:

- TaskTemplateが別物体でも再利用できるか。
- 容器、食品、道具、危険物、変形物の違いを表せるか。
- 不自然な総当たり生成を十分に枝刈りできるか。

### 10.3 MVP 3: データ収集仕様の生成

タスクから以下を出力する。

- simulator / real / both
- fixed-arm / mobile / bimanual
- 必要物体とシーン
- observation modalities
- action representation候補
- 成功判定
- 初期状態ランダム化
- 失敗モード
- 難易度
- 推奨episode数
- 収集時間見積り

---

## 11. 推奨技術構成

MVPでは専用グラフDBから始めず、データの変更と移植が容易な構成にする。

### 11.1 推奨案

```text
Frontend: Next.js + TypeScript
Graph visualization: Cytoscape.js
Backend API: FastAPI または Next.js Route Handlers
Database MVP: SQLite
Database later: PostgreSQL
Validation: Pydantic / JSON Schema
Data import: Python scripts
Test: pytest + Vitest/Playwright
```

理由:

- ノードとリレーションだけでなくTaskTemplateという多項関係が中心になる。
- 初期段階ではスキーマ変更が多い。
- SQLite/PostgreSQLでも再帰クエリとグラフ用APIを実装できる。
- UI側はCytoscape.jsで十分にグラフ表示できる。
- 必要になった段階でNeo4j等へ同期できる。

### 11.2 推奨ディレクトリ構成

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

### 11.3 API案

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

### 11.4 UI案

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

表示が巨大化しないよう、最初から全グラフを描画せず、選択ノードの近傍だけを遅延展開する。

---

## 12. 初期のDBテーブル案

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

初期実装ではJSON列を許容するが、安定した属性は後から正規化する。

---

## 13. 実装上の重要ルール

1. 自然言語の文字列をIDにしない。安定したcanonical IDを持つ。
2. 日本語名と英語名を別フィールドにする。
3. YCBの製品個体と、一般概念のmustard bottleを分離する。
4. ボトルと内容物のmustardを分離する。
5. Affordance、function、task、skill、trajectoryを分離する。
6. TaskTemplateとTaskInstanceを分離する。
7. 可能性と頻度を分離する。
8. 人間頻度と「ロボットにしてほしい度」を分離する。
9. 直接観測値と推定値を分離する。
10. LLM生成データはproposed状態に置き、出所を保存する。
11. データソースのバージョン、ライセンス、取得日を記録する。
12. 属性による行動差は決定論ではなく確率分布として扱う。
13. 年齢×性別×職業×障害×国などの細分化で標本数が不足する場合は表示する。
14. 一つの総合点だけで根拠を隠さない。
15. シミュレータ固有形式をコアスキーマにしない。

---

## 14. MVP受け入れ条件

最初のマイルストーンは、以下をすべて満たしたとき完了とする。

- [ ] 開発環境のセットアップ手順がREADMEにある。
- [ ] YCBオブジェクト一覧をローカルで表示できる。
- [ ] `006_mustard_bottle`を検索・選択できる。
- [ ] マスタードからScene、State、Intent、Task、Skillへ分岐できる。
- [ ] ノードをクリックして近傍を展開・折り畳みできる。
- [ ] 20件以上のマスタード関連TaskInstanceが登録されている。
- [ ] 各TaskInstanceに初期条件、目標条件、必要スキルがある。
- [ ] 各TaskInstanceにevidence levelまたは未検証表示がある。
- [ ] 少なくとも2種類のランキングで並べ替えられる。
- [ ] TaskInstanceをJSONとCSVで出力できる。
- [ ] seed YAML/JSONをschema validationできる。
- [ ] ユニットテストが通る。
- [ ] ブラウザで主要画面を目視確認している。
- [ ] 不完全なデータを確定データとして表示しない。

---

## 15. 初期実装の推奨順序

1. リポジトリとREADMEを作成する。
2. コア用語とID規則を `docs/ontology.md` に固定する。
3. JSON SchemaまたはPydanticモデルを作る。
4. 手作業のmustard seed dataを作る。
5. seed validationテストを作る。
6. SQLiteへ投入する処理を作る。
7. object/task/neighbor APIを作る。
8. 一覧、詳細、近傍グラフの最小UIを作る。
9. JSON/CSV exportを作る。
10. YCB metadata importerを追加する。
11. BEHAVIOR synsetとのmappingを追加する。
12. 自動TaskInstance生成と枝刈りを追加する。
13. ランキングとEvidence表示を追加する。
14. Playwright等でE2E確認する。

重要: 最初からOmniGibsonを起動したり、全BEHAVIORデータを取り込んだりしない。まず手作業の小さなseedで、情報構造とUIの価値を検証する。

---

## 16. 未決定事項

以下は実装中に判断が必要だが、MVP開始を妨げない。

- 正式名称とリポジトリ名
- ライセンス
- FastAPIを分離するか、Next.js単体にするか
- SQLiteからPostgreSQLへ移行する時期
- WordNet synsetを主canonical ontologyにするか
- BEHAVIORデータのどこまでを直接取り込むか
- BDDL互換exportをMVPに含めるか
- 人間頻度推定モデルの具体的方法
- ユーザーによる投稿・レビュー機能をいつ追加するか
- 実機データセットとのリンク形式
- LIBERO、LeRobot、Open X-Embodiment等へのexport adapter

---

## 17. Codexへの最初の依頼文

以下を新しいCodexセッションへ、この文書とともに渡す。

```text
添付した `physical_ai_task_atlas_handoff_ja.md` を設計仕様として読み、
Physical AI Task AtlasのMVP実装を開始してください。

最初のゴールは、YCBオブジェクト一覧を入口とし、
006_mustard_bottleからScene、State、Intent、Task、Skillへ分岐できる
ローカルWebアプリです。

まず既存ファイル、利用可能な依存関係、実行環境を確認し、
実装計画と採用技術を提示してください。その後、ユーザーの承認が
不要な範囲は自律的に実装し、テストとブラウザ表示確認まで行ってください。

重要要件:
- TaskTemplateとTaskInstanceを分離する。
- Affordance、Function、Task、Skill、Trajectoryを混同しない。
- LLM生成候補を確定情報として扱わない。
- Evidenceとreview_statusを必須にする。
- seed dataをschema validationする。
- サンプルや疑似コードだけで終わらず、ローカルで動作する完全な実装にする。
- セットアップ、起動、テスト方法をREADMEへ記載する。
- 最後に実際のコマンドでテストし、ブラウザで主要画面を確認する。
```

---

## 18. 構想の要約

Physical AI Task Atlasは、既存ベンチマークのタスク一覧を検索するだけのサイトではない。

```text
物体・シーン・状態・人間生活
  → 可能な行動を探索
  → 現実性と根拠を評価
  → ロボット向けタスクへ形式化
  → データ収集仕様へ変換
```

という流れを一つにつなぐ。

最小実装ではYCB mustard bottleを深く掘り、少数の汎用TaskTemplateから多数のTaskInstanceがどのように生成され、どの根拠と条件でランキングされるかを示す。このvertical sliceが成立してから、YCB全体、BEHAVIOR-1K、RoboCasa、生活時間調査、映像データ、実機データセットへ順次拡張する。
