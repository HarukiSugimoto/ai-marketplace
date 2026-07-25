---
argument-hint: '[作りたいものの説明]'
description: 設計から計画まで。決定木を詰めて design.md → plan.md を作り、実装の直前で止まる。
---

build-design skill を使って設計段階を始める。対象: $ARGUMENTS

**この1コマンドで design.md と plan.md の両方まで進める。**

1. 事実は自分で調べ、決定だけユーザーに聞く。frontier が空になるまで詰める
2. 案を比較して設計を提示し、`design.md` を書く
3. **■1 設計の承認**
4. 承認が出たら、**別コマンドを待たずそのまま build-plan に続ける**
5. 受入条件をテストに落とし、スコープを宣言し、`plan.md` を書く
6. **■2 計画の承認を取って止まる**

コードは書かない。実装は `/build-run` で。

`.build-kit/config.yaml` が無ければ、先に `/build-setup` を勧める。
