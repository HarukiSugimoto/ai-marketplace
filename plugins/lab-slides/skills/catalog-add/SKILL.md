---
name: catalog-add
description: 気に入ったスライドのレイアウトをカタログに登録して再利用可能にする。「このレイアウトをカタログに追加して」「この型を保存して」で発動。
---

# catalog-add — レイアウトの資産化

作成中のスライドで生まれた良いレイアウトを、次回以降も使える「型」として登録する。
これがこのシステムの育て方の中核。

## 手順

1. 対象スライドを特定し(ユーザー指定 or 直前に HTML 直書きしたもの)、
   スライド固有の内容を取り除いて**汎用の雛形に抽象化**する
2. **登録先をユーザーに確認**:
   - 汎用(他の研究・他の発表でも使う)→ **プラグイン層**
   - この研究プロジェクト固有(例: この PJ 専用の実験結果フォーマット)→ **プロジェクト層**
3. 登録:
   - プラグイン層: `${CLAUDE_PLUGIN_ROOT}/theme/lab.css` に CSS クラスを追記し、
     `${CLAUDE_PLUGIN_ROOT}/catalog/layouts.yaml` に id / category / when / snippet を追加
   - プロジェクト層: `.lab-slides/theme.css` と `.lab-slides/layouts.yaml` に同形式で追加
4. 登録した snippet で 1 枚のテストスライドをビルドし、崩れていないことを確認する

## CSS 追記の規約

- 色・余白・角丸は必ず `:root` のデザイントークン(`var(--c-*)`, `var(--space-*)`)を使う。
  新しい色が必要ならトークンを追加してから使う
- クラス名 = layouts.yaml の id と一致させる
- `when:` は「いつ使うか」を具体的に書く(生成時の選定はこれだけが頼り)

## プラグイン層に登録した場合の後処理

プラグインの実体は marketplace repo(`個人開発/ai-marketplace`)にある。
編集後にユーザーへ伝える: 「git commit & push すれば他のマシンにも `/plugin update lab-slides` で反映されます」
(このマシンで即時反映するにも `/plugin update lab-slides` が必要)
