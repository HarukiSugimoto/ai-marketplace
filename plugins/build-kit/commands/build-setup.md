---
argument-hint: '[省略可]'
description: このPJ用に build-kit を設定する。検証コマンド・doc置き場・PJ固有のレビュー手段を検出して .build-kit/config.yaml に記録する。
---

build-setup skill を使って、このプロジェクト用の `.build-kit/config.yaml` を作る。 $ARGUMENTS

**事実は自分で調べる。** package.json の scripts、テスト設定、既存テストの置き場所、
規約ファイル、`.claude/commands/` と `.claude/skills/` にある**このPJ固有のレビュー手段**を
実際に読んで検出する。ユーザーに聞くのは、検出できなかったものと選択が必要なものだけ。

記録したコマンドは**実際に走らせて通ることを確認する。** 動かない設定を書き込まない。
