# ai-marketplace

自分専用の Claude Code プラグイン marketplace。
作った道具(skill / agent / hook)は全部ここに載せ、新しいマシンでも2コマンドで復元する。

> **この repo は private 前提。** work-slides の `companies/` に会社の配色・ロゴ・体裁規定を
> 含むため、公開リポジトリにしないこと。

## セットアップ

Claude Code 内で:

```
# このマシンに repo がある場合
/plugin marketplace add /Users/harusugi/Desktop/個人開発/ai-marketplace

# 新しいマシン(GitHub に push 済みなら)
/plugin marketplace add <GitHubのURL or owner/ai-marketplace>

# プラグインを入れる
/plugin install lab-slides@ai-marketplace
/plugin install work-slides@ai-marketplace
```

インストール後、各プラグインの skill(`/slide-new` 等)がそのまま使える。
使い方は各プラグインの README を参照。

## 日常の運用

| したいこと | やること |
|---|---|
| プラグインを編集した | この repo を編集 → commit & push → `/plugin update <名前>` |
| 他マシンに反映 | そのマシンで `/plugin update <名前>` |
| 新しいプラグインを足す | `plugins/<名前>/` を作り `.claude-plugin/plugin.json` を置く → `marketplace.json` の `plugins` に1エントリ追加 |
| 入っているものの確認 | `/plugin` で一覧 |

注意: `/plugin install` は repo の内容を `~/.claude/plugins/cache/` にコピーする。
**この repo を直接編集しても、`/plugin update` するまで動作には反映されない。**

## 収録プラグイン

| プラグイン | 内容 |
|---|---|
| [lab-slides](plugins/lab-slides/) | 研究発表スライド生成(進捗報告・学会/修論)。Marp + デザインシステム |
| [work-slides](plugins/work-slides/) | ビジネススライド生成(提案書・報告書・定例)。結論ファースト構成・会社テンプレパック(転職対応)・編集可能pptx |
| [paper-lab](plugins/paper-lab/) | 論文調査・原稿作成。論文ノート蓄積 → 関連研究章・章ドラフト・査読者視点レビューへ蒸留 |
| [pm-kit](plugins/pm-kit/) | 議事録・意思決定ログ。雑メモ→議事録+ToDo、ADR風の決定記録、未消化アイテムからアジェンダ起案 |

スライド2つは同型のエンジン(deck.json → HTML プレビュー + 編集可能pptx の二枚看板)を持つが、
プラグインは自己完結が原則(キャッシュに単体コピーされる)なので共有ライブラリ化はせず、
それぞれの中に持つ。テーマ・レイアウト・話法は完全に別物として育てる。

paper-lab / pm-kit は「**蓄積 → 蒸留**」型(日々ログを貯め、定期的に上位文書へまとめる)。
paper-lab のノートは lab-slides の進捗報告・修論の素材になり、
pm-kit の議事録は work-slides の定例資料に接続する。

## 設計方針: 資産は層で分ける

全マシン・全プロジェクトで共有したいものはこの repo に、
現場固有のものは現場のディレクトリに置く。読み込み優先度は「現場に近いほど強い」
(git config や CSS と同じカスケード)。

```
【プラグイン層】= この repo(git 管理、全環境共有)
  デザイントークン / レイアウトカタログ / テンプレ / skill 本体
  → 育てたら git push、各マシンは /plugin update で追従

【中間層(work-slides / pm-kit)】= companies/<会社id>/(この repo 内)
  会社ごとの配色・ロゴ・体裁規定・文書文化。転職したらパックを1つ足すだけ
  → 職場ディレクトリの .work-slides/ / .pm-kit/ の workspace.yaml が「どの会社か」を宣言

【現場層】= 各プロジェクト内の .lab-slides/ .paper-lab/ / 職場の .work-slides/ .pm-kit/
  図の資産・outline 履歴・論文ノート・議事録・decision の中身
  → 現場のリポジトリと一緒に管理され、プラグイン更新の影響を受けない
```

## プラグインを育てるサイクル

1. 使っていて「この型いいな」と思ったら `/catalog-add`(汎用ならプラグイン層、現場固有なら会社層・現場層へ)
2. この repo に commit & push(各プラグインの `promote.sh commit` が代行)
3. 他のマシンでは `/plugin update <プラグイン名>`

work-slides は転職時に `/company-add` で会社パックを追加する(テンプレ pptx があれば配色を自動取り込み)。

## 関連リポジトリ

- [agent-kit](../agent-kit/) — 他人の良い skill を借りてくる側(APM プロファイル)。この repo は自作を配る側で、役割が対。
