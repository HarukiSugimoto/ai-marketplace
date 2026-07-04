# ai-marketplace

自分専用の Claude Code プラグイン marketplace。
作った道具(skill / agent / hook)は全部ここに載せ、新しいマシンでも2コマンドで復元する。

## セットアップ

Claude Code 内で:

```
# このマシンに repo がある場合
/plugin marketplace add /Users/harusugi/Desktop/個人開発/ai-marketplace

# 新しいマシン(GitHub に push 済みなら)
/plugin marketplace add <GitHubのURL or owner/ai-marketplace>

# プラグインを入れる
/plugin install lab-slides@ai-marketplace
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

## 設計方針: 2層カスタマイズ

**資産は層で分ける。** 全マシン・全プロジェクトで共有したいものはこの repo に、
プロジェクト固有のものは各プロジェクトのディレクトリに置く。

```
【プラグイン層】= この repo(git 管理、全環境共有)
  デザイントークン / レイアウトカタログ / 発表テンプレ / skill 本体
  → 育てたら git push、各マシンは /plugin update で追従

【プロジェクト層】= 各研究プロジェクト内の .lab-slides/
  figures/(図の資産 + 索引)/ outline 履歴 / テーマ・テンプレの上書き
  → その研究のリポジトリと一緒に管理され、プラグイン更新の影響を受けない
```

読み込み優先度は プロジェクト層 > プラグイン層(git config や CSS と同じカスケード)。

## プラグインを育てるサイクル

1. 使っていて「この型いいな」と思ったら `/catalog-add`(汎用ならプラグイン層、PJ 固有ならプロジェクト層へ)
2. この repo に commit & push
3. 他のマシンでは `/plugin update lab-slides`

## 関連リポジトリ

- [agent-kit](../agent-kit/) — 他人の良い skill を借りてくる側(APM プロファイル)。この repo は自作を配る側で、役割が対。
