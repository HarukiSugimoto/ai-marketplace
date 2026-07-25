# build-kit

TDD 前提の**段階型開発システム**。設計 → 計画 → 実装 → 検証 → レポートを型化する。

obra/superpowers の「ゲートと証拠要求」、mattpocock/skills の grill 系の
「決定木 × frontier × 事実と決定の分離」をいいところ取りし、
issue tracker 連携と `docs/superpowers/` 固定パスは持たない。

## 4原則

全 skill に共通する背骨。これが build-kit の正体。

| # | 原則 | 防ぐもの |
|---|---|---|
| 1 | **スコープ宣言** — 触る範囲を先に宣言し、宣言外に手が伸びたら止まって報告する | 頼んでいない変更 |
| 2 | **証拠なき完了宣言の禁止** — 「通るはず」は証拠ではない | 未検証の「できました」 |
| 3 | **段階ゲート** — **判断がユーザーのものである境界**では必ず止まる。「作業を続けていいですか」だけのためには止まらない | 確認せずに突き進む |
| 4 | **気づきの報告義務** — 気づいたら必ず言う。ただし**実行はしない**。無ければ「無し」と書く | 言われたことしかやらない |

3 と 4 は一見矛盾するが、そうではない。**観察は義務、実行は許可制**という分離になっている。
黙って実行するのも、黙って見送るのも違反。

## 使い方 — コマンドは3つ

| コマンド | いつ | 何をするか |
|---|---|---|
| `/build-setup` | PJ で**1回だけ** | 検証コマンド・成果物の置き場所・PJ固有のレビュー手段を検出して `.build-kit/config.yaml` に記録 |
| `/build-design <説明>` | 機能ごと | 詰める → `design.md` → **■1** → `plan.md` → **■2** で止まる |
| `/build-run` | 機能ごと | 残りタスクを**全部**やり切る → 検証 → HTML レポート |

```
/build-setup                         ← 1回だけ
   ├ package.json / テスト設定 / 既存テストの置き場所 / 規約ファイルを読む
   ├ .claude/commands/ と .claude/skills/ から PJ 固有のレビュー手段を探す
   ├ 決まらないものだけ聞く（frontier で1ラウンド）
   ├ 記録するコマンドを実際に走らせて確認
   └ .build-kit/config.yaml

/build-design ログイン画面に「パスワードを忘れた」導線を足したい
   ├ 決定木を frontier 単位で詰める（ユーザーと往復）
   ├ design.md
   ├ ■1 設計の承認
   ├ plan.md            ← 承認が出たら自動で続く
   └ ■2 計画の承認 → 止まる

/build-run
   ├ 未完タスクを先頭から全部（RED→目視→GREEN→REFACTOR）
   │    └ ■3 スコープ逸脱なら止まる
   ├ 検証（Spec 軸 / Standards 軸を並列サブエージェントで）  ← 自動
   │    └ ■4 ⚠️ か ❌ が出たら止まる
   └ HTML レポート → ブラウザで開く                        ← 自動
```

**止まるのは判断が要る4箇所だけ。** 設計の承認 / 計画の承認 / スコープ逸脱 / 未確認の扱い。
「次に進んでいいですか」「検証していいですか」とは聞かない — それは判断ではなく許可の確認。

### `/build-run` はタスクを指定できない

**残っているタスクは全部やり切る。** 受入条件は計画全体に対して定義されているので、
途中で止めると検証が成立せず「未確認」だらけの判定表になる。
一部だけ直したいなら、それは別の計画(=別の `/build-design`)にすべき対象。

セッションをまたいで再開したときは、チェックボックスを見て続きから入る。

### `build-verify` / `build-report` にコマンドは無い

`/build-run` から自動で連鎖するので普段は不要。単独で回したいとき
（「レポートだけ出し直して」「検証だけもう一回」）は自然言語で呼べば skill が発火する。

## skill

コマンドは3本、skill は6本。段階の切り替えは各 skill 末尾の「そのまま次へ続ける」で連鎖する。

| skill | 段階 | やること | 出るもの |
|---|---|---|---|
| `build-setup` | 準備 | 検証コマンド・置き場所・PJ固有のレビュー手段を検出し、**実際に走らせて確認**してから記録 | `.build-kit/config.yaml` |
| `build-design` | 設計 | 決定木の frontier をラウンドで詰め、案を2〜3比較し、受入条件の素案を作る。**承認後そのまま build-plan へ** | `design.md` |
| `build-plan` | 計画 | 受入条件を**テストの形**に落とし、触るファイルを宣言し、RED→GREEN のタスクに割る | `plan.md` |
| `build-run` | 実装 | RED → 失敗を目視 → GREEN → REFACTOR を1タスクずつ。宣言外に触るとき停止。**完了後そのまま build-verify へ** | コード + `changes.md` |
| `build-verify` | 検証 | コマンドを実際に走らせ、**2軸を並列サブエージェント**で判定 | 判定表 |
| `build-report` | 報告 | 全部を1枚の HTML にまとめてブラウザで開く | `report.html` |

### 検証をサブエージェントにやらせる理由

実装した本人は「動くと知っている」ので、証拠が無い項目を無意識に ✅ に丸める。
会話履歴を持たない目に判定させると、**書かれた証拠だけで判断せざるを得なくなる。**

2体を1メッセージで並列に投げ（順に投げると互いの結論が汚染される）、結果はマージせず並べる:

| 軸 | 見るもの | 雛形 |
|---|---|---|
| **Spec** | 受入条件を満たしたか。✅達成 / ⚠️未確認 / ❌未達 の3値 | `templates/reviewer-spec.md` |
| **Standards** | 規約準拠とコード品質。Fowler の code smell 12種をベースラインに | `templates/reviewer-standards.md` |

> 規約を全部守っているが間違ったものを作った → Standards 合格 / Spec 不合格
> 仕様どおりだが規約を壊している → Spec 合格 / Standards 不合格

片方が片方を隠すので、**ランク付けし直さない。** 渡すのは差分・計画・コマンド出力・規約だけで、
**セッションの会話履歴は渡さない**（作った側の言い分を混ぜないため）。

## プロジェクト設定

`<PJルート>/.build-kit/config.yaml`。**`/build-setup` が作る**（手書きもできる。雛形は
`templates/config.yaml`）。無いまま `/build-design` を打つと、先に setup を勧められる。

**コミット対象。** PJ の設定なのでチームや別マシンと共有する。

| キー | 既定 | 意味 |
|---|---|---|
| `docs_dir` | `docs/dev` | 設計・計画・レポートの置き場所。**PJ の既存体系に合わせられる** |
| `test_command` | `npm test` | 検証の主証拠 |
| `typecheck_command` | `npx tsc --noEmit` | 前提条件(通って当たり前) |
| `lint_command` | (空) | 前提条件。**lint が見るものは Standards レビュアーに二重に見せない** |
| `build_command` | (空) | 空なら実行しない |
| `test_one_command` | — | RED を目視するとき単体で走らせるテンプレ。ランナーごとに違う |
| `known_failures` | `0` | setup 時点で既に赤かった件数。「今回壊した分」との判別基準 |
| `review_skill` | (空) | **PJ 固有のレビュー skill / スラッシュコマンド**（例 `/check-spec`）。Standards 軸の代わりに使う |
| `review_command` | (空) | PJ 固有のレビューをシェルで（例 `npm run review`） |
| `standards_files` | `CLAUDE.md` | 規約の出典。**ここの規約が内蔵の smell ベースラインを上書きする** |
| `review_focus` | `[]` | このPJで特に見てほしい観点 |
| `protected_paths` | `.env` 等 | 計画に明記されていても改めて確認を取る |
| `tdd_mode` | `strict` | `pragmatic` にすると理由明記で免除可 |
| `test_layout` | — | テストファイルの置き場所の慣習 |

### PJ 固有のレビューが優先される

`review_skill` / `review_command` が設定されていれば、Standards 軸は**そちらを使う**。
build-kit の汎用レビュアーは、PJ に何も無いときのフォールバック。

`/build-setup` は `.claude/commands/` `.claude/skills/` `.github/workflows/` `.husky/`
`package.json` の scripts を探して、**既にあるレビュー手段を見つけてくる。**

**コーディング規約は持たない。** 命名やディレクトリ構造は PJ の CLAUDE.md に任せる。
build-kit が扱うのは「段階の進め方」だけ。

## 成果物

```
<docs_dir>/<YYYY-MM-DD>-<slug>/
├── design.md      # 何を解くか、案の比較、受入条件の素案
├── plan.md        # 全体制約、スコープ宣言、受入条件→テスト対応、RED/GREEN タスク
├── changes.md     # 変更したファイルと「なぜ変えたか」
├── report.json    # レポートの入力
└── report.html    # 生成物。コミットしない
```

`design.md` / `plan.md` / `changes.md` はコミット対象。`report.html` は生成物。

## HTML レポート

```bash
node scripts/report.mjs <path>/report.json          # report.html を生成
node scripts/report.mjs <path>/report.json -o out.html
```

依存ゼロの自己完結 HTML。**白基調・タブ3枚。**

| タブ | 中身 | 元データ |
|---|---|---|
| **計画** | 受入条件(条件のみ)・タスク消化・スコープ宣言 | `plan.md` |
| **変更内容** | 変更ファイルと理由の表 + **行番号つき差分** | `changes.md` + `git diff` |
| **総評** | 判定・受入条件×証拠・検証コマンドの出力・スコープ照合・気づき・積み残し | build-verify |

ヘッダ(判定と集計)は常に見える。受入条件は計画タブに条件だけ、総評タブに証拠つきの判定が出る。

### 差分は git の出力をそのまま渡す

```bash
git diff <BASE>...<HEAD>      # → report.json の "diff" にそのまま入れる
```

`report.mjs` が unified 形式のハンクヘッダ `@@ -12,9 +12,20 @@` を読んで
**旧側・新側の行番号を復元**し、GitHub と同じ形（左が変更前・右が変更後の行番号、
追加は緑・削除は赤、ハンク境界は青帯）で描画する。ファイルごとに `+N / −M` の集計つき。

**加工しないこと。** `--stat` や `--name-only` に置き換えると行番号が出せなくなる。

### 見た目を変えるとき

CSS・骨組み・タブの JS は **`templates/report.html`** にある。`report.mjs` は
断片を組み立ててプレースホルダを埋めるだけなので、**配色やレイアウトを変えたいだけなら
テンプレの `<style>` を触れば足りる。**

(リポジトリの `.gitignore` は `*.html` を除外しているが、このテンプレだけ
`!plugins/build-kit/templates/report.html` で例外にしてある。ファイル名を変えるなら例外行も。)

**未確認を達成に丸めない。** 未確認が残っているレポートは、そう表示されるのが正しい。

入力の書き方は `templates/report.example.json` を見ること（差分のサンプル入り）。

## 出典 — skill ごとに何を借りたか

★は agent-kit に出典が無い build-kit 固有の部分。

### build-setup

| 取り込んだもの | 出典 |
|---|---|
| **事実は自分で調べ、決定だけ聞く** | mattpocock `grilling` |
| frontier で1ラウンドにまとめ、推奨回答を添える | mattpocock `batch-grill-me` |
| **記録する前に実際に走らせる** | obra `verification-before-completion` の証拠主義を転用 |
| 規約の出典を特定する / **tooling が強制するものは skip**(→ `lint_command` を分けた理由) | mattpocock `code-review` |
| config を上へ探す / CLAUDE.md を複製しない | 自作 `loop-kit` の `loop-design` |
| ★ `.claude/commands/` `.claude/skills/` から **PJ 固有のレビュー手段**を探す | — |
| ★ `known_failures`(既存の失敗件数を判別基準にする) | — |

### build-design

| 取り込んだもの | 出典 |
|---|---|
| 承認まで実装アクション禁止(`<HARD-GATE>`) | obra `brainstorming` |
| 案を2〜3出す / セクションごとに承認 / 規模が大きければ先に分解提案 | obra `brainstorming` |
| 「build-plan 以外の skill を呼ばない」 | obra `brainstorming`(原文: terminal state is invoking writing-plans) |
| `<日付>-<slug>/design.md` という保存形式 | obra `brainstorming` |
| **事実と決定の分離** / 各質問に推奨回答 | mattpocock `grilling` |
| **決定木・frontier・「frontier が空 = 黙って仮定したものが無い」** | mattpocock `batch-grill-me` |
| config を上へ探す / 規約は PJ の CLAUDE.md に任せる | 自作 `loop-design` |
| ★ 受入条件の「書いてよい／いけない」表 | — |

### build-plan

| 取り込んだもの | 出典 |
|---|---|
| 日付付きパスへの保存 / `- [ ]` でタスク追跡 | obra `writing-plans` |
| **タスク粒度の基準**(レビュアーが単独で却下しうる最小単位／セットアップは畳み込む) | obra `writing-plans` |
| **インターフェース欄**(使うもの／出すもの) | obra `writing-plans` の Consumes / Produces |
| **全体制約**(PJ 全体の要件を逐語コピー) | obra `writing-plans` の Global Constraints |
| RED→GREEN→REFACTOR | obra `test-driven-development` |
| **「失敗の期待」を事前に書く** | 同上の状態機械 `verify_red -> red [label="wrong failure"]` |
| ★ **受入条件 → テスト対応表** | —(`verification-before-completion` の `Claim / Not Sufficient` 表を事前固定に反転) |
| ★ **スコープ宣言** / `tdd_mode` の免除基準 | — |

### build-run

| 取り込んだもの | 出典 |
|---|---|
| RED → 失敗を目視 → GREEN → REFACTOR | obra `test-driven-development` の DOT グラフ |
| 「違う理由で失敗したらテストを直す、実装に進まない」 | 同上の `wrong failure` 辺 |
| **簡潔さの基準**(使い捨てに抽象化を作らない／起こり得ないエラー処理を書かない／200行が50行なら書き直す) | multica-ai `karpathy-guidelines` §2 |
| **孤児の片付け**(自分が生んだ未使用 import は消す。元からある dead code は消さない) | `karpathy-guidelines` §3 |
| **「変更した全行が要求まで直線で辿れるか」** | `karpathy-guidelines` §3 |
| **根本原因の調査なしに修正を試さない**(Step 4.5) | obra `systematic-debugging` の Iron Law + Phase 1 |
| 単体テストは頻繁に・フルテストは最後に1回 | mattpocock `implement` |
| ★ **「なぜか成功してしまう」分岐**(原文の状態機械に欠けていた) | — |
| ★ **スコープの番人**(止まる→報告→3択) / `changes.md` の変更理由 | — |

### build-verify

一番多くを借りている。

| 取り込んだもの | 出典 |
|---|---|
| **鉄則**("If you haven't run the verification command in this message…") | obra `verification-before-completion`。ほぼ直訳 |
| 「証拠ではないもの」5項目 | 同 Common Failures 表の `Not Sufficient` 列 |
| IDENTIFY → RUN → READ → VERIFY → ONLY THEN | 同 The Gate Function |
| `42 passed, 0 failed` と数字で書かせる | 同 |
| **2軸を並列サブエージェントで、マージせずランク付けし直さない** | mattpocock `code-review` |
| **「片方が片方を隠す」**という分離の理由づけ | 同 _Why two axes_ |
| **Fowler の code smell 12種** / repo の規約が上書き / tooling skip | 同 |
| git で差分を確定させてから評価する | obra `requesting-code-review` |
| **会話履歴を渡さない** | wanshuiyin `kill-argument` の `CONTEXT_POLICY = fresh` |
| ★ **✅/⚠️/❌ の3値**と「⚠️ を ✅ に丸めない」(原文は2値) | — |
| ★ **Spec 軸もサブエージェント化**(実装者バイアスを外す) / スコープ照合 / PJ 固有レビューの優先 | — |

### build-report

**agent-kit の81本からは何も参考にしていない。** 変更内容を HTML で出す skill は存在しない。

| | |
|---|---|
| HTML を成果物として出す発想 | 自作 `lab-slides` / `work-slides` の「HTML 二枚看板」の転用 |
| (発想の先例としては存在した) | `kill-argument` の `RENDER_HTML = true` |

### レビュアーの雛形2本

| 雛形 | 取り込んだもの | 出典 |
|---|---|---|
| `reviewer-standards.md` | Fowler smell 12種を「何か→どう直すか」で / 規約が上書き / tooling skip | mattpocock `code-review` |
| | **read-only 縛り**(HEAD を動かすな。必要なら `git worktree add /tmp/`) / Critical・Important・Minor / **「全部が Critical ではない」較正** / 良い点を先に / **読んでいないコードに意見を書かない** | obra `requesting-code-review` の `code-reviewer.md` |
| `reviewer-spec.md` | missing/partial・scope creep・実装が間違っている の3観点 | mattpocock `code-review` の Spec 軸ブリーフ |
| | ★ テストが**実在し実際に結果に含まれる**か確認 / 中身を読む(アサーション無しは達成ではない) / 「実装を読む限り満たしていそう」は ⚠️ | — |

### 逆引き

| agent-kit の skill | 効いた場所 |
|---|---|
| obra `verification-before-completion` | build-verify のほぼ全部 + 4原則の文体 + build-setup の「走らせてから記録」 |
| obra `test-driven-development` | build-run の状態機械 + build-plan の RED/GREEN + 4原則の文体 |
| obra `brainstorming` | build-design のゲート・案の比較・セクション承認・保存形式 |
| obra `writing-plans` | build-plan のタスク粒度・インターフェース欄・全体制約 |
| obra `systematic-debugging` | build-run Step 4.5 |
| obra `requesting-code-review` | レビュアー雛形2本の read-only と出力形式 |
| mattpocock `code-review` | build-verify の2軸構造 + Standards 雛形の全部 + build-setup の規約検出 |
| mattpocock `grilling` | build-design / build-setup の「事実と決定の分離」 |
| mattpocock `batch-grill-me` | build-design / build-setup の frontier ラウンド |
| mattpocock `karpathy-guidelines` | build-run の簡潔さ・孤児・辿れるかテスト |
| mattpocock `implement` | build-run/verify のテスト実行の分担(確認に使っただけ) |
| wanshuiyin `kill-argument` | build-verify の「会話履歴を渡さない」 |
| 自作 `loop-kit / loop-design` | config 解決の構造 + 「CLAUDE.md を複製しない」思想 |

### 調査の範囲

agent-kit が展開している **81 skill のうち、本文を読んだのは 16 本。そこから 13 本を採用した。**
残る 65 本は description しか見ていない。

読んだもの: `brainstorming` / `test-driven-development` / `verification-before-completion` /
`requesting-code-review`(+`code-reviewer.md`) / `writing-plans` / `systematic-debugging` /
`grilling` / `grill-me` / `grill-with-docs` / `batch-grill-me` / `karpathy-guidelines` /
`code-review` / `implement` / `kill-argument` / 自作 `loop-design` / 記録アプリの `check-spec`

**description ベースの判断は当てにならない。** grill 系4本は読んだら判定が逆転した
(`grill-me` は中身の無いエイリアスで、本体は `grilling` だった。
`batch-grill-me` は重複ではなく別モデルだった)。
**採否を見直すときは、description ではなく本文を読むこと。**

## 意図的に持たないもの

| 持たないもの | 理由 |
|---|---|
| コーディング規約 | PJ の CLAUDE.md の役目。二重管理を避ける |
| issue tracker 連携 | GitHub issue を運用していないので機能しない |
| 「テストを書かなくてよい」経路 | TDD が前提。免除は `pragmatic` + 理由明記のときだけ |
| 自動コミット / 自動 push | 判断がユーザーのものなので原則3に反する |
| `/build-run T3` のような部分実行 | 受入条件が計画全体に対して定義されているので、途中で止めると検証が成立しない |
| `build-verify` / `build-report` のコマンド | 自動連鎖するので不要。コマンドの打ち直しは儀式でしかない |
