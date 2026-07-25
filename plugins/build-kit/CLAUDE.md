# build-kit 開発メモ(Claude 向け)

利用者向けの使い方・出典は [README.md](README.md) が持つ。ここは**この plugin を改造するとき**の
触り方だけ。repo 全体の規約は [../../CLAUDE.md](../../CLAUDE.md)。

## この plugin の正体

**成果物ではなく進め方**を型にしたもの(他の plugin はスライドや議事録という成果物を作る)。
中身は4原則 + 6段階 + レビュアー雛形2本 + HTML レポート生成器。

## 触るときの不変条件

### 1. commands は3本、skill は6本。数が合わないのは意図的

`build-setup` / `build-design` / `build-run` にだけコマンドがある。
間の段階(`build-plan` / `build-verify` / `build-report`)は、各 SKILL.md 末尾の
**「そのまま次へ続ける」指示**で連鎖する。

- **段階の切り替えでコマンドの打ち直しを要求しない。**
  原則3の言う「判断」ではなく儀式になる(一度 `/build-run` を打ち直させる設計にして直した)
- **commands を増減するなら、対応する skill の連鎖記述と README の3箇所を同時に直す。**
  README にコマンド表が残って本文と矛盾したことがある。確認:
  ```
  # /build-kit というパス自体が引っかかるので除外する
  grep -rno "/build-[a-z]*" plugins/build-kit | grep -v "/build-kit" \
    | grep -v "build-setup\|build-design\|build-run"
  ```

### 2. 4原則は6本の SKILL.md に同一文面で重複している

意図的な重複(skill が単独で発火しても原則が効くように)。**文言を変えるときは6本すべて直す:**

```
grep -l "4原則(build-kit 共通)" plugins/build-kit/skills/*/SKILL.md   # 6 出るのが正
```

原則3の文言は特に注意。「段階の境界で必ず止まる」ではなく
**「判断がユーザーのものである境界では止まる。作業を続ける許可のためには止まらない」**。
前者に戻すと自動連鎖と矛盾する。

### 3. PJ 固有のものは config.yaml に集約する

skill に PJ 前提(テストコマンド、ディレクトリ名、規約)を書き込まない。
`.build-kit/config.yaml` のキーとして持たせ、`build-setup` に検出させる。

レビュー手段も `review_skill` / `review_command` で差し替えられる
(PJ に既にレビューの仕組みがあるなら、build-kit の汎用レビュアーより正確)。

**config にキーを足したら、それを読む skill 側も必ず足す。** 宣言だけの死にキーを作らない:

```
for k in review_skill review_command lint_command known_failures; do
  echo "$k: $(grep -rl "$k" plugins/build-kit/skills/ | wc -l)"
done
```

### 4. HTML テンプレは `templates/report.html`。gitignore の例外で守られている

**リポジトリの `.gitignore` は `*.html` を除外している**(生成物を弾くため)。
テンプレはソースなので、次の1行で例外にしてある:

```gitignore
!plugins/build-kit/templates/report.html
```

- **テンプレのファイル名を変えるなら、この例外行も変える。** 変えないと静かに追跡対象外になる
- 確認: `git check-ignore plugins/build-kit/templates/report.html` が**何も出さない**のが正
- 別の .html をテンプレとして足すなら、例外行も足す

**見た目だけ変えたいなら `templates/report.html` の `<style>` だけ触ればよい**
(report.mjs を読む必要はない)。

プレースホルダは二重波かっこ。**report.mjs の `vars` に無いものがテンプレに残ると
エラーで落ちる**(黙って空にしない)。テンプレ先頭の開発者向けコメントは
生成時に剥がされるので、生成物には載らない — ただし**コメント内に
二重波かっこの実例を書かない**こと(置換対象として拾われる。一度やった)。

### 5. 出典表を腐らせない

README の「出典 — skill ごとに何を借りたか」は、**どの外部 skill の何を取り込んだかの記録**。
skill の中身を書き換えたら表も直す。★(build-kit 固有)と外部由来の区別を保つ。

## 検証

ビルド工程は無い(skill は Markdown、生成器は依存ゼロの Node スクリプト)。触ったら以下を通す:

```bash
# 1. レポート生成器が動くか(正常系)
node plugins/build-kit/scripts/report.mjs plugins/build-kit/templates/report.example.json -o /tmp/r.html

# 2. frontmatter の name とディレクトリ名が一致するか
for d in plugins/build-kit/skills/*/; do
  n=$(basename "$d"); fm=$(awk -F': ' '/^name:/{print $2; exit}' "$d/SKILL.md")
  [ "$n" = "$fm" ] || echo "MISMATCH $n != $fm"
done

# 3. 存在しないコマンドへの言及が無いか（何も出ないのが正）
grep -rno "/build-[a-z]*" plugins/build-kit | grep -v "/build-kit" \
  | grep -v "build-setup\|build-design\|build-run"

# 4. テンプレが gitignore に食われていないか（何も出ないのが正）
git check-ignore plugins/build-kit/templates/report.html

# 5. テンプレに未定義のプレースホルダが無いか（1 で落ちるのが正常系の検出）
node plugins/build-kit/scripts/report.mjs plugins/build-kit/templates/report.example.json -o /tmp/r.html
```

レポート生成器はエッジケース(未達・宣言外の変更・テスト失敗・空配列・diff あり)でも
崩れないこと。`inScope: false` が赤く出る、`⚠️` が `✅` に化けない、外部リソースを
参照しない(CSP 相当の自己完結)を確認する。

## 踏んだ穴の記録

| 症状 | 原因 | 対策 |
|---|---|---|
| README のコマンド表が本文と矛盾 | コマンドを減らしたとき README の上部の表を消し忘れた | 上記「不変条件1」の grep |
| `/build-run T3` の意味が未定義だった | 引数を受け付ける設計にしたが、部分実行の意味を決めていなかった | 部分実行そのものを廃止(受入条件は計画全体に対して定義されているので途中で検証が成立しない) |
| 原則3が自動連鎖と矛盾 | 「段階の境界で必ず止まる」と書いていた | 「判断がユーザーのものである境界」に定義し直した |
| テンプレのコメントが置換対象として拾われた | 説明文に二重波かっこの実例を書いた | 実例を書かない。バリデータ自体は正しく検出した |
| 開発者向けコメントが生成物に混入 | テンプレをそのまま流していた | report.mjs が先頭コメントを剥がす |
| 検査コマンド自体が誤検知 | `/build-` が `plugins/build-kit/` のパスに一致していた | `/build-kit` を除外する |
