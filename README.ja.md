# Physical AI Task Atlas

> 日常行動を文脈依存のタスクグラフとして探索し、選択した候補をレビュー可能な収集カードへ変換するローカルツールです。

[English](README.md) · [ドキュメント](docs/README.md) · [マスタードの実践例](docs/walkthrough.md) · [Contributing](CONTRIBUTING.md)

Task AtlasはYCBの物体カタログとマスタードボトルのvertical sliceから始めます。収集前に「この場面・役割で何が目的として成立するか」「何が存在し、何が不足・未確認・阻害されているか」「候補の各主張を何が支えるか」「収集セッションに何が必要か」を検討するための、外部依存のないローカルアプリです。

固定された一本の階層、唯一の正しい手順、一律のEvidenceランク、根拠のない頻度スコア、登録件数を進捗の証明としては扱いません。

## 扱うもの

- Object、Scene、State、Role、Intent、Task、Skill、Claim、Sourceを結ぶ型付きグラフ
- 文脈に応じた `ready` / `needs_changes` / `unknown` / `blocked` の評価
- Goalと、任意の提案Procedureの分離
- 各Claimのスコープに対応したSource
- 直接観測・明示的な導出・不明を区別する頻度情報。不明は推定値に置き換えません
- Setup、reset、quality check、consumable、failure mode、必要物体、文脈仮定、未解決要件を含む収集カード

`0.2`のデータ・HTTP interfaceは[foundation contract](docs/foundation-contract.md)が正本です。文脈の意味、assessment、planning record、claim、exportの仕様を定義しています。

## ローカルで起動する

Node.js 18以上が必要です。実行時の外部依存パッケージはありません。

```bash
npm run check
npm start
```

<http://localhost:3000> を開いてください。開発中は `npm run dev` で変更時にサーバーを再起動できます。GitHub Actionsではpushとpull requestごとにNode.js 22 / 24で `npm run check` を実行します。

## 中心となる問いを試す

`ycb_006_mustard_bottle`を選び、文脈を変えて候補を比較します。

- 家庭で食事中、内容物がある場合は、調理・提供・dispenseに関する候補が現れます。
- 使用後で空の場合は、残量確認・交換・廃棄・清掃が中心になります。
- 店舗棚でroleをcustomerからstaffに変えると、購入に関する候補と補充・正面向け・在庫確認の候補を区別できます。
- plateやhot dogがない場合も、explore modeでは候補を消さず、成立に必要な準備として表示します。

正確なAPI呼び出しと収集カードへの引き渡しは[マスタードの実践例](docs/walkthrough.md)を参照してください。収集カードはsimulationまたはteleoperationの準備計画であり、ロボットが成功済みであることを示しません。

## API

```text
GET /api/context-options
GET /api/tasks?...context
GET /api/tasks/{id}?...context
GET /api/tasks/{id}/collection-card?...context&procedure_id=...
GET /api/nodes/{id}/neighbors?lens=all|context|goals|execution
GET /api/export/tasks.json
GET /api/export/tasks.csv
```

コンポーネントの責務は[architecture](docs/architecture.md)、queryとresponseの詳細は[foundation contract](docs/foundation-contract.md)を参照してください。`0.1`の `scores`、rank parameter、一律のEvidence levelを使うclientは、assessmentとclaim recordへ移行します。

## 資料

- [Architecture](docs/architecture.md): 型付きグラフ、文脈評価、収集カードのworkflow
- [Ontology](docs/ontology.md): recordの区別と文脈の意味
- [Evidence and claim policy](docs/evidence_policy.md): claimごとの根拠と頻度の不明状態
- [Mustard walkthrough](docs/walkthrough.md): 探索から収集準備まで
- [調査ソース記録](report-source.md): 根拠と調査文脈の日本語記録。旧提案は該当箇所でhistoricalとして明示します

## 貢献

データ、schema、API、ドキュメントを提案する際は、Claim・Scope・Source・未解決の不確実性を追跡できるようにしてください。[CONTRIBUTING.md](CONTRIBUTING.md)に手順があります。

## ライセンス

現時点ではライセンスファイルを含みません。再利用条件は未宣言です。
