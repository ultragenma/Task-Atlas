# Evidence policy

## レベル

| Level | 意味 |
| --- | --- |
| A | 代表性のある生活時間調査で直接観測 |
| B | 自然な映像・実演データで反復観測 |
| C | 査読済みまたは広く利用されるタスク定義に存在 |
| D | 製品説明・レシピ・作業手順などに存在 |
| E | 人間の専門家またはレビュー担当者が妥当と確認 |
| F | LLMまたは初期seedのみの未検証候補 |

MVPのmustard taskは、引き継ぎメモから作った候補seedであり、人口における行動頻度を直接観測していない。そのためTaskInstanceは`review_status: proposed`、Evidenceは`level: F`として扱う。画面でも「未検証」を表示し、スコアを確定事実のように見せない。

## 記録する項目

Evidenceには最低限、source name、version、locator、observed count、population/scene、collection method、confidence、reviewer、reviewed_at、notesを残す。値がない場合はnullを使用し、推定値と直接観測値を混同しない。

## スコアの扱い

スコアは探索の優先順位を作るための補助情報であり、評価結果ではない。実測値を取り込むまでは、画面に「seed仮説」と表示する。データソースのバージョン、ライセンス、取得日はインポータの追加時に必須にする。
