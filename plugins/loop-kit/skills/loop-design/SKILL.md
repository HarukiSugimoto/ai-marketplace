---
name: loop-design
description: タスクがループエンジニアリング向きか診断し、ループプロンプト(PROMPT.md)と終了条件・安全機構(loop.yaml)を設計する。「ループで回したい」「放置で終わらせたい」「ループ設計して」で発動。
---

# loop-design — ループの適否診断と設計

ループエンジニアリングの成否は実行前に決まる。**プロンプトではなくループを設計する**:
終了条件・検証手段・安全機構を先に固め、毎回同じプロンプトを投入しても
ファイルと git 履歴だけで前進する形にタスクを整形する。

## Step 0: コンテキスト収集

1. **タスク**: ユーザーからタスクを聞く(または @ 指定の issue / 仕様ファイルを読む)
2. **PJ設定の解決**: 案件ディレクトリから上へ `.loop-kit/config.yaml` を探す。
   - **あれば**それを読み、`verify_command` / `protected_paths` / `default_mode` /
     `default_max_iterations` / `require_worktree` / `allowed_tools` を後段の既定値にする。
     `conventions_ref`(既定 CLAUDE.md)は複製せず「PROMPT.md でここを読め」と参照させる
   - **無ければ** CLAUDE.md とファイル構成(package.json / pyproject.toml / Cargo.toml 等)
     から検証手段・スタックを**検出**し、Step 3 の最後で `.loop-kit/config.yaml` の
     作成を提案する(次回以降の /loop-design が毎回検出せずに済む)
3. **CLAUDE.md は複製しない**: ループはPJ内で走るので CLAUDE.md は自動で効く。
   規約はそこに任せ、loop-kit は「ループ特有のノブ」(検証・保護パス・上限・方式)だけ扱う

## Step 1: 適否診断(★関門)

Anthropic 公式の基準で診断し、**表で見せる**:

| 観点 | 判定 | 根拠 |
|---|---|---|
| 成功条件が機械的に判定できるか | ✅/⚠️/❌ | ... |
| 自動検証(テスト/リンター/ビルド)があるか | ✅/⚠️/❌ | ... |
| 反復で良くなる性質か(テストを通す等) | ✅/⚠️/❌ | ... |
| 途中の人間の判断・設計判断が不要か | ✅/⚠️/❌ | ... |

**向かないタスク**(1つでも該当したら正直に言ってループ以外を提案する):
- 人間の判断・設計判断が途中で必要 → 普通の対話セッションで
- 成功条件が不明瞭(「いい感じにして」) → まず成功条件を決める作業から
- 一発勝負の操作(本番デプロイ、DB マイグレーション実行) → ループ厳禁
- 本番デバッグ → 対象を絞ったデバッグで

注意: 既存コードベースへの長時間放置ループは考案者 Huntley 自身が推奨していない
(2025年7月時点)。既存コードでは worktree 隔離 + 小さめの max_iterations から始める。

⚠️ が2つ以上なら「タスクの再整形」(検証コマンドの整備、成功条件の明文化、
タスク分割)を先に提案する。**ここで停止。** 診断に合意してから設計へ。

## Step 2: ループ設計

3つを決めて提示する:

1. **実行方式**(1つ選ぶ):
   - `session` — セッション内で Stop hook がループ。見ていられる規模(〜30分)、
     途中で口を挟みたいとき
   - `shell` — 別ターミナルで `run-loop.sh`(headless `claude -p` の外側ループ)。
     放置できる規模。**「完了宣言 AND 検証コマンドパス」の二重ゲート**で終了
   - `fanout` — タスクリスト×1回ずつ(`fanout.sh`)。同型作業の量産
     (マイグレーション、一括修正)。**まず2〜3項目で試してから全体へ**
   config.yaml があれば `default_mode` を初期提案にする(上書きは可)
2. **終了条件**: 完了条件チェックリスト(機械判定可能な形)+ 完了宣言フレーズ
   (既定 `COMPLETE`)+ 検証コマンド(config.yaml の `verify_command` を既定に)
3. **安全機構**: `max_iterations`(必須。完了宣言は完全一致マッチのため
   複数終了条件に使えず、上限こそが第一の安全機構。config.yaml の
   `default_max_iterations` を既定に)。config の `require_worktree: true` または
   既存コードベースなら worktree 隔離を提案。config の `protected_paths` は
   PROMPT.md の「厳守事項(触ってはいけない)」に転記する

## Step 3: 生成

`<プロジェクト>/.loop/<slug>/` に2ファイルを生成する:

- `PROMPT.md` — `${CLAUDE_PLUGIN_ROOT}/templates/PROMPT.md` の型で。核は
  「まず現状確認」「1イテレーション1タスク」「検証パスでコミット」「学びを記録」
  「完了条件が真のときだけ `<promise>` 出力」。config の `conventions_ref`(CLAUDE.md 等)を
  「規約はここを読め」と冒頭に参照させ、`protected_paths` を厳守事項に転記する
- `loop.yaml` — `${CLAUDE_PLUGIN_ROOT}/templates/loop.yaml` の型で。config.yaml の値で
  初期化する(config が無い項目だけ検出値/質問で埋める)

**config.yaml が無かった場合**: 検出したスタック・検証コマンド・保護パスを使って
`<プロジェクト>/.loop-kit/config.yaml`(`${CLAUDE_PLUGIN_ROOT}/templates/config.yaml` の型)の
作成を提案する。「次回以降 /loop-design がこのPJを毎回調べずに済む」と一言添える。

生成したら中身を見せて**停止**。ユーザーが直してから /loop-run へ。
