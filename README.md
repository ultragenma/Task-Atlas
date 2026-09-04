# Physical AI Task Atlas

Physical AI向けのタスク候補を、物体・シーン・状態・目的・スキルの関係から探索するローカルWeb MVPです。

この初期版は、YCB Object Setを一覧の入口にし、`006_mustard_bottle`について意味情報を深く持たせています。タスク候補は確定した頻度統計ではなく、Evidenceと`review_status`を伴うレビュー前のseedとして扱います。

## 起動

要件はNode.js 18以上です。外部パッケージは使いません。

```bash
npm run validate
npm test
npm start
```

ブラウザで <http://localhost:3000> を開いてください。開発中は次のコマンドでファイル変更時に再起動できます。

```bash
npm run dev
```

## MVPでできること

- YCBの77物体を検索・選択
- mustard bottleからScene / State / Intent / Task / Skillへ近傍グラフを展開
- 20件のmustard TaskInstanceを、テンプレート・初期条件・目標条件・必要スキル付きで表示
- 人間頻度、シーン自然さ、ロボット実行可能性、収集コスト、カバレッジ価値などでランキング
- Evidence levelとレビュー状態の表示
- TaskInstanceのJSON / CSV export
- seed JSONとJSON Schemaの整合性チェック

## ディレクトリ

```text
data/seeds/       MVPの手作業seed
schemas/          seed itemのJSON Schema
scripts/          seed validation
backend/          Node標準HTTP APIと静的ファイル配信
frontend/         vanilla JSの探索UI
tests/            Node test runnerによるAPI・データテスト
docs/             構成、オントロジー、Evidence方針
```

## API

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

`POST /api/proposals` と `POST /api/reviews` は、永続化をまだ行わないMVPのため未実装です。レビュー済みと見なせないseedは `proposed` のまま表示されます。

## データの位置付け

YCBのID・名称はYCB BenchmarksのObject Set一覧を入口にしています。外部データを自動取得する処理はまだなく、`data/seeds/objects.json`はUI検証用のローカルmetadataです。公式モデルや画像は同梱していません。

- YCB Object Set: <https://www.ycbbenchmarks.com/object-set-purchase-links/>
- YCB論文: <https://arxiv.org/abs/1502.03143>
- BEHAVIOR Knowledgebase: <https://behavior.stanford.edu/behavior_components/behavior_knowledgebase.html>

Task候補の頻度スコアは観測値ではありません。MVPでは`evidence-mvp-seed`を付与し、頻度・自然さ・実行可能性の仮説をレビュー前の候補として明示しています。

## 調査スナップショット

Physical AIのタスク定義・収集方法・生活時間統計をもとにした初期調査は、[report-source.md](report-source.md) にまとめています。P0/P1/P2の20 familyからなるキーワード候補は [data/research/task_keyword_candidates.json](data/research/task_keyword_candidates.json) に作成済みです。この候補は未確定のレビュー前seedであり、`family.skills` は既存の `data/seeds/skills.json` を参照する外部キーではなく、将来mappingする再利用可能skill語彙候補です。

Gitの初期化、commit、remote設定、GitHubへのpushは保留中です。

## 今後の拡張

1. YCB metadata importerとライセンス・取得日管理
2. BEHAVIOR synset / BDDLとのmapping
3. SQLite永続化とproposal/review workflow
4. 実測Evidenceの取り込みとスコアの出所表示
5. TaskInstanceからデータ収集仕様・シミュレータ形式へのexport
