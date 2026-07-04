---
name: company-add
description: 新しい会社(職場)のテンプレパックを作成する。転職・副業・顧客先の体裁対応で使う。「会社を追加して」「新しい職場のテンプレを設定して」「会社のテンプレpptxを取り込んで」で発動。
---

# company-add — 会社テンプレパックの追加(転職対応)

会社ごとの体裁(配色・書体・ロゴ・規定)を `companies/<会社id>/` のパックに閉じ込める。
エンジン・カタログ・文書テンプレは全社共通なので、**転職してもパックを足すだけ**。

## 前提

- パックは開発リポジトリに置く(repo は private 前提)。このマシンに repo が無ければ
  消費専用なので、repo のあるマシンで行うよう伝える
- 会社の規定で社外持ち出しが厳しい場合は、そのパックだけ `.gitignore` に足して
  ローカル管理にする選択肢を提示する

## 手順

1. **会社 id を決める**(半角英数・ハイフン。例: `salt2`)。ユーザーに確認。
2. **雛形を作成**:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh company <会社id>
   ```
3. **体裁の取り込み** — 会社の指定テンプレ pptx があるか聞く:
   - **ある場合**: ingest で配色・書体を自動抽出してパックに書き込む:
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/ingest-template.js <会社テンプレ.pptx> <会社id>
     ```
     抽出結果(accent 等)を見せ、実物のテンプレと色が合っているか確認してもらう。
     テーマ色が形骸化している pptx もあるので、**必ず目視確認を挟む**。
     ロゴは自動抽出しないので、画像ファイルを `companies/<会社id>/assets/logo.png` に
     置いてもらう(tokens.json の assets.logo が参照)
   - **ない場合**: 会社の資料を見ながら手動で決める。聞くのは3つだけ:
     メインカラー(見出し・強調)/ 書体(ゴシック名)/ ロゴの有無。
     `companies/<会社id>/tokens.json` に書く(colors.accent / accentSoft / fonts)
4. **規定の記入**: `companies/<会社id>/rules.yaml` を会社に合わせて更新
   (ページ番号形式・機密表示・文体・禁則)。分からない項目は既定のままでよい。
5. **職場ディレクトリに紐付け**: 仕事用ディレクトリのルートに作成:
   ```yaml
   # <職場ディレクトリ>/.work-slides/workspace.yaml
   company: <会社id>
   ```
6. **検証**: デモデッキを職場ディレクトリ内でビルドし、会社の体裁になることを確認:
   ```bash
   cp ${CLAUDE_PLUGIN_ROOT}/catalog/demo_deck.json <職場>/check/deck.json
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/build.sh <職場>/check/deck.json all
   ```
   HTML と pptx の両方で色・ロゴを目視確認してもらい、OK なら check/ は削除。
7. **commit**:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh commit "company: <会社id> パック追加"
   ```
   push 後、他マシンは `/plugin update work-slides` で同じ体裁が使える。
