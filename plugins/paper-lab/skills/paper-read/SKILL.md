---
name: paper-read
description: 論文1本を読んで構造化ノート(落合フォーマット+自分の研究との関係)を作成し、BibTeX を refs.bib に追記する。「この論文読んで」「論文をノートにして」「arXivのこれまとめて」で発動。
---

# paper-read — 論文1本を資産化する

論文を読んだ結果を**1論文1ファイルのノート**として蓄積する。
ノートは後で /related-work・/paper-draft が機械的に読む素材になるので、
**要約ではなく「自分の研究との位置づけ」まで書き切る**こと。

## Step 0: 研究設定の解決

カレントまたは指定ディレクトリから上へ `.paper-lab/research.yaml` を探す。

- あれば読み込む(研究の主張 claim・ノート置き場・bib パス・言語)
- 無ければ「研究ディレクトリのルートに .paper-lab/ を作りますか?」と確認し、
  `${CLAUDE_PLUGIN_ROOT}/templates/research.yaml` を雛形にユーザーと埋める。
  **claim(自分の研究の一言主張)は空のまま進めない** — ここが全ノートの位置づけ軸になる。

## Step 1: 論文の取得

- **URL(arXiv 等)**: WebFetch で abstract・本文を取得。arXiv は `/abs/` → HTML 版や
  PDF も辿れる。取得できた範囲で書き、読めていない節は読めていないと明記する
- **PDF パス**: Read で読む(長い場合は pages 指定で導入・手法・実験・結論を優先)
- **既読チェック**: refs.bib に同じ論文が既にあればノートの更新として扱う(重複作成しない)

## Step 2: ノート生成(★関門: 位置づけの確認)

`${CLAUDE_PLUGIN_ROOT}/templates/note.md` の形式で生成する。骨子は落合フォーマット:

1. どんなもの?(1行)
2. 先行研究と比べてどこがすごい?
3. 技術・手法のキモ
4. どうやって有効だと検証した?(データセット・指標・ベースライン)
5. 議論・限界
6. **自分の研究との関係** ← 最重要。frontmatter の `relation` と対応:
   - `support` — 自分の主張の根拠になる
   - `compete` — 競合。修論で差分を明言する必要がある
   - `method` — 手法・実験設定を借りる
   - `background` — 背景・文脈として引く
7. 次に読むべき論文(引用文献から。あれば queue への追加を提案)

**ここで停止。** 「どんなもの?」と「自分の研究との関係」の2点だけ見せて、
位置づけ(relation)の認識が合っているか確認してから保存する。
本文の技術的内容に自信がない箇所は推測で埋めず「?」を付けて残す。

## Step 3: 保存と BibTeX 追記

- ノート: `<notes_dir>/<year>_<第一著者姓>_<slug>.md`(research.yaml の notes_dir、既定 `papers/notes/`)
- BibTeX: `<bib>`(既定 `papers/refs.bib`)に追記。citekey は `<第一著者姓><year><タイトル先頭語>`
  (例: `vaswani2017attention`)。ノート frontmatter の `citekey` と必ず一致させる
- arXiv 論文は出版版(会議・ジャーナル)があるか確認し、あれば出版版の bibtex を優先
- queue(`papers/queue.md`)にこの論文があれば読了として消し込む

## 運用メモ

- 1ノート = 修論の関連研究の1〜2文になる粒度。長文の写経はしない
- タグ(frontmatter `tags`)は research.yaml の keywords から選ぶ。乱造しない
