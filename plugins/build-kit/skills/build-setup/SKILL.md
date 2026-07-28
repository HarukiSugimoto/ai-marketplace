---
name: build-setup
description: プロジェクトに build-kit を導入する。検証コマンド・成果物の置き場所・PJ固有のレビュー手段を検出して .build-kit/config.yaml に記録し、実際に動くか確認する。「build-kit を設定して」「このPJで使えるようにして」「セットアップして」で発動。
---

# build-setup — このPJ用に build-kit を合わせる

`.build-kit/config.yaml` を作る。**1回だけ**走らせればよい(設定を変えたくなったら再度)。

build-kit は「段階の進め方」しか持たない。**何をもって検証とするか、成果物をどこに置くか、
このPJでレビューとは何を指すかは、PJ ごとに違う。** それをここで確定させる。

## 5原則(build-kit 共通)

1. **スコープ宣言** — 触る範囲を先に宣言する。宣言外に手が伸びたら**止まって報告**。黙って広げない
2. **証拠なき完了宣言の禁止** — 「できた」と言うには証拠が要る。「通るはず」は証拠ではない
3. **段階ゲート** — **判断がユーザーのものである境界**では必ず止まる
   (設計の承認 / 計画の承認 / スコープ逸脱 / 未確認の扱い)。
   逆に「作業を続けていいですか」だけのためには止まらない — それは判断ではない
4. **気づきの報告義務** — 気づいたことは**必ず言う。ただし実行はしない**。
   言うことが無ければ「無し」と書く。**黙って見送るのは違反**
5. **出力の型** — 1行目は結論か次の行動。**段階の現在地(どの段階か / `02 of 05` のどこか)を毎回書く**。
   前置きと締めの挨拶を書かない。詳細は `${CLAUDE_PLUGIN_ROOT}/templates/output-style.md`

この skill では 2 が効く。**「たぶんこのコマンドで動く」を書き込まない。**
記録する前に実際に走らせる(Step 3)。

## Step 1: 検出する(★聞く前に調べる)

```
事実を見つけるのは自分の仕事。決定を下すのはユーザーの仕事。
```

以下を**実際に開いて読む。** 「どのテストコマンドを使っていますか」と聞かない。

### 検証コマンド

| 見る場所 | 取るもの |
|---|---|
| `package.json` の `scripts` | `test` / `typecheck` / `lint` / `build` に相当するもの |
| `jest.config.*` / `vitest.config.*` / `playwright.config.*` | テストランナーと単体実行の書式 |
| `tsconfig.json` | 型チェックの有無 |
| `.eslintrc*` / `eslint.config.*` / `biome.json` | lint の有無 |
| `pyproject.toml` / `Cargo.toml` / `Makefile` | JS 以外のスタックのとき |

**`test_one_command`(1テストだけ走らせる書式)を必ず特定する。**
build-run が RED を目視するのに使う。ランナーごとに違う:

- jest: `npx jest {path} -t '{name}'`
- vitest: `npx vitest run {path} -t '{name}'`
- pytest: `pytest {path} -k '{name}'`

### 既存テストの置き場所

実際のテストファイルを探して**慣習を読む**(`__tests__/` か `*.test.ts` 隣接か、
`tests/` 直下か)。`test_layout` に落とす。

**テストが1つも無い場合はそう報告する。** `tdd_mode` の相談材料になる(Step 2)。

### 成果物の置き場所

`docs/` の既存構成を見る。既に設計書の体系があるなら**それに合わせる**
(例: `spec_v0_2.md` のような番号付き文書があるなら、`docs_dir` をその隣に置く)。
build-kit の都合で新しい体系を持ち込まない。

### 規約の出典

`CLAUDE.md` / `AGENTS.md` / `CODING_STANDARDS.md` / `CONTRIBUTING.md` / `.editorconfig`。
見つかったものを `standards_files` に列挙する。

### PJ 固有のレビュー手段(★見落としやすい)

**このPJに、すでにレビューの仕組みがあるかもしれない。** 探す場所:

| 場所 | 何があるか |
|---|---|
| `.claude/commands/*.md` | PJ 固有のスラッシュコマンド(`/review` `/check` 等) |
| `.claude/skills/*/SKILL.md` | PJ 固有の skill(`check-spec` のような整合性確認) |
| `.claude/settings.json` の `hooks` | commit/push 時に自動で走るチェック |
| `.agents/skills/*/SKILL.md` | ハーネス中立の skill(Codex もここを読む) |
| `AGENTS.md` | Codex 側の規約・レビュー方針。`standards_files` の候補でもある |
| `.codex/` の `agents/*.toml` / `hooks.json` | Codex のサブエージェント定義・自動チェック |
| `package.json` の `scripts` | `review` / `check` / `audit` 系 |
| `.github/workflows/*.yml` | CI が何を回しているか |
| `.husky/` / `lefthook.yml` | pre-commit で走るもの |

**あれば、build-kit の汎用 Standards レビュアーより PJ 固有のもののほうが正確。**
`review_skill`(skill / スラッシュコマンド)か `review_command`(シェル)に記録する。

CI が回しているものは `lint_command` などに取り込む
(**lint が機械的に見るものを、レビュアーに二重に見せない**ため)。

## Step 2: 決まらないものだけ聞く

検出できたものは**報告するだけで、確認を求めない。** 聞くのは次の2種類だけ:

1. **検出できなかったもの** — 例: テストコマンドが見つからない
2. **決定が要るもの** — 候補が複数ある、またはユーザーの方針次第

frontier としてまとめて1ラウンドで聞く(AskUserQuestion が使えるなら最大4問。
無いハーネスでは番号を振って1メッセージにまとめる)。各質問に**推奨する答えを添える。**

決定が要る典型:

| 論点 | 選択肢 |
|---|---|
| `docs_dir` | 既存の docs 体系に合わせる / `docs/dev` を新設 / `.build-kit/docs` に隔離 |
| `tdd_mode` | `strict`(全タスクで RED 先行) / `pragmatic`(理由明記で免除可) |
| `protected_paths` | 既定(`.env*` / lockfile)に足すものがあるか |
| レビュー | PJ 固有の `<見つけたもの>` を使う / build-kit の汎用 Standards 軸を使う / 両方 |

**テストが1つも無かった場合は、ここで正直に言う:**

> このPJにはテストがありません。build-kit は TDD 前提なので、`strict` だと
> 最初のタスクでテスト基盤の整備から始まります。次のどれにしますか。
> 1. strict のまま(テスト基盤の整備を 01 にする)
> 2. pragmatic(ロジック層だけテスト、UI は理由明記で免除)
> 3. 先にテスト環境だけ別途整える

## Step 3: 記録する前に動かす(★飛ばさない)

**config に書くコマンドを、実際に走らせる。**

| コマンド | 期待 |
|---|---|
| `typecheck_command` | exit 0(赤ならそう報告する。設定の誤りか、既存の型エラーか判別する) |
| `test_command` | 走る(0件でもよい。**コマンドが存在しないのは駄目**) |
| `lint_command` | 走る |
| `build_command` | 時間がかかるなら省略してよい。省略したことを言う |

走らないコマンドを config に書かない。書けば `build-verify` が毎回そこで止まる。

既存の失敗(既に赤いテスト、既存の型エラー)があれば、**件数を記録して報告する。**
これが「今回の変更で壊した分」との判別基準になる。

## Step 4: config.yaml を書く

`<PJルート>/.build-kit/config.yaml` に保存する。
雛形は `${CLAUDE_PLUGIN_ROOT}/templates/config.yaml`。

**検出できなかった項目は空にして、コメントで理由を書く。** 憶測で埋めない。

## Step 5: gitignore の提案

`report.html` は生成物。PJ の `.gitignore` に該当行が無ければ**追加を提案する**
(勝手に追記しない — 原則4):

```gitignore
# build-kit の生成物
<docs_dir>/**/report.html
```

`.build-kit/config.yaml` は**コミット対象**(PJ の設定なので共有したい)。

## Step 6: 締め

> `.build-kit/config.yaml` を作りました。
>
> | 項目 | 値 | 確認 |
> |---|---|---|
> | 成果物 | `docs/dev` | — |
> | テスト | `npm test` | ✅ 走った(42 passed) |
> | 型チェック | `npx tsc --noEmit` | ✅ exit 0 |
> | lint | `npm run lint` | ✅ exit 0 |
> | レビュー | PJ の `/check-spec` を使う | — |
> | TDD | `strict` | — |
>
> 既存の失敗: 無し
> 気づき: <列挙、無ければ「無し」>
>
> `/build-design 〜を作りたい` で始められます。

**ここで勝手に build-design を始めない。** セットアップと開発は別の用事。
