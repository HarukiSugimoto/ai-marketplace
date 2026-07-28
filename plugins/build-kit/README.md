# build-kit

TDD 前提の**段階型開発システム**。設計 → 計画 → 実装 → 検証 → レポートを型化する。

obra/superpowers の「ゲートと証拠要求」、mattpocock/skills の grill 系の
「決定木 × frontier × 事実と決定の分離」、ayghri/i-have-adhd の「出力の形」を
いいところ取りし、issue tracker 連携と `docs/superpowers/` 固定パスは持たない。

## 5原則

全 skill に共通する背骨。これが build-kit の正体。

| # | 原則 | 防ぐもの |
|---|---|---|
| 1 | **スコープ宣言** — 触る範囲を先に宣言し、宣言外に手が伸びたら止まって報告する | 頼んでいない変更 |
| 2 | **証拠なき完了宣言の禁止** — 「通るはず」は証拠ではない | 未検証の「できました」 |
| 3 | **段階ゲート** — **判断がユーザーのものである境界**では必ず止まる。「作業を続けていいですか」だけのためには止まらない | 確認せずに突き進む |
| 4 | **気づきの報告義務** — 気づいたら必ず言う。ただし**実行はしない**。無ければ「無し」と書く | 言われたことしかやらない |
| 5 | **出力の型** — 1行目は結論か次の行動。**段階の現在地を毎回書く**。前置きと締めの挨拶を書かない | 判断に要る情報が埋もれる |

3 と 4 は一見矛盾するが、そうではない。**観察は義務、実行は許可制**という分離になっている。
黙って実行するのも、黙って見送るのも違反。

1〜4 が**振る舞い**の規定なのに対し、5 だけは**テキストの形**の規定。
分けずに並べているのは、build-kit が6段階を**自動で連鎖させる**から。
ユーザーはコマンドを打ち直さないので、今どの段階のどのタスクにいるかは
こちらが毎回書かないと分からない。7か条の全文は
[`templates/output-style.md`](templates/output-style.md)(各 skill には1行だけ置いて参照する)。

## 使い方 — コマンドは3つ

| コマンド | いつ | 何をするか |
|---|---|---|
| `/build-setup` | PJ で**1回だけ** | 検証コマンド・成果物の置き場所・PJ固有のレビュー手段を検出して `.build-kit/config.yaml` に記録 |
| `/build-design <説明>` | 機能ごと | 詰める → `design.md` → **■1** → `plan.md` → **■2** で止まる |
| `/build-run` | 機能ごと | 残りタスクを**全部**やり切る → 検証 → HTML レポート |

```
/build-setup                         ← 1回だけ
   ├ package.json / テスト設定 / 既存テストの置き場所 / 規約ファイルを読む
   ├ 既存のレビュー手段を探す(.claude/ / .agents/ / AGENTS.md / CI / husky)
   ├ 決まらないものだけ聞く（frontier で1ラウンド）
   ├ 記録するコマンドを実際に走らせて確認
   └ .build-kit/config.yaml

/build-design ログイン画面に「パスワードを忘れた」導線を足したい
   ├ 決定木を frontier 単位で詰める（ユーザーと往復）
   ├ design.md
   ├ ■1 設計の承認
   ├ plan.md + tasks/01..NN.md   ← 承認が出たら自動で続く
   └ ■2 計画の承認 → 止まる

/build-run
   ├ 着手可能なタスクから全部（RED→目視→GREEN→REFACTOR）
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

セッションをまたいで再開したときは、各タスクの `Blocked by` とチェックボックスから
**着手可能なものを計算し直して**続きに入る。

### スコープは「面」で宣言する — 毎回止まらないために

スコープ宣言は**単一ファイルでも glob でもよい**。`src/auth/**` と宣言すれば、
その配下の新規ファイルは宣言済みとして扱われ、いちいち止まりません。

実装前に触るファイルを全部言い当てるのは無理なので、**点(ファイル)ではなく
面(モジュール)で宣言する**のが既定の書き方です。ただし
**1つの範囲 = 1つのモジュール**まで — `src/**` は何も宣言していないのと同じなので不可。

build-run は、ファイルを触る前に上から順に判定します:

| # | 当たるもの | どうする |
|---|---|---|
| 1 | `protected_paths` | **必ず確認**(範囲宣言でも `auto_scope` でも免除されない) |
| 2 | plan.md の「触らないと明言するもの」 | **止まる**(名指しの除外が glob に勝つ) |
| 3 | 範囲宣言にマッチ | 進む |
| 4 | タスクの RED に書いたテストファイル | 進む(宣言不要) |
| 5 | `auto_scope` にマッチ | **止まらない。記録は残す** |
| 6 | どれにも当たらない | **止まる → 3択** |

**5 は止まらないだけで黙りません**(原則4)。`changes.md` に `(auto_scope)` 付きで記録され、
レポートには赤い「宣言外」ではなく中立色の「自動許可」として別枠に出ます。

6 で「1. スコープに追加して続ける」を選ぶと、**`plan.md` のスコープ宣言に承認済みとして
追記されます。** これが無いと、一度合意した変更が検証で再び違反として赤く出ます。

### タスクは依存順に取る(番号順ではない)

タスクは `tasks/<NN>-<slug>.md` に1ファイルずつあり、各ファイルが
**`Blocked by`(先に終わっている必要があるタスク)** を宣言する。
build-run は「上から順」ではなく **ブロッカーが全部済んだタスク**から取る。

**これは並列実行ではない。** 実装は今までどおり1タスクずつ、順番に進む。
得られるのは速さではなく、次の3つ:

| | |
|---|---|
| **迂回できる** | 01 で詰まっても、依存していない 03 に進める |
| **再開が楽** | セッションが切れても、次回は `Blocked by` と進捗から着手可能なものを再計算するだけ |
| **依存が明示される** | 「なんとなく順番」が「宣言された依存」になる。ゲート2で目視できる |

代わりに、**依存の書き漏らしがそのまま事故になります**(番号順に並んでいるだけでは
守られない)。対策は2つ入れてあります — ゲート2で依存だけを独立して確認すること、
build-run が着手前に「使うもの」の実在を確認して、無ければ止まること。

### `build-verify` / `build-report` にコマンドは無い

`/build-run` から自動で連鎖するので普段は不要。単独で回したいとき
（「レポートだけ出し直して」「検証だけもう一回」）は自然言語で呼べば skill が発火する。

### Codex ではコマンドが無い（skill 名で呼ぶ）

**Codex のプラグインが束ねられるのは skills / MCP servers / hooks の3つで、
コマンドは含まれない。** カスタムプロンプト（= スラッシュコマンド）は deprecated かつ
`~/.codex/prompts/` のユーザー階層のみで、プラグインからは配布できない。
OpenAI 自身が「skills を使え、skills は明示的にも暗黙的にも呼べる」と案内している。

なので Codex では **skill を名前で呼ぶ**:

| Claude Code | Codex |
|---|---|
| `/build-setup` | 「build-setup で設定して」 |
| `/build-design 〜を作りたい` | 「build-design で〜の設計を始めて」 |
| `/build-run` | 「build-run で実装して」 |

各 skill の `description` に日本語のトリガー句を入れてあるので、
「セットアップして」「設計を固めたい」「実装して」でも暗黙に発火する。

**それ以外は両方で同じように動く:**

- `${CLAUDE_PLUGIN_ROOT}` は Codex でも**後方互換で提供されている**
  （`PLUGIN_ROOT` / `PLUGIN_DATA` と併存）。雛形もスクリプトも同じパスで解決できる
- サブエージェントは名前だけ違う（Claude Code = `general-purpose` / Codex = `default`）。
  build-verify に対応表を書いてある
- 質問は AskUserQuestion が無ければ番号を振って1メッセージにまとめる

## skill

コマンドは3本、skill は6本。段階の切り替えは各 skill 末尾の「そのまま次へ続ける」で連鎖する。

| skill | 段階 | やること | 出るもの |
|---|---|---|---|
| `build-setup` | 準備 | 検証コマンド・置き場所・PJ固有のレビュー手段を検出し、**実際に走らせて確認**してから記録 | `.build-kit/config.yaml` |
| `build-design` | 設計 | 決定木の frontier をラウンドで詰め、案を2〜3比較し、受入条件の素案を作る。**承認後そのまま build-plan へ** | `design.md` |
| `build-plan` | 計画 | 受入条件を**テストの形**に落とし、触るファイルを宣言し、全レイヤーを貫く縦割りのタスクに割って1タスク1ファイルで書き出す | `plan.md` + `tasks/` |
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
| `protected_paths` | `.env` 等 | 計画に明記されていても改めて確認を取る。**範囲宣言でも `auto_scope` でも免除されない** |
| `auto_scope` | スナップショット / coverage | 宣言外でも**止まらない**パス。止まらないだけで記録は残る |
| `tdd_mode` | `strict` | `pragmatic` にすると理由明記で免除可 |
| `test_layout` | — | テストファイルの置き場所の慣習 |

### PJ 固有のレビューが優先される

`review_skill` / `review_command` が設定されていれば、Standards 軸は**そちらを使う**。
build-kit の汎用レビュアーは、PJ に何も無いときのフォールバック。

`/build-setup` は `.claude/commands/` `.claude/skills/` `.agents/skills/` `AGENTS.md`
`.codex/agents/` `.github/workflows/` `.husky/` `package.json` の scripts を探して、
**既にあるレビュー手段を見つけてくる**(Claude / Codex どちらの流儀でも拾う)。

**コーディング規約は持たない。** 命名やディレクトリ構造は PJ の CLAUDE.md に任せる。
build-kit が扱うのは「段階の進め方」だけ。

## 成果物

```
<docs_dir>/<YYYY-MM-DD>-<slug>/
├── design.md          # 何を解くか、案の比較、受入条件の素案
├── plan.md            # 全体制約、スコープ宣言、受入条件→テスト対応、依存の見取り図
├── tasks/
│   ├── 01-<slug>.md   # Blocked by / RED / 失敗の期待 / GREEN / インターフェース / 進捗
│   ├── 02-<slug>.md
│   └── 03-<slug>.md
├── changes.md         # 変更したファイルと「なぜ変えたか」
├── report.json        # レポートの入力
└── report.html        # 生成物。コミットしない
```

`design.md` / `plan.md` / `tasks/` / `changes.md` はコミット対象。`report.html` は生成物。

**依存と進捗の正は `tasks/*.md` 側。** `plan.md` の依存の表は計画時点の見取り図で、
ズレたらタスクファイルが勝つ。タスクファイル1枚を単独で渡しても実装できる状態に保つ、
というのが分割の目的なので、そのファイルが依存について嘘をつくと意味がなくなる。

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

★は**外部に出典が無い** build-kit 固有の部分。
出典のほとんどは agent-kit の 81 skill から。例外は原則5(出力の型)だけで、
こちらは [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) から取っている。

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
| **縦割り(tracer bullet)** — 細くてよいが全レイヤーを貫く1本の経路。水平タスクを作らない | mattpocock `to-tickets` |
| **prefactoring を先頭に**(「変更しやすくしてから、変更する」) | 同上 Step 2 |
| **広域変更は縦割りの例外 → expand → migrate → contract** / バッチは影響範囲で切る / 緑にできないときは統合タスクで約束する | 同上 _Wide refactors are the exception_ |
| **1タスク1ファイル + `Blocked by` をテキストで宣言** | 同上のローカル tracker モード(`.scratch/<feature>/issues/<NN>-<slug>.md`) |
| **frontier**(ブロッカーが全部済んだものから取る) | mattpocock `to-tickets` / `batch-grill-me`。build-kit では既に**質問**の frontier を使っており、その**タスク版** |
| ★ **依存の正はタスクファイル側**(plan.md の表は見取り図。ズレたらタスクが勝つ) | — |
| ★ **`使うもの` と `Blocked by` は一致する**という不変条件 / ゲート2で依存を独立項目として確認する | — |

**採らなかったもの:** blocking edge の native リンク化と issue tracker への publish
(build-kit は issue tracker 連携を意図的に持たない)、`Quiz the user` の反復
(ゲート2が同じ役目を果たす)。

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

### 出力の型(原則5 / `templates/output-style.md`)

**唯一 agent-kit の外から取ったもの。** 出典は [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)(MIT)。
元は「ADHD の読者が行動に移せる出力の形」を10ルールで規定した skill。

| 取り込んだもの | 出典のルール番号 |
|---|---|
| 1行目は結論か次の行動。前置きの宣言で始めない | 1 |
| 手順は番号付き、1項目1動作 | 2 |
| **現在地を毎回書く**(読者は前のメッセージの位置を覚えていない前提) | 5 |
| 止まるときは次の1手を1つだけ | 3 |
| 完了は「何ができるようになったか」+ 証拠で見せる | 7 |
| エラーは淡々と(場所・原因・次) | 8 |
| 前置き・まとめ・締めの挨拶を書かない | 10 |
| **「破ってよい条件」を skill 自身に持たせる**という構造 / 送信前チェック | 出典の同名セクション |
| ★ 現在地を「段階 + `02 of 05`」の2軸で書く / ゲート・証拠・気づき・判定表を7条の適用外と明記 | — |

**採らなかった3つ**(理由は `templates/output-style.md` 末尾に記録):

| 採らないルール | 理由 |
|---|---|
| 4. 脱線を抑える | **原則4(気づきの報告義務)と衝突する** |
| 6. 具体的な時間見積もり | 実行者がエージェントなので「15分」が意味を持たない。タスク数・テスト本数で代替 |
| 9. リストは5項目まで | 受入条件表・指摘一覧・`changes.md` を5件で切ると情報が落ちる |

### 逆引き

| 借りた skill | 効いた場所 |
|---|---|
| obra `verification-before-completion` | build-verify のほぼ全部 + 原則1〜4の文体 + build-setup の「走らせてから記録」 |
| obra `test-driven-development` | build-run の状態機械 + build-plan の RED/GREEN + 原則1〜4の文体 |
| obra `brainstorming` | build-design のゲート・案の比較・セクション承認・保存形式 |
| obra `writing-plans` | build-plan のタスク粒度・インターフェース欄・全体制約 |
| obra `systematic-debugging` | build-run Step 4.5 |
| obra `requesting-code-review` | レビュアー雛形2本の read-only と出力形式 |
| mattpocock `code-review` | build-verify の2軸構造 + Standards 雛形の全部 + build-setup の規約検出 |
| mattpocock `grilling` | build-design / build-setup の「事実と決定の分離」 |
| mattpocock `batch-grill-me` | build-design / build-setup の frontier ラウンド |
| mattpocock `karpathy-guidelines` | build-run の簡潔さ・孤児・辿れるかテスト |
| mattpocock `to-tickets` | build-plan Step 3 の縦割り・prefactoring・expand–contract + 1タスク1ファイル + frontier |
| mattpocock `implement` | build-run/verify のテスト実行の分担(確認に使っただけ) |
| wanshuiyin `kill-argument` | build-verify の「会話履歴を渡さない」 |
| 自作 `loop-kit / loop-design` | config 解決の構造 + 「CLAUDE.md を複製しない」思想 |
| ayghri `i-have-adhd` | 原則5(出力の型)の全部 |

### 調査の範囲

agent-kit が展開している **81 skill のうち、本文を読んだのは 26 本。そこから 14 本を採用した。**
残る 55 本は description しか見ていない。**`i-have-adhd` だけは agent-kit の外**(単独の
marketplace)から取っている。

第1回(v0.1.0)に読んだもの: `brainstorming` / `test-driven-development` /
`verification-before-completion` / `requesting-code-review`(+`code-reviewer.md`) /
`writing-plans` / `systematic-debugging` / `grilling` / `grill-me` / `grill-with-docs` /
`batch-grill-me` / `karpathy-guidelines` / `code-review` / `implement` / `kill-argument` /
自作 `loop-design` / 記録アプリの `check-spec`

第2回(v0.3.0)に読んだもの: `to-spec` / **`to-tickets`(採用)** / `tdd`(mattpocock 版) /
`codebase-design`(+`DEEPENING.md` / `DESIGN-IT-TWICE.md`) / `domain-modeling` /
`setup-agent-environment` / `triage` / `prototype` / `research` / `wayfinder` /
`improve-codebase-architecture` / `ask-matt`

**description ベースの判断は当てにならない。** grill 系4本は読んだら判定が逆転した
(`grill-me` は中身の無いエイリアスで、本体は `grilling` だった。
`batch-grill-me` は重複ではなく別モデルだった)。
**採否を見直すときは、description ではなく本文を読むこと。**

**第2回で分かったこと。** `to-spec` / `implement` に相当するものは build-kit が既に
持っていた(`design.md` と build-run)。**足りなかったのは `to-tickets` だけ** — 分解の
「形」の規定(縦割り)と、縦割りにできない広域変更の逃げ道(expand–contract)。
`codebase-design` の deep module 語彙、`prototype`、`wayfinder`(1セッションに収まらない
規模を決定チケットの地図として扱う)は読んだうえで**今回は見送り**、候補として残す。

## 意図的に持たないもの

| 持たないもの | 理由 |
|---|---|
| コーディング規約 | PJ の CLAUDE.md の役目。二重管理を避ける |
| issue tracker 連携 | GitHub issue を運用していないので機能しない |
| 「テストを書かなくてよい」経路 | TDD が前提。免除は `pragmatic` + 理由明記のときだけ |
| 自動コミット / 自動 push | 判断がユーザーのものなので原則3に反する |
| `/build-run 03` のような部分実行 | 受入条件が計画全体に対して定義されているので、途中で止めると検証が成立しない |
| `build-verify` / `build-report` のコマンド | 自動連鎖するので不要。コマンドの打ち直しは儀式でしかない |
