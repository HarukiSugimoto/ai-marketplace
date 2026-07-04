---
name: catalog-add
description: 気に入ったスライドのレイアウトや共通画像をカタログに登録して再利用可能にする。「このレイアウトをカタログに追加して」「この型を保存して」「この画像を共通素材に」で発動。
---

# catalog-add — レイアウト・画像の資産化

作成中に生まれた良いレイアウトや共通画像を、次回以降も使える資産として登録する。
これがこのシステムの育て方の中核。

## 最重要: どこに書くか

実行時のプラグイン(`${CLAUDE_PLUGIN_ROOT}`)は**キャッシュのコピー**で、
`/plugin update` で上書きされる。**ここを編集してはいけない**(消える・git に乗らない)。

登録先は2つ:

- **プラグイン層(全プロジェクト共通)** = 開発リポジトリの原本。
  場所は `~/.config/lab-slides/config.json` の `repoPath` に記録されている。
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh path` で解決できる。ここを編集し、
  commit → push → 各マシンで `/plugin update lab-slides` で反映。
  **現在ディレクトリがどこであっても行き先はここ**。
- **プロジェクト層(この研究PJ限定)** = カレントから上へ探した `.lab-slides/`。
  そのPJ限定の型・画像はこちら。git はそのPJのリポジトリに乗る。

## 手順(レイアウトの場合)

1. 対象スライドを特定し、固有の内容を除いて**汎用の雛形に抽象化**する
2. **登録先をユーザーに確認**: 汎用 → プラグイン層 / このPJ限定 → プロジェクト層
3. 登録先のパスを解決:
   - プラグイン層: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh path` の出力を使う。
     設定が無い(このマシンに開発リポジトリが無い)場合はその旨を伝え、
     開発リポジトリのあるマシンで実行するよう案内する
   - プロジェクト層: `.lab-slides/`(無ければ theme.css / layouts.yaml を作る)
4. 対象の `theme/lab.css`(プロジェクト層なら `.lab-slides/theme.css`)に CSS クラスを追記し、
   `catalog/layouts.yaml`(同 `.lab-slides/layouts.yaml`)に id / category / when / snippet を追加
5. その snippet でテストスライドを 1 枚ビルドし、崩れないことを確認
6. プラグイン層に追加した場合、commit と反映を案内(下記)

## 手順(共通画像の場合)

- 全プロジェクトで再利用する画像(ロゴ・定番の概念図)→ プラグイン層 `assets/`:
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh asset <画像パス> [新名]`
  使うときは各PJの `.lab-slides/figures/` にコピーして相対パスで参照(ポータビリティ確保)
- そのPJだけの実験グラフ等 → プロジェクト層 `.lab-slides/figures/` に置き
  `figures.yaml` に索引(id / path / caption / source)を追加

## CSS 追記の規約

- 色・余白は必ずデザイントークン(`var(--c-*)`)を使う。新色が要るならトークンを追加
- クラス名 = layouts.yaml の id と一致させる
- `when:` は「いつ使うか」を具体的に(生成時の選定はこれだけが頼り)

## プラグイン層に登録した後の反映

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/promote.sh commit "catalog: <追加内容>"
```

これで開発リポジトリに commit される(autoPush 設定時は push も)。その後ユーザーへ:
「`git push` 済みなら、各マシンで `/plugin update lab-slides` すれば反映されます
(このマシンで今すぐ使うにも update が必要)」と伝える。
