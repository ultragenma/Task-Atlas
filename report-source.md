# Physical AI Task Atlas 調査メモ

更新日: 2026-09-05  
状態: 初回リサーチスナップショット／キーワード候補は `proposed`  
対象: Physical AI のタスク定義、収集単位、人間の日常行動、ロボティクス研究で反復するタスク

## 1. 今回の結論

Atlasのタスク候補は、最初から「頻度順の完成したタスク一覧」にしない。次の4層を分離して蓄積する。

```text
生活活動・業務
  → 目的付きタスク
    → サブタスク／再利用可能スキル
      → モーション／接触／センサー付き軌道
```

今回の初期語彙は、以下の交差部分から始める。

1. 人間の生活時間統計で頻度・参加率の根が確認できる活動
2. Ego4D / EPIC-KITCHENS の手と物体、verb–noun、状態変化の表現
3. BridgeData V2 / DROID / Open X-Embodiment / AgiBot World の実ロボット収集で反復する動作
4. BEHAVIOR-1K / RoboCasa / CALVIN / RLBench / RoboTwin のタスク定義・評価で再利用される構造

この交差から、第一段階では `pick/place/move`、`open/close`、`push/sweep`、`pour/transfer`、`wipe/clean`、`store/restock/organize`、`fold`、`handover/serve`、`sort/discard`、`insert/assemble`、`inspect/verify`、`recover` を優先する。これは人口全体の物理動作を測った順位ではなく、**人間生活との接続、データセット横断の反復、ロボットでの収集・評価可能性を合わせた優先順位**である。

初期候補は [data/research/task_keyword_candidates.json](data/research/task_keyword_candidates.json) に作成済みである。P0/P1/P2の20 familyを収めた未確定・レビュー前seedであり、採用済みのTaskTemplateや実測済みの頻度表ではない。調査の詳細と根拠は本ファイルを正本とする。

候補JSONの各familyにある `skills` は、現段階で再利用可能性を検討するためのskill語彙候補である。`data/seeds/skills.json` の `skill_*` IDへの外部キーではないため、seedのSkillノードと混同せず、レビュー後に明示的なmappingを追加する。

## 2. 調査の読み方と限界

### 2.1 「頻出」の意味を3つに分ける

| ラベル | 何を意味するか | 使い方 |
| --- | --- | --- |
| `population_frequency` | 時間利用調査などで、対象集団がその大分類を行う割合・時間 | 人間生活に根ざす候補の優先度に使う |
| `dataset_recurrence` | 複数のロボット／映像データセットで同じ動詞・目的が現れる | 学習・比較用の共通語彙に使う |
| `research_signal` | 最近の大規模データセット・ベンチマークが重点化した能力 | トレンド、未解決性、評価価値の手掛かりに使う |

`dataset_recurrence` や `research_signal` を `population_frequency` に変換しない。研究用データは収集者、設備、ライセンス、モデルの評価容易性に強く偏るためである。

### 2.2 今回はキーワードの抽出を先に行う

まだ行っていないこと:

- 各データセットの全動画・全軌道のダウンロード
- 公式アノテーションを横断した厳密な動詞出現回数の再計算
- 国・年齢・性別・文化ごとの人口代表性を保った推定
- 研究論文の引用数を使った厳密な bibliometrics

したがって、JSONの候補は「収集・レビューに回すseed」であり、確定スコアではない。次のループで公式メタデータとアノテーションだけを取得し、出現回数・共起・ロングテールを測定する。

## 3. Physical AIではタスクをどう定義しているか

### 3.1 BEHAVIOR-1K: 物体・初期条件・目標条件

BEHAVIOR-1K は、人間がロボットにしてほしい活動を調査で集め、1,000の長期家庭活動ファミリーとして定義する。公式論文では50シーン、9,000超の物体、剛体・変形体・液体を含むシミュレーションを掲げている（[論文](https://arxiv.org/abs/2403.09227)）。

定義ファイルの構造はAtlasに非常に近い。

- `objects`: WordNet synsetと必要数量
- `:init`: `ontop`、`inside`、`inroom` などの初期述語
- `:goal`: 最終的に成立させる述語と論理ブロック
- `activity_name`、定義variant、サンプリングinstanceでタスクを識別

公式タスク文書では、活動をBDDLで定義し、対象物、初期条件、目標条件の3要素を必須としている（[BEHAVIOR task definitions](https://github.com/StanfordVL/BEHAVIOR-1K/blob/main/docs/behavior_components/behavior_tasks.md)）。ここで「1,000」は `activity_family` の数であり、現行の定義一覧はvariant込みで1,016件である。Atlasでは `activity_family` と `task_definition_variant` を別IDとして保持し、この二つを混同しない。また、オブジェクトカテゴリ、3Dモデル、姿勢を変えた新しいインスタンスをサンプリングでき、サンプリング失敗も「部屋不足」「適切な物体なし」「物理制約」として現れる。

**Atlasへの取り込み**

`TaskTemplate` の最小形を次に寄せる。

```text
required_objects / object_roles
initial_state.predicates
goal_state.predicates
scene
variant_axes
success_conditions
```

ただし、BDDLは目標状態を表す層であり、実際の実行手順やロボット軌道を全部表すものではない。`subtasks` と `skills` は別フィールドに置く。

### 3.2 RoboCasa: atomic / composite / held-out target

RoboCasaはキッチンを高密度に扱い、タスクを単一の原子的行動と複数段階の複合タスクに分ける。RoboCasa v1.0.1のデータセット文書では、pretrainingは300タスク・2,500キッチン、targetは異なる10キッチンの50タスクで構成され、人間テレオペレーションとMimicGen合成データを併用する（[RoboCasa dataset overview](https://robocasa.ai/docs/build/html/datasets/datasets_overview.html)）。一方、RoboCasa365は365タスクの別リリースである（[RoboCasa365](https://robocasa.ai/)）。Atlasでは `dataset_release` を必須にし、v1.0.1の300+50とRoboCasa365の365を合算・混同しない。

targetの複合タスクには、フレームごとの以下のラベルが付く。

- subtask index
- atomic-skill name
- stage（`pick` / `place` / `navigate`）
- natural-language instruction

これは、長い行動を一つのラベルに潰さず、**タスク階層と時系列境界を同時に持つ**設計である。Atlasでも、タスク名だけでなく `subtask_id`、`skill_id`、`stage`、`instruction`、`start/end` を将来の収集仕様に含める。

### 3.3 AgiBot World: 実世界タスク、スキル、品質管理

AgiBot Worldの論文v4（2025-08-04）は、100台超の同一系ロボットで、1,001,552軌道、2,976.4時間、217タスク、87スキル、106シーンを報告する。一方、公式リポジトリのBeta配布案内は1,003,672軌道と記載する。これは版・集計時点の異なる値として扱い、Atlasでは `source_version`、`dataset_release`、`accessed_at` を記録して同列に比較しない。家庭、店舗、工業、レストラン、オフィスを横断し、両腕、器用な手、視触覚、言語アノテーションを重視している（[論文HTML v4](https://arxiv.org/html/2503.06669v4)、[公式リポジトリ / Beta](https://github.com/OpenDriveLab/Agibot-World)）。

AgiBotの重要な設計は、スケールの大きさよりも、定義と収集を閉じたループにしている点である。

1. 小規模な予備収集で、タスクの実行可能性と収集標準を確認
2. シーンを整え、熟練テレオペレータが正式収集
3. 欠落フレームなどをローカル検査してからアップロード
4. アノテータが標準適合性を再確認し、言語アノテーションを付与
5. 失敗しても回復して完遂した軌道は捨てず、失敗理由と時刻を記録
6. 小規模データで学習・実機展開し、停止フレームや遷移の不整合を収集プロトコルへ戻す

論文が挙げる評価タスクは、次のように能力軸を意図的に含む。

- `Restock Bag`: カートから商品を取り、棚へ置く
- `Table Bussing`: テーブル上のごみをゴミ箱へ片付ける
- `Pour Water`: ケトルを持ち上げ、カップへ注ぐ
- `Restock Beverage`: カートから飲料を棚へ補充する
- `Fold Shorts`: 服を二回折る
- `Wipe Table`: スポンジで水滴を拭く
- tool use、deformable object、human–robot interaction、language following、位置・視覚妨害・言語の未見条件

**Atlasへの取り込み**

`failure_recovery`、`annotation_quality`、`camera_calibration`、`language_per_subtask` を、単なるデータセット説明ではなくタスク候補の属性にする。特に失敗軌道は、正常成功率とは別の `recovery_value` として保存する。

### 3.4 DROID: 分散された実世界と標準ハードウェア

DROIDは、76,000軌道・350時間を564シーン、86タスク、50人の収集者、北米・アジア・欧州で集めた実世界データセットである。13機関でFrankа Panda、ステレオカメラ、Oculus Quest 2テレオペレーションを同じ構成にし、携帯可能な高さ調整デスクを使う（[公式サイト](https://droid-dataset.github.io/)）。

DROIDの収集・公開上の示唆は次の通り。

- 実世界のシーン数を増やすには、ハードウェアと手順の標準化が必要
- 95%の成功エピソードに3つの自然言語アノテーションを追加した更新版がある
- 動詞と物体はロングテールを持ち、単純な代表クラスだけでは足りない
- 物体との接触点や視点を含め、同じタスクでも配置・カメラ・作業空間を変える

Atlasでは `task_family` と `surface/scene/object_instance/camera_view` を分け、同じ動詞のロングテールを消さない。

### 3.5 Open X-Embodiment: taskより先に共通フォーマットを作る

Open X-Embodimentは22種類のロボット、21機関、527スキル、160,266タスクを統合し、RT-Xで異なるembodiment間の転移を検証した（[論文](https://arxiv.org/abs/2310.08864)）。DeepMindの紹介では、1,000,000超のエピソード、500超のスキル、150,000超のタスクとされ、共通スキルの図では `picking`、`moving`、`pushing` が特に多い（[DeepMind overview](https://deepmind.google/blog/scaling-up-learning-across-many-different-robot-types/)）。

この頻出は人間人口の頻出ではなく、既存ロボットデータの構成比である。それでもAtlasの初期共通語彙として、`pick/grasp`、`move/carry`、`push` を最優先にする根拠になる。

### 3.6 BridgeData V2: 基礎操作から環境操作・複雑操作へ

BridgeData V2は60,096軌道を24環境で収集し、自然言語ラベル、複数カメラ・深度の一部を含む（[論文](https://arxiv.org/abs/2308.12952)）。詳細なデータ構成には以下が現れる（[論文PDF](https://proceedings.mlr.press/v229/walke23a/walke23a.pdf)）。

- 基礎物体操作: `pick-and-place`、`pushing`、`sweeping`
- 環境操作: ドア・引き出しの `opening/closing`
- 複雑操作: ブロックの `stacking`、布の `folding`、粒状物の掃引

単一の物体移動だけでなく、接触が継続する掃引、関節を持つ環境、変形体、粒状物を同じ語彙体系に接続している点を採用する。

### 3.7 RoboTwin 2.0: 両腕・合成データ・強い変動

RoboTwin 2.0は、RoboTwin-ODの731インスタンス・147カテゴリを使い、5種類のロボットembodimentに対する50の両腕タスクを構成する。タスクコードの自動生成と、clutter、lighting、background、tabletop height、languageの5軸のdomain randomizationを組み込む（[公式タスク一覧](https://robotwin-platform.github.io/doc/tasks/)、[論文](https://arxiv.org/abs/2506.18088)）。

ここからは、単に「両腕」というタグを付けるだけでなく、次をタスクの変動軸にする。

- 片腕／両腕
- 同時協調／交互操作
- 視覚的な clutter と遮蔽
- 高さ・照明・背景
- 命令の言い換え
- 物体カテゴリ内の形状・サイズ差

### 3.8 映像データ: 手と物体の状態変化を別軸にする

Ego4DのHands and Objects benchmarkは、手が物体の状態を変えることを中心に、pre / point-of-no-return / postの3時点、手・工具・物体のbox、状態変化タイプ、動詞、名詞を付ける。切断、除去、燃焼など、手段が違っても同じ状態変化なら同じ概念として扱う（[Ego4D Hands and Objects](https://ego4d-data.org/docs/benchmarks/hands-and-objects/)）。

EPIC-KITCHENS-100は、厨房の非スクリプト一人称映像を、時間区間付きの `verb`–`noun` ラベルとして公開し、action recognition、detection、anticipationなどを分ける（[公式アノテーション](https://github.com/epic-kitchens/epic-kitchens-100-annotations)）。

**Atlasへの取り込み**

キーワードを動詞だけで保存しない。

```text
verb + noun + object_state_before + object_state_after
      + temporal_boundary + hand/tool/target + scene
```

例えば「切る」は、`tool`、`contact`、`state_after`を欠くと、調理・木工・包装を区別できない。

## 4. 人間の行動頻度から何を借りるか

### 4.1 米国 ATUS 2024

ATUSは米国の15歳以上のcivilian populationを対象に、前日の行動を電話で順に記録する全国代表性を意図した調査で、2024年は約7,700人が回答した。活動ごとに開始・終了時刻、場所、同室者・同行者などを持つが、公開表の値はprimary activity（同時に行った副次活動を除く）である（[BLS 2024 results](https://www.bls.gov/news.release/archives/atus_06262025.htm)、[2024 microdata files](https://www.bls.gov/tus/data/datafiles-2024.htm)）。

2024年の全体値で、ロボット候補に関係する大分類は次の通り。

| ATUS一次活動 | 参加率／平均時間（人口全体） | Atlasでの読み替え |
| --- | ---: | --- |
| Eating and drinking | 95.9% / 1.24時間 | 供給、配膳、容器・液体の扱い |
| Household activities | 80.4% / 2.01時間 | 家庭内作業全体の入口 |
| Food preparation and cleanup | 63.1% / 0.67時間 | 調理、注ぐ、盛る、食卓片付け、洗浄 |
| Purchasing goods and services | 39.9% / 0.67時間 | 商品取得、運搬、棚・レジへの提示 |
| Housework | 37.0% / 0.62時間 | 掃く、拭く、拾う、整理する |
| Caring for and helping household members | 21.7% / 0.51時間 | 手渡し、給仕、介助、共同作業 |
| Household management | 17.5% / 0.15時間 | 物品・収納・環境の管理 |

この表は「ロボットがその行動を行うべき確率」ではない。ATUSの公開値は、米国15歳以上のcivilian populationに対するprimary activityのみで、同時に行った副次活動を網羅しない。また、`food preparation and cleanup` のような大分類を、特定のボトル操作へ直接分解できない。

それでも、`prepare / serve / clean / store / shop / carry / care` を人間生活に接続する上位語として採用するには十分な根拠になる。さらに、BLSの2024活動ファイルは活動コード・開始終了時刻・場所を含むため、次のループで公式コードからsceneと時間帯の候補を作れる。

### 4.2 日本の社会生活基本調査

日本の「社会生活基本調査」は1976年以降5年ごとに行われ、2021年調査は約7,600調査区、約91,000世帯、10歳以上約190,000人を対象に、2021年10月16日から24日の期間内で連続2日を指定して生活時間を記録した（[Statistics Bureau outline](https://www.stat.go.jp/english/data/shakai/2021/gaiyo.htm)）。

ATUSとは母集団（米国15歳以上のcivilian population／日本10歳以上）、記録日数（前日1日／連続2日）、調査時期（ATUS 2024／日本は2021年10月）、活動分類が異なる。そのため頻度値を直接比較・統合せず、次の用途で並列に保持する。

- 米国と日本の家庭・就業・余暇・家事の分類差を比較
- 同じキーワードに、国・調査年・年齢層を付ける
- 生活時間の大分類を、実ロボットタスクの直接頻度ではなくpriorとして使う

### 4.3 ICATUS 2016 と MTUS

ICATUS 2016は、24時間の活動を国際比較するための階層分類であり、頻度統計ではない（[UN Statistics Division](https://unstats.un.org/unsd/demographic-social/time-use/icatus-2016/)）。Atlasでは `taxonomy` としてのみ使い、人口頻度スコアは付与しない。初期語彙に直接使える例がある。

- food preparation: cooking、温め、飲み物・軽食の準備
- serving meals/snacks: 配膳・給仕
- cleaning up after meals: 食器洗い、テーブル清掃、片付け
- storing/arranging food stocks: 食品を冷蔵庫へ戻す、在庫整理
- indoor cleaning: 掃く、掃除機、洗う、こする、拾う、ほこり取り、整頓
- recycling/disposal: 分別、ゴミ出し、紙・瓶・缶の分離
- textile care: 洗濯、干す、取り込む、アイロン、折る、収納
- shopping: 食品・生活用品の購入、価格比較、オンライン購入

MTUSは複数国の生活時間日記を共通形式に調和する資源であり、国ごとの細かい分類をそのまま混ぜず、共通活動IDと原分類IDを両方保存する設計の参考になる（[MTUS](https://www.timeuse.org/mtus)）。

### 4.4 頻度から導く動作パターン

政府統計は「把持」や「関節角度」を記録しない。そのため、次の動作語は**統計の直接観測値ではなく、生活活動をロボット可能な単位へ分解した仮説**として扱う。

| 動作パターン | 生活活動との接続 | 研究データとの接続 |
| --- | --- | --- |
| reach / locate / grasp | ほぼ全ての物品操作 | OXE、DROID、Ego4D |
| lift / carry / move | 買物、収納、配膳、片付け | OXEの`moving`、Bridge、AgiBot |
| place / put / store | 食品・衣類・ごみの収納 | BEHAVIOR、RoboCasa、AgiBot |
| open / close | 容器、扉、引き出し、家電 | Bridge、CALVIN、RLBench |
| pour / dispense / serve | 調理、飲食、配膳 | AgiBot、ICATUS |
| wipe / wash / sweep | 食後片付け、室内清掃 | AgiBot、Bridge、ICATUS |
| fold / hang / put-away | 衣類・布の管理 | AgiBot、Bridge、ICATUS |
| sort / discard / recycle | ごみ分別・廃棄・整理 | ICATUS、BEHAVIOR |
| handover / assist | 家族・顧客・共同作業 | AgiBot、ATUSのcare |
| recover / regrasp / verify | 落下、誤配置、確認 | AgiBotのfailure recovery、RLBenchの失敗注意 |

ここでの重なりが、最初に収集する「ヒトの動作パターン候補」である。頻度の数値を付けるのは、BLS・日本統計・映像／ロボットアノテーションの母集団を分けてからにする。

## 5. ロボティクスで反復する・今始める価値が高いタスク

### 5.1 P0: 最初の収集・マッピング対象

| task family | 最初に持つ動詞 | 代表的な物体・目的 | 根拠の種類 |
| --- | --- | --- | --- |
| Pick and place | pick, grasp, lift, place, put, release | 物体、面、箱、棚 | OXE、Bridge、BEHAVIOR、AgiBot |
| Transport / carry | carry, move, transfer | カート、トレー、別面 | OXE、ATUS/ICATUS、AgiBot |
| Push / sweep | push, slide, sweep | ブロック、粒状物、ごみ | OXE、Bridge、ICATUS |
| Open / close | open, close, pull, turn | 扉、引き出し、キャップ | Bridge、CALVIN、RLBench、EPIC |
| Pour / dispense / serve | pour, squeeze, dispense, serve | ケトル、ボトル、カップ、食品 | AgiBot、ICATUS、既存MVP |
| Wipe / clean | wipe, wash, scrub, clean | テーブル、液体、容器 | AgiBot、ICATUS、RoboCasa |
| Clear / sort / discard | clear, sort, separate, discard | ごみ、食器、資源物 | AgiBot、ICATUS、BEHAVIOR |
| Store / restock / organize | store, restock, align, organize | 冷蔵庫、棚、カート、パントリー | AgiBot、BEHAVIOR、ICATUS |
| Retrieve from storage | retrieve, take out, bring | 冷蔵庫、棚、引き出し | BEHAVIOR、RoboCasa、ICATUS |
| Fold / deformable handling | fold, unfold, hang, put away | 衣類、布、袋 | AgiBot、Bridge、ICATUS |
| Handover / assist | hand, give, receive, wait | ボトル、食器、工具、人 | AgiBot、ATUS/ICATUS |
| Insert / assemble | insert, plug, thread, screw, assemble | コネクタ、部品、工具 | RoboTwin、MimicGen、RLBench |
| Inspect / verify | inspect, read, check, verify | ラベル、残量、状態、棚 | Ego4D、EPIC、LeRobotのtask metadata |
| Recover / reorient | recover, right, regrasp, correct | 落下物、倒れた容器、誤配置 | AgiBot、RLBench、MimicGen |

### 5.2 P1: P0の変動軸として追加するもの

タスク名を増やす前に、同じタスクを次の条件で分岐させる。

- rigid / deformable / liquid / granular
- single-arm / bimanual / mobile manipulator / dexterous hand
- tabletop / shelf / cart / refrigerator / human-nearby
- clear view / occluded / cluttered / distractor
- upright / tilted / fallen / open / closed / dirty / sticky / leaking
- seen object / novel instance / unseen scene
- normal success / partial success / failure recovery
- scripted / human teleop / synthetic / in-the-wild
- short atomic / long-horizon composite

この順序なら、`open bottle` と `open drawer` を同じ語彙で共有しながら、接触条件・成功判定・安全タグを分けられる。

### 5.3 P2: 高価値だが初期の頻度根拠が弱いもの

`chop/cut`、精密なねじ締め、器用な指操作、二人協調、動的対象、ペット・介助、屋外・移動、全身humanoid操作は重要だが、初期P0と同じ頻度スコアで扱わない。これらは `research_signal`、`safety`、`coverage_value`、`collection_cost` の別軸で優先度を決める。

## 6. データ収集の最小契約

### 6.1 1エピソードに必須の意味情報

```json
{
  "task_template_id": "...",
  "task_instance_id": "...",
  "instruction": "...",
  "scene_id": "...",
  "object_bindings": {},
  "initial_state": {"predicates": []},
  "goal_state": {"predicates": []},
  "subtasks": [],
  "skills": [],
  "success": null,
  "failure_modes": [],
  "recovery": null,
  "variation": {},
  "evidence_ids": []
}
```

`success`をbooleanだけにせず、部分成功・安全違反・目標未達・回復成功を分ける。AgiBotの評価は部分成功を含む正規化スコアを使い、RoboCasaはフレームごとのサブタスクを提供するため、Atlasも将来その粒度を受けられるようにする。

### 6.2 時系列・センサーの最低限

LeRobot Dataset v3は、状態・アクション・timestampをParquet、動画をMP4 shard、スキーマ・fps・正規化統計・エピソード境界をmetadataに置く（[LeRobot v3 format](https://github.com/huggingface/lerobot/blob/main/docs/source/lerobot-dataset-v3.mdx)）。Atlasは特定フォーマットへ早く固定せず、次の論理フィールドを先に持つ。

- `timestamp`
- `observation`（camera、depth、tactile、proprioception）
- `action`
- `frame_index` / `episode_offset`
- `camera_calibration`
- `language_instruction`
- `subtask_boundary`
- `object_state_event`
- `operator_id`、`robot_id`、`embodiment`
- `provenance`、`license`、`collection_protocol_version`

### 6.3 収集ループ

```text
keyword candidate
  → task template
  → small feasibility pilot
  → collection protocol + success rubric
  → human teleop / scripted / synthetic data
  → local integrity check
  → semantic annotation + state/event labels
  → policy evaluation
  → gap / failure / idle-frame feedback
  → next candidate or revised template
```

これは大規模収集を始める前に、タスクの意味、実行可能性、失敗の扱い、評価方法を同時に検証するためのループである。

## 7. 初期キーワードをどうスコアするか

現行のMVPスコアを、将来は以下へ分解する。

```text
priority_signal =
  population_frequency_prior
  + dataset_recurrence
  + research_signal
  + transfer_value
  + coverage_value
  - collection_cost
  - safety_risk
```

ただし、それぞれの数値は同じ母集団の確率ではない。JSONでは、スコアを埋める代わりに `signal_types`、`evidence`、`selection_reason`、`frequency_status` を持たせ、レビュー後に観測値を追加する。

特に以下を別々に記録する。

- 人間の参加率・平均時間
- データセット内のエピソード数・時間・シーン数
- タスク／スキルが登場した論文・ベンチマーク
- 物理的成功率
- 実演1件あたりの収集時間と再試行数
- 安全・衛生・人間近接のリスク

## 8. 次の大きなloopの切り方

大量データを一度に取り込まず、以下の小さいループを順番に回す。

### Loop A: タクソノミー抽出

公式配布の小さいmetadata・taxonomy・annotation CSVだけを取得し、`verb`、`noun/object`、`state_change`、`scene`、`skill`を正規化する。映像本体は後回しにする。

### Loop B: 人間統計のmapping

ATUS 2024、日本2021、ICATUSの活動コードを、`life_activity_id` として保存する。そこからP0候補へのmappingを人手レビューし、直接観測ではない推論には `inference` を付ける。

### Loop C: タスク骨格生成

P0の各familyについて、3〜5種類の物体役割、2〜3種類のscene、初期述語、目標述語、失敗モードを作る。最初は1000件を目標にせず、各family数件の「良い代表」を作る。

### Loop D: 収集可能性レビュー

片腕・両腕・移動・視触覚・人間近接・液体・変形体の要件を判定し、実機、シミュレーション、映像のみのどれで収集するかを決める。

### Loop E: 分布監査

同じ物体・同じ棚・同じカメラ・同じ初期姿勢に偏っていないか、seen/unseen scene、object instance、language paraphrase、failure recoveryを確認する。ベンチマークのショートカットや評価再現性の問題も監査対象にする。

## 9. 重要な注意点

1. データセットの軌道数は版・定義・重複排除方法で変わる。報告値には必ず版と取得日を付ける。
2. `pick-and-place` は研究データで非常に多いが、それだけで人間生活の最頻動作だとは言わない。
3. ATUSや日本の時間利用調査は生活活動の大分類であり、ロボットの把持軌道の教師データではない。
4. Ego4D / EPIC-KITCHENSは人の自然な手・物体関係を補うが、ロボットのaction/proprioceptionを直接与えない。
5. 合成データはscene・object・languageを大きく増やせるが、現実の接触・摩擦・失敗分布を自動的に再現するわけではない。
6. Human-in-the-loopはアノテーション後の検品に限らず、収集プロトコルをモデルの失敗から更新する閉ループとして扱う。
7. 研究の「ホットさ」は人口頻度と別軸である。`research_signal`を独立に表示する。
8. 人間への手渡し、液体、刃物、食品、清掃、ペット・介助は安全・衛生・同意の仕様を先に書く。

## 10. ソース台帳

| ID | ソース | この調査で使った情報 |
| --- | --- | --- |
| `behavior_1k` | [BEHAVIOR task definitions](https://github.com/StanfordVL/BEHAVIOR-1K/blob/main/docs/behavior_components/behavior_tasks.md)、[paper](https://arxiv.org/abs/2403.09227) | 1,000 activity family、variant込み1,016定義、BDDL、object/init/goal、サンプリング |
| `robocasa` | [RoboCasa dataset overview v1.0.1](https://robocasa.ai/docs/build/html/datasets/datasets_overview.html)、[RoboCasa365](https://robocasa.ai/) | v1.0.1の300 pretraining + 50 targetと、別リリースの365 tasks。atomic/composite、human/MimicGen、held-out scene、per-frame subtask |
| `agibot_world` | [paper HTML v4](https://arxiv.org/html/2503.06669v4)、[repo / Beta](https://github.com/OpenDriveLab/Agibot-World) | 論文v4の1,001,552軌道とBeta配布の1,003,672軌道を版別に扱う。task/skill/scene、5領域、品質検証、回復、評価タスク |
| `droid` | [DROID official site](https://droid-dataset.github.io/) | in-the-wild、76k/350h、564 scenes、86 tasks、標準ハードウェア、言語・校正 |
| `open_x_embodiment` | [paper](https://arxiv.org/abs/2310.08864)、[DeepMind overview](https://deepmind.google/blog/scaling-up-learning-across-many-different-robot-types/) | cross-embodiment、共通format、picking/moving/pushingの構成信号 |
| `bridge_data_v2` | [paper](https://arxiv.org/abs/2308.12952)、[dataset PDF](https://proceedings.mlr.press/v229/walke23a/walke23a.pdf) | pick/place、push、sweep、open/close、stack、fold、環境多様性 |
| `robotwin_2` | [task docs](https://robotwin-platform.github.io/doc/tasks/)、[paper](https://arxiv.org/abs/2506.18088) | 50両腕タスク、object library、domain randomization、embodiment差 |
| `ego4d` | [Hands and Objects](https://ego4d-data.org/docs/benchmarks/hands-and-objects/) | pre/PNR/post、状態変化、手・工具・物体、動詞・名詞 |
| `epic_kitchens` | [official annotations](https://github.com/epic-kitchens/epic-kitchens-100-annotations) | 時間区間、verb/noun、action detection/anticipation、long-tail |
| `calvin` | [official benchmark](https://calvin.cs.uni-freiburg.de/) | 言語条件、連続制御、長期chain、open/close/pick/push例 |
| `rlbench` | [official repository](https://github.com/RAI-ZZU/RLBench) | task file、waypoint、variation、success criteria、100 task設計 |
| `mimicgen` | [project site](https://mimicgen.github.io/) | 少数人間実演からのscene/object/robot/reset variation、合成拡張 |
| `lerobot_v3` | [Dataset v3 docs](https://github.com/huggingface/lerobot/blob/main/docs/source/lerobot-dataset-v3.mdx) | episode metadata、Parquet/MP4、task instruction、streaming、schema |
| `atus_2024` | [BLS 2024 results](https://www.bls.gov/news.release/archives/atus_06262025.htm)、[microdata](https://www.bls.gov/tus/data/datafiles-2024.htm) | 米国15歳以上のcivilian population、primary activityの参加率・時間、場所・時刻を持つactivity file |
| `japan_time_use_2021` | [Statistics Bureau outline](https://www.stat.go.jp/english/data/shakai/2021/gaiyo.htm) | 5年周期、10歳以上、2021年10月の連続2日 diary。ATUSと直接比較しない |
| `icatus_2016` | [UN ICATUS 2016](https://unstats.un.org/unsd/demographic-social/time-use/icatus-2016/) | food/cleaning/storage/textile/shoppingの国際taxonomy。頻度統計には使わない |
| `mtus` | [MTUS](https://www.timeuse.org/mtus) | 多国間の生活時間日記を共通形式へ調和する設計 |

## 11. 現時点の成果物

- `report-source.md`: 本調査の根拠・判断・次ループの正本
- `data/research/task_keyword_candidates.json`: P0/P1/P2の20件の初期keyword family。作成済みだが、未レビューの提案seed
- `README.md`: 調査成果物への導線

Gitの初期化、commit、remote設定、GitHub repo作成、pushは今回の作業では行っていない。
