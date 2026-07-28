# build-kit 開発メモ(Claude 向け)

利用者向けの使い方・出典は [README.md](README.md) が持つ。ここは**この plugin を改造するとき**の
触り方だけ。repo 全体の規約は [../../CLAUDE.md](../../CLAUDE.md)。

## この plugin の正体

**成果物ではなく進め方**を型にしたもの(他の plugin はスライドや議事録という成果物を作る)。
中身は5原則 + 6段階 + レビュアー雛形2本 + 出力の型 + HTML レポート生成器。

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

### 2. 5原則は6本の SKILL.md に同一文面で重複している

意図的な重複(skill が単独で発火しても原則が効くように)。**文言を変えるときは6本すべて直す:**

```
grep -l "5原則(build-kit 共通)" plugins/build-kit/skills/*/SKILL.md   # 6 出るのが正
```

原則3の文言は特に注意。「段階の境界で必ず止まる」ではなく
**「判断がユーザーのものである境界では止まる。作業を続ける許可のためには止まらない」**。
前者に戻すと自動連鎖と矛盾する。

**原則5(出力の型)だけは実体を6本に持たせない。** 6本にあるのは要約1行 +
`templates/output-style.md` への参照だけ。7か条の本文をここに展開すると、
同期対象が6本×2ブロックになって必ず腐る(原則1〜4で既に一度踏んでいる)。

- **7か条を増減するなら `templates/output-style.md` だけを直す。** 6本は触らない
- 6本の要約1行を変えるときだけ、6本すべてを直す
- 確認: `grep -c "output-style.md" plugins/build-kit/skills/*/SKILL.md` が全部 1

原則5には**採らなかった3ルール**(脱線抑制 / 時間見積もり / リスト5項目上限)を
理由つきで記録してある。**「抜けている」と思って足さないこと** — 脱線抑制は原則4と、
リスト上限は受入条件表・指摘一覧と衝突する。

### 2.5. 依存と進捗の正は `tasks/*.md`。`plan.md` は見取り図

計画は `plan.md`(全体)+ `tasks/<NN>-<slug>.md`(1タスク1ファイル)に分かれている。
**同じ情報が2箇所にあるので、どちらが正かを固定してある:**

| 情報 | 正 | 写し |
|---|---|---|
| 依存(`Blocked by`) | `tasks/*.md` | `plan.md` の表と「着手できる順」 |
| 進捗(チェックボックス) | `tasks/*.md` | 無し(`plan.md` は持たない) |

**理由: タスクファイル1枚を単独で渡しても実装できることが分割の目的。**
そのファイルが依存について嘘をつくと分割の意味が消える。

- **`plan.md` にタスクの進捗欄を足さない。** 足した瞬間に二重管理になる
- build-run は「上から順」ではなく **`Blocked by` が全部済んだもの**から取る。
  番号は依存の浅い順に振るが、**番号は順序の保証ではない**
- 依存の書き漏らしは、番号順のときは偶然守られていた。着手順を依存で決めた以上、
  **保護は2箇所しかない** — ゲート2の依存確認と、build-run の着手前チェック
  (`使うもの` が実在するか)。**どちらも消さないこと**

確認:

```
# plan.md 側にタスクの進捗が復活していないか（何も出ないのが正）
grep -n "RED 書いた" plugins/build-kit/templates/plan.md
```

### 2.6. 受入条件 → タスク → ファイルの鎖を切らない

```
受入条件 ──→ 担当タスク ──→ 触ったファイル
 plan.md      plan.md の列      changes.md の見出し → report.json の task
              tasks/*.md
```

**この鎖は3箇所に分散していて、どこか1つを消しても他は動き続ける。** だから腐る。

- **`plan.md` の受入条件表から「担当タスク」列を消さない。** 列があることが唯一の強制で、
  build-plan Step 3 末尾の空欄チェックとゲート2の項目3は、この列を前提にしている
- **確認するのは受入条件 → タスクの片方向だけ。** 逆向き(タスク → 受入条件)を
  必須にすると prefactoring が違反になる(振る舞いを変えないので受入条件を持たない)
- **`changes.md` のタスク見出しを「ファイル一覧」に平坦化しない。**
  見出しの番号がそのまま `report.json` の `changes[].task` になる
- **`report.mjs` の task 列は、値が無いとき空欄ではなく `—` を出す。**
  空欄にすると「記録されなかった」のか「そもそも列が無い」のか区別がつかない

**空欄チェックは build-plan の中にしか無い**(機械的な検査は書けない —
plan.md は PJ 側の成果物であって、この repo には存在しないため)。
skill から消したら守りはゼロになる。

確認:

```
# 受入条件表に担当タスク列があるか（雛形と skill の両方に出るのが正）
grep -l "担当タスク" plugins/build-kit/templates/plan.md plugins/build-kit/skills/build-plan/SKILL.md

# レポート側に task が通っているか（3ファイルすべてに出るのが正）
grep -l "task" plugins/build-kit/scripts/report.mjs \
  plugins/build-kit/templates/report.example.json \
  plugins/build-kit/skills/build-report/SKILL.md
```

### 2.7. スコープ判定は6段の順序。段を入れ替えない

`build-run` Step 6 の表がスコープ判定の唯一の定義。`build-verify` Step 4 と
`build-report` の `inScope` / `autoScope` / `scope.autoAllowed` はすべてこれに従う。

```
1 protected_paths → 2 名指しの除外 → 3 範囲宣言 → 4 REDのテスト → 5 auto_scope → 6 止まる
```

- **1 が最上位。** `protected_paths` は範囲宣言でも `auto_scope` でも免除されない。
  「glob に入っているから」で通す実装にしない
- **2 が 3 に勝つ。** 面で宣言した中を名指しで除外できないと、glob 化した意味が消える
- **5 は止まらないが黙らない。** 記録を消したら原則4の違反。レポートでは
  赤い「宣言外」ではなく中立の「自動許可」に出す(`report.mjs` で分岐済み)
- **6 で「追加して続ける」を選んだら `plan.md` に追記する。**
  忘れると build-verify で再び違反扱いになり、合意した意味が消える(実際に踏んだ)

`auto_scope` に機能コードのパスを入れられる設計にはしない。
skill 側に「機能コードは入れない」と書いてあるだけで、強制はしていない —
**強制する仕組みを足すなら、config を読む側3箇所すべてに足す。**

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

### 5. Claude / Codex 両対応の前提を壊さない

Codex marketplace にも載せている（loop-kit のような Claude 専用ではない）。

- **`${CLAUDE_PLUGIN_ROOT}` はそのまま使ってよい。** Codex が後方互換で提供している
  （`PLUGIN_ROOT` に書き換える必要は無い。むしろ Claude 側が壊れる）
- **`commands/` は Claude 限定。** Codex のプラグインは skills / MCP / hooks しか束ねられず、
  カスタムプロンプトは deprecated かつプラグイン配布不可。
  **コマンドでしか起動できない機能を作らない** — skill 側だけで完結させ、
  description に日本語トリガーを入れておく
- **ハーネス固有の名前を裸で書かない。** サブエージェントは
  Claude Code = `general-purpose` / Codex = `default`。対応表で書く
- **`AskUserQuestion` を前提にしない。** 無い環境では「番号を振って1メッセージ」に落とす

確認:

```
grep -rn "general-purpose\|AskUserQuestion" plugins/build-kit/skills plugins/build-kit/templates
# → 対応表・代替手段とセットで出てくるのが正。裸で出たら NG
```

### 6. 出典表を腐らせない

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

# 6. 5原則が6本に揃っているか（どちらも 6 が正）
grep -lc "5原則(build-kit 共通)" plugins/build-kit/skills/*/SKILL.md | wc -l
grep -lc "output-style.md" plugins/build-kit/skills/*/SKILL.md | wc -l

# 7. 原則5の実体が6本に流出していないか（何も出ないのが正）
grep -rln "破ってよい条件\|送信前チェック" plugins/build-kit/skills/
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
| スコープ逸脱で毎回止まって面倒 | スコープ宣言が**ファイル単位の完全列挙**だった。実装前に全部当てるのは不可能 | 範囲を glob で宣言できるようにし、副作用ファイルは `auto_scope` で通す(v0.4.0) |
| 承認した変更がレポートで赤く出る | 「スコープに追加して続ける」を選んでも `plan.md` を更新していなかった | 選択肢1を選んだら `plan.md` に承認済みとして追記する |
