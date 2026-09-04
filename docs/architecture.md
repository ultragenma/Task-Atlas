# Architecture

## MVPの境界

```text
seed JSON
   ↓ 起動時ロード・検証
Node store (メモリ上)
   ↓ HTTP API
vanilla JS UI
   ├─ object list
   ├─ lazy neighborhood graph
   ├─ task inspector
   └─ JSON / CSV export
```

DBを先に固定せず、TaskTemplate（再利用可能な定義）とTaskInstance（具体的なbinding）を別レコードとして保持する。後でSQLite/PostgreSQLへ移してもAPIの形を維持できる構成にした。

## グラフの遅延展開

Objectを選択した直後は、Objectから6つのgroupノード（Affordance / State / Scene / Intent / Task / Skill）のみを表示する。groupをクリックしたときに、その集合の子ノードを取得する。この方式で、YCB全体を最初から描画せず、UIの情報量を制御する。

Taskノードを選択すると、右ペインに初期条件、目標条件、skill列、score、Evidenceを表示する。Taskのグラフ上の関係はtemplate、scene、skill、Evidence、関連stateへ向ける。

## APIの責務

- `objects`: 入口となるObjectInstance一覧と詳細
- `nodes/.../neighbors`: グラフ用の表示ノードとエッジ
- `tasks`: フィルタ・ランキング済みTaskInstance
- `tasks/generate`: 現在のseedから条件に合う候補を返す。自動生成器の差し替え点
- `export`: UIの表示フィルタに依存しない全TaskInstanceの出力

現段階のstoreは起動時にseedを読むだけで、POST系の永続化は行わない。これは「候補を確定情報として保存する」機能を後回しにし、Evidenceとレビュー状態の意味を保つためである。
