# companies/ — 会社テンプレパック

会社(職場)ごとの体裁一式。**転職・副業のたびにパックを1つ足すだけ**で、
エンジン・カタログ・文書テンプレはそのまま使い回せる。前職のパックも資産として残る。

```
companies/<会社id>/
├── tokens.json   # 配色・書体の上書き(共通 theme/tokens.json に深マージ)+ assets.logo
├── theme.css     # CSS でしか表現できない微調整(任意)
├── rules.yaml    # 体裁規定・禁則(validator が参照)
└── assets/       # ロゴ・カバー画像
```

## 新しい会社を追加する

```bash
scripts/promote.sh company <会社id>     # _example を複製して雛形を作る
```

その後 `tokens.json`(配色)と `rules.yaml`(規定)を会社に合わせて編集し、
**職場ディレクトリ**の `.work-slides/workspace.yaml` に1行書けば有効化:

```yaml
company: <会社id>
```

以後、その職場ディレクトリ配下で作る全スライド(HTML/pptx 両方)に会社の体裁が効く。
どの会社パックを使うかは deck の場所から自動解決されるので、案件側の設定は不要。

## 注意

- この repo は **private 前提**(会社のロゴ・規定を含むため)。公開しないこと
- 会社の規定で社外持ち出しが厳しい場合は、その会社のディレクトリだけ
  `.gitignore` に足してローカル管理にする
- `_example/` は雛形なので削除しない
