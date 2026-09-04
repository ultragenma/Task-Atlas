# Physical AI Task Atlas

> 日常の活動を、レビュー可能な Physical AI タスク候補へつなぐ、Evidence-aware なローカル探索MVP。

[English README](README.md) · [調査メモ](report-source.md) · [キーワード候補](data/research/task_keyword_candidates.json)

Physical AI Task Atlas は、物体・シーン・状態・Intent・Skill・Evidenceの関係から、Physical AI向けのタスク候補を探索するローカルWeb MVPです。[YCB Object Set](https://www.ycbbenchmarks.com/object-set-purchase-links/)を入口とし、`006_mustard_bottle` には深い意味情報を持たせています。研究由来のキーワードは、確定事実ではなくレビュー前の候補として明示的に扱います。

## 主な機能

- YCBの77物体を検索・選択
- 物体からScene / State / Intent / Task / Skillへの近傍グラフを展開
- mustard bottleの23 TaskInstanceを、テンプレート・初期条件・目標条件・必要Skill付きで表示
- 人間頻度、シーン自然さ、ロボット実行可能性、収集コスト、カバレッジ価値の仮説でランキング
- Evidence levelとレビュー状態を表示
- TaskInstanceをJSON / CSVでexport
- seed JSON、研究候補、APIの整合性をローカルで検証

## 起動

Node.js 18以上が必要です。実行時の外部依存パッケージはありません。

```bash
npm run check
npm start
```

ブラウザで <http://localhost:3000> を開いてください。開発中は次のコマンドでファイル変更時にサーバーを再起動できます。

```bash
npm run dev
```

## 調査スナップショット

Physical AIのタスク定義・収集方法・生活時間統計をもとにした初期調査は、[report-source.md](report-source.md) にまとめています。P0/P1/P2の20 familyからなる候補は、[data/research/task_keyword_candidates.json](data/research/task_keyword_candidates.json) にあります。

これらは未確定・レビュー前のseedであり、実測済みの頻度表や採用済みのTaskTemplateではありません。候補JSONの `family.skills` は将来mappingする再利用可能skill語彙であり、現時点では `data/seeds/skills.json` の `skill_*` IDを参照する外部キーではありません。

## API

`npm start` でローカル提供されるAPIです。

```text
GET /api/objects
GET /api/objects/{id}
GET /api/nodes/{id}/neighbors
GET /api/tasks
GET /api/tasks/{id}
GET /api/tasks/generate?object_id=...&scene_id=...
GET /api/scenes
GET /api/skills
GET /api/search?q=...
GET /api/export/tasks.json
GET /api/export/tasks.csv
GET /api/health
```

`POST /api/proposals` と `POST /api/reviews` は、永続化とレビューworkflowが未実装のMVPのため、意図的に実装していません。レビュー済みと見なせないseedは `proposed` のまま表示されます。

## ディレクトリ

```text
backend/             Node.js HTTP APIと静的ファイル配信
frontend/            vanilla JavaScriptの探索UI
data/seeds/          MVPの手作業seed
data/research/       調査由来のレビュー前キーワードseed
schemas/             seed・研究recordのJSON Schema
scripts/             検証スクリプト
tests/               Node test runnerによるAPI・データテスト
docs/                構成、オントロジー、Evidence方針
report-source.md     調査スナップショットと出典メモ
```

## データとEvidenceの方針

YCBのID・名称はYCB BenchmarksのObject Set一覧を入口にしています。外部データを自動取得する処理はまだなく、`data/seeds/objects.json` はUI検証用のローカルmetadataです。公式モデルや画像は同梱していません。

- [YCB Object Set](https://www.ycbbenchmarks.com/object-set-purchase-links/)
- [YCB論文](https://arxiv.org/abs/1502.03143)
- [BEHAVIOR Knowledgebase](https://behavior.stanford.edu/behavior_components/behavior_knowledgebase.html)

Task候補の頻度スコアは観測値ではありません。MVPでは `evidence-mvp-seed` を付与し、頻度・自然さ・実行可能性の仮説をレビュー前の候補として明示しています。詳細は [docs/evidence_policy.md](docs/evidence_policy.md) を参照してください。

## 開発と検証

すべてのローカル検証を実行します。

```bash
npm run check
```

これはseed検証、研究候補検証、Node.jsテストを順に実行します。個別には次のコマンドを使えます。

```bash
npm run validate
npm run validate:research
npm test
```

## 今後の拡張

1. YCB metadata importerとライセンス・取得日管理
2. BEHAVIOR synset / BDDLとのmapping
3. SQLite永続化とproposal/review workflow
4. 実測Evidenceの取り込みとスコアの出所表示
5. TaskInstanceからデータ収集仕様・シミュレータ形式へのexport

## Contributing

タスク定義、Evidence review、schemaへのフィードバック、検証改善を歓迎します。issueまたはpull requestを作成する前に、[CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。出典、release/version、取得日、提案recordが実測Evidenceか仮説かの明記方法を説明しています。

## License status

このリポジトリには現在ライセンスファイルがありません。再利用条件は未宣言のため、オープンソースライセンスが適用されるとは判断しないでください。
