# loop-kit — ループエンジニアリング支援システム

「プロンプトを書く」のではなく「エージェントを回すループを設計する」ためのプラグイン。
適否診断 → ループ設計 → 実行 → 振り返りを型化し、どのプロジェクトでも使い回す。

```
タスク ─→ /loop-design ─→ .loop/<slug>/(PROMPT.md + loop.yaml)
                │ 適否診断(★向かないタスクはここで弾く)
                ▼
          /loop-run ────┬─ session: Stop hook がセッション内でループ
                        ├─ shell:   run-loop.sh(headless claude -p の外側ループ)
                        └─ fanout:  fanout.sh(タスクリスト×1回ずつ)
                │
          /loop-review ←─ ログ・git履歴・進捗ファイル
                ▼
          PROMPT.md の改善差分 ─→ また /loop-run(ループのループ)
```

## スキル

| スキル | 役割 |
|---|---|
| `/loop-design` | 適否診断(公式基準の4観点)→ 終了条件・安全機構・方式の設計 → PROMPT.md + loop.yaml 生成 |
| `/loop-run` | 設計済みループの実行。session(Stop hook)/ shell / fanout の3方式。停止も担当 |
| `/loop-review` | Failures Are Data。失敗パターンを集計して PROMPT.md の改善差分を出す |

## 3つの実行方式

| 方式 | 仕組み | 向くケース |
|---|---|---|
| session | Stop hook がセッション終了をブロックし同一プロンプトを再投入(公式 ralph-wiggum と同方式、状態ファイルは `.claude/loop-kit.local.md`) | 見ていられる規模、途中で口を挟みたい |
| shell | `scripts/run-loop.sh` が headless `claude -p` を回す。「完了宣言 AND 検証コマンドパス」の二重ゲートで終了 | 放置したい、夜間実行 |
| fanout | `scripts/fanout.sh` がタスクリスト各行に `claude -p` を1回ずつ。OK/FAIL を results.csv に集計 | マイグレーション等の同型作業量産 |

## プロジェクトごとの最適化(.loop-kit/config.yaml)

プラグイン本体はスタック非依存の「土台」。各PJの技術スタック最適化は**現場層**に置く。

```
<プロジェクト>/
  CLAUDE.md              # 規約・スタックの詳細(Claude Code が自動で読む。loop-kit は複製しない)
  .loop-kit/config.yaml  # ループ特有のノブだけ: 検証コマンド・保護パス・既定方式/上限
  .loop/<slug>/          # 個々のループ実体(PROMPT.md + loop.yaml)。/loop-design が生成
```

`/loop-design` は上へ `.loop-kit/config.yaml` を探し、**あれば**検証コマンド・保護パス・
既定の方式/上限を loop.yaml と PROMPT.md に自動で流し込む。**無ければ** CLAUDE.md と
ファイル構成(package.json / pyproject.toml / Cargo.toml 等)からスタックを検出し、
config.yaml の作成を提案する(次回以降は毎回検出しなくて済む)。

原則: コーディング規約は CLAUDE.md に任せ、config.yaml は**複製せず参照**する
(`conventions_ref`)。二重管理を作らない。読み込みは「現場に近いほど強い」カスケード。

## 設計方針

- **適否診断が最初の関門**: 成功条件が不明瞭・人間の判断が必要・一発勝負・本番デバッグは
  ループに向かない(公式ガイド基準)。向かないタスクを回すのが最大の事故原因
- **max_iterations が第一の安全機構**: 完了宣言(completion promise)は完全一致マッチで
  複数終了条件に使えない。上限なしのループは作らない
- **二重終了ゲート**: shell モードは「Claude の完了宣言」と「検証コマンドのパス」が
  両方揃って初めて終了。嘘の完了宣言・早すぎる宣言を機械的に無効化する
- **記憶はファイルと git**: プロンプトは毎回同じ。進捗は notes.md への申し送りと
  コミット履歴で運ぶ。だから PROMPT.md は「まず現状確認」から始まる
- **1イテレーション1タスク**: ループプロンプトの最重要ルール
- 既存コードベースへの放置ループは worktree 隔離 + 小さめ上限から

## 前提・注意

- session モードは `jq` が必要(無ければ hook は安全側=ループ停止に倒れる)
- Stop hook はこのプラグインを有効にした全プロジェクトに入るが、状態ファイルが
  無ければ即 exit 0 で無害
- Claude Code 本体にも `/goal`(評価モデルによる継続判定)や公式 ralph-wiggum
  プラグインがある。使い分けは docs/research-2026-07-05.md を参照

## 出典

設計根拠は 2026-07-05 の網羅調査(28ソース・25クレームを3票検証、反証ゼロ)に基づく。
詳細と全ソースは `docs/research-2026-07-05.md`。
主要一次ソース: ghuntley.com/ralph(原型)、anthropics/claude-code の ralph-wiggum
プラグイン(Stop hook 方式)、code.claude.com/docs の headless / best-practices(公式基盤)。
