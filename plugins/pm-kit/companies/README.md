# companies/ — pm-kit 会社パック

会社ごとの文書文化(文体・敬称・機密表示・共有先)を `companies/<会社id>/rules.yaml` に
閉じ込める。スキル・テンプレは全社共通なので、**転職してもパックを足すだけ**。

## 使い方

1. `companies/_example/` を `companies/<会社id>/` にコピーして rules.yaml を書き換える
2. 職場ディレクトリのルートに紐付けを置く:
   ```yaml
   # <職場ディレクトリ>/.pm-kit/workspace.yaml
   company: <会社id>
   ```
3. 以降、その職場配下で /pm-minutes 等を使うと自動でパックが適用される

## 注意

- この repo は private 前提だが、会社の規定が厳しい場合はそのパックだけ
  `.gitignore` に足してローカル管理にする(work-slides と同じ運用)
- 議事録・decision の**中身**はプラグインに置かない。中身は案件ディレクトリ側に貯まる
