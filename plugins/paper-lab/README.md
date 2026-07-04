# paper-lab — 論文調査・原稿作成システム

論文を読んだ結果を**構造化ノートとして蓄積**し、そこから**関連研究章・原稿ドラフト**へ
蒸留するプラグイン。lab-slides(進捗報告)と同じ研究ディレクトリの上で動く。

```
【蓄積層】 /paper-survey ─→ queue.md(読む順)
           /paper-read  ─→ papers/notes/(1論文1ノート)+ refs.bib
                              │
【蒸留層】 /related-work ─→ 関連研究章(ノート群から)
           /paper-draft  ─→ 各章ドラフト(実験記録・メモから)
           /paper-polish ─→ 推敲+査読者視点レビュー
```

## スキル

| スキル | 役割 |
|---|---|
| `/paper-survey` | テーマを横断調査して候補リスト+読みキューを作る(深読みしない) |
| `/paper-read` | 論文1本を落合フォーマット+「自分の研究との関係」でノート化、BibTeX 追記 |
| `/related-work` | ノート群をグルーピングして関連研究章を生成(claim へ収束する型を強制) |
| `/paper-draft` | 章ドラフトを骨格承認→本文の2段階で生成 |
| `/paper-polish` | パス1: 文レベル推敲 / パス2: 査読者・副査視点の攻撃 |

## 研究ディレクトリの構成

研究ディレクトリのルートに `.paper-lab/research.yaml` を置く(初回にスキルが作る)。
**claim(自分の研究の一言主張)が全ノートの位置づけ軸**になるので必ず埋める。

```
<研究ディレクトリ>/
  .paper-lab/research.yaml   # claim・言語・パス設定
  papers/
    refs.bib                 # BibTeX 一元管理(citekey がノートと原稿を繋ぐ)
    queue.md                 # 読みキュー(優先度つき)
    notes/                   # 1論文1ノート
    surveys/                 # 調査の記録(クエリ・取捨の理由も残す)
    drafts/                  # 生成した章ドラフト
```

## 設計方針

- **ノートは要約でなく位置づけ**: relation(support / compete / method / background)を
  必ず付ける。compete が 0 件のまま関連研究は書かせない(調査不足の検出)
- **citekey が唯一の連結子**: ノート・refs.bib・原稿の引用はすべて同じキー。
  bib に無い文献は原稿に書けない(捏造引用の防止)
- **数値・実験結果は素材からのみ**: ドラフト生成時、素材に無い数値は作らず TODO を残す
- 夏〜秋にノートを貯める → 冬の執筆時に /related-work・/paper-draft が効く、という時間設計
