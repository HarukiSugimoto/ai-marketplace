# lab-slides

研究発表スライド(進捗報告・学会/修論発表)を段階生成するプラグイン。
いきなり完成品を作らず、**内容(関門1)→ デザイン(関門2)** の2段階でレビューしながら進める。

---

## セットアップ

必要なもの: Node.js(Marp CLI は npx 経由で自動取得されるのでインストール不要)。

### A. 使うだけ(消費側 / どのマシンでも)

```
/plugin marketplace add <owner>/ai-marketplace     # GitHub。ローカルパスでも可
/plugin install lab-slides@ai-marketplace
```

動作確認(デモデッキが開けばテーマは正常):

```bash
<plugin>/scripts/build.sh <plugin>/catalog/demo.md html && open <plugin>/catalog/demo.html
```

### B. カタログを育てる側(昇格側 / repo を clone するマシン)

`/catalog-add` で型や共通画像を repo に昇格させたいマシンでは、追加で一度だけ:

```bash
git clone <ai-marketplace の URL>            # 好きな場所に clone
bash <clone先>/plugins/lab-slides/scripts/promote.sh init   # このマシン用に config を自動生成
```

`init` は clone 内の自分の位置から repo を検出し、
`~/.config/lab-slides/config.json` にこのマシンの clone パスを書く。
以後 `/catalog-add`(プラグイン層)がこの repo を編集できるようになる。

## マシンを乗り換えたとき

`~/.config/lab-slides/config.json` は**マシン固有**(clone パスをハードコード)なので、
新しいPCにはそのまま持ち込めない。壊れたら/新PCでは上の **B の2コマンド**をやり直すだけ。

- clone 先パスが変わっても `init` が正しく書き直す(手編集不要)
- リポジトリを clone しないマシンは config 不要 = 消費専用(`/plugin update` で受け取る)
- 昇格しようとして config が無い/パスが古い場合、`promote.sh` は
  `init` を実行するよう案内して安全に停止する(誤ってキャッシュを編集しない)

## クイックスタート: 進捗報告を作る

研究プロジェクトのディレクトリで Claude Code を開き、素材を渡して頼むだけ:

```
> /slide-new 来週の進捗報告を作りたい。持ち時間10分。素材は notes/0711.md と results/ のグラフ
```

すると次の流れで進む(各関門で止まるので、承認するまで先に進まない):

1. **構成案(outline)が表で出てくる** ← 関門1
   「実験結果は2枚に分けて」「この主張は削って」など構成レベルの修正はここで言う
2. **HTML プレビューがブラウザで開く** ← 関門2
   同時に slide-validator が文字あふれ・図の参照切れ・枚数超過を機械チェック
   「4枚目の数式を大きく」などデザインの修正はここで言う
3. 承認すると **PDF が出力される**

2回目以降は前回の outline が自動で引き継がれ、「前回までの状況」が勝手に埋まる。

## クイックスタート: 学会・修論発表を作る

```
> /slide-new 研究会発表のスライド。持ち時間15分+質疑5分。ベースは論文ドラフト paper/main.tex
```

進捗報告との違い:

- 持ち時間から枚数を逆算(15分 ≒ 12〜13枚)し、時間配分表を付ける
- **発表台本(script.md)** をスライドごとに生成(各スライドの持ち秒数以内で話せる分量)
- 質疑用の予備スライド(詳細な実験条件・追加結果)を末尾に付ける

## よくある操作

| したいこと | 言い方の例 |
|---|---|
| 一部だけ直す | `/slide-build 3枚目の見出しを主張文にして` |
| 構成から練り直す | `/slide-build outline の結果セクションを2枚に分けて再生成` |
| PDF 化 | `/slide-build PDFにして` |
| 気に入った型を保存 | `/catalog-add このスライドのレイアウトをカタログに追加して` |
| 使える型の確認 | `catalog/layouts.yaml を見せて`(または demo.html を開く) |

## プロジェクト層: 研究 PJ ごとのカスタマイズ

研究プロジェクトのルートに `.lab-slides/` を置くと、そのPJ専用の資産を貯められる
(初回の `/slide-new` 時に無ければ雛形を作るか聞かれる):

```
<研究PJ>/.lab-slides/
├── figures/          # この PJ で使う図。実験のたびにここに貯める
├── figures.yaml      # 図の索引: id / パス / キャプション / 出どころ(どの実験か)
├── outlines/         # 発表ごとの outline 履歴(次回の「前回まで」に自動再利用)
├── work/             # 生成中の作業ファイル(content.yaml / slides.md / preview)
├── overrides.yaml    # テンプレ調整(章の追加削除・持ち時間の既定 等)
└── theme.css         # PJ 固有の追加 CSS(build.sh が自動で合成)
```

優先度は **プロジェクト層 > プラグイン層**(git config と同じカスケード)。

**figures.yaml の書き方:**

```yaml
figures:
  - id: fig_main_result
    path: figures/accuracy_comparison.png
    caption: ○○データセットでの精度比較(n=5)
    source: exp/2026-07-01_ablation  # どの実験から出た図か
```

登録しておくと outline から `figure: fig_main_result` で参照でき、
validator が参照切れを検査してくれる。

## デザインシステムとカタログの育て方

- `theme/lab.css` — 正式テーマは **Academic Ink**(生成り紙 × 明朝見出し × 深紅)。
  色・余白・書体は冒頭の**デザイントークン**(`--c-*`)に集約されており、
  配色を変えたいときはトークンだけ書き換える(全レイアウトに波及する)。
  没案の editorial(モダン・ミニマル)/ bold(ダーク×グラデ)は `theme/variants/` に保管
- `catalog/layouts.yaml` — 現在10型(title / toc / section / plain / two-col / compare /
  figure-full / metrics / discussion / takeaway)。各型に「いつ使うか」が書いてあり、
  生成時の選定はこれに従う
- **章タイトルの上部固定** — 章の最初のスライドに `<!-- header: 章名 -->` を書くと、
  以降のスライド上部に現在章が表示され続ける(次の header 指定で切り替わる)
- **育て方**: スライド作成中にカタログに無い表現が必要になったら、その場で HTML を直書き
  → 気に入ったら `/catalog-add` → 汎用ならプラグイン層(このrepo)、PJ固有ならプロジェクト層に登録
  → プラグイン層に足したら git commit & push、他マシンは `/plugin update lab-slides`

## カタログ・画像を repo に昇格させる仕組み(重要)

インストール済みプラグインは開発リポジトリの**キャッシュのコピー**として
`~/.claude/plugins/cache/` に置かれ、`${CLAUDE_PLUGIN_ROOT}` はそこを指す。
このコピーは **`/plugin update` で上書きされる**ので、直接編集しても消える・git に乗らない。

```
開発リポジトリ(原本, GitHub にpush)  ──push/update──▶  キャッシュ(実行時コピー, 使い捨て)
   ~/Desktop/個人開発/ai-marketplace                      ~/.claude/plugins/cache/...
```

そのため**別の研究室ディレクトリで良い型・共通画像ができたら、行き先は常に開発リポジトリ**。
`/catalog-add` はこれを自動でやる:

1. 開発リポジトリの場所は `~/.config/lab-slides/config.json` の `repoPath` に記録
   (`scripts/promote.sh path` で解決。**現在ディレクトリに依存しない**)
2. その原本の `theme/lab.css` / `catalog/layouts.yaml` / `assets/` を編集
3. `scripts/promote.sh commit "<内容>"` で commit(必要なら push)
4. 各マシンで `/plugin update lab-slides` → キャッシュが最新化されて反映

共通画像は `promote.sh asset <画像> [名前]` で repo の `assets/` に登録。
別マシンでリポジトリを clone していない場合は昇格できない(そのマシンは `/plugin update`
で受け取る消費専用)。config.json をそのマシン用に書けば昇格側にもなれる。

## パイプライン(内部動作)

```
[素材] 進捗メモ / 実験ログ / 論文PDF / arXiv URL / 持ち時間
   │ ① 内容の構造化(スライドのことはまだ考えない)
   ▼
content.yaml   主張・根拠・使う図の整理
   │ ② テンプレ適用(progress / conference)+ 持ち時間から枚数逆算
   ▼
outline.yaml   1枚ごとの { 目的 / 見出し / 内容 / 図 / 話す時間 }
   ├──★ 関門1: 内容レビュー(テキスト段階、修正が一番安い)
   │ ③ レイアウトカタログから型を選んで Marp Markdown 生成
   ▼
slides.md → ④ HTML プレビュー(ブラウザ確認)
   ├──★ 関門2: デザインレビュー + slide-validator が機械チェック
   │ ⑤ 最終ビルド
   ▼
PDF(/ PPTX)
   │ ⑥ 学会・修論のみ: 発表台本 + 時間配分表
```

中間物はすべて `.lab-slides/work/<日付>_<タイプ>/` に残る。
outline.yaml が資産で、slides.md は outline から何度でも再生成できる使い捨て。

## 手動ビルド

skill を通さず直接ビルドすることもできる:

```bash
scripts/build.sh slides.md html   # プレビュー(プロジェクト層 theme.css を自動合成)
scripts/build.sh slides.md pdf    # 提出用
scripts/build.sh slides.md pptx   # 画像ベースの PPTX(PowerPoint で文字編集は不可)
```

## トラブルシュート

- **数式が崩れる** — `$` の対応を確認(validator も検出する)。ディスプレイ数式は `$$...$$`
- **ローカル画像が PDF に出ない** — `build.sh` は `--allow-local-files` を付けている。
  直接 marp を叩く場合は自分で付けること
- **テーマが当たらない** — slides.md の frontmatter が `theme: lab` になっているか確認
- **プラグインを編集したのに反映されない** — 実体は marketplace repo。
  `/plugin update lab-slides` でキャッシュを更新する
