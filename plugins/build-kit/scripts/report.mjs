#!/usr/bin/env node
// build-kit — 変更内容の HTML レポート生成
//
//   node report.mjs <report.json> [-o <out.html>]
//
// report.json の書き方は ../templates/report.example.json を見ること。
// 見た目（CSS・骨組み・タブの JS）は ../templates/report.html にある。
// このスクリプトは断片を組み立てて {{TOKEN}} を埋めるだけ。
// 出力は依存ゼロの自己完結 HTML（白基調・タブ3枚・GitHub 風の行番号つき差分）。
// 出力はコミットしない（.gitignore が *.html を除外。テンプレだけ例外指定してある）。

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "templates", "report.html");

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
  console.error("usage: node report.mjs <report.json> [-o <out.html>]");
  process.exit(args.length === 0 ? 1 : 0);
}

const inPath = resolve(args[0]);
const oIdx = args.indexOf("-o");
const outPath = oIdx !== -1 && args[oIdx + 1]
  ? resolve(args[oIdx + 1])
  : join(dirname(inPath), "report.html");

let data;
try {
  data = JSON.parse(readFileSync(inPath, "utf8"));
} catch (e) {
  console.error(`report.json を読めない: ${inPath}\n${e.message}`);
  process.exit(1);
}

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const VERDICT = {
  "完成": { cls: "ok", note: "受入条件を全て証拠付きで満たした" },
  "条件付き": { cls: "warn", note: "証拠を取れていない項目が残っている" },
  "未完": { cls: "bad", note: "満たせていない受入条件がある" },
};
const STATUS = {
  pass: { cls: "ok", label: "達成" },
  warn: { cls: "warn", label: "未確認" },
  fail: { cls: "bad", label: "未達" },
};
const KIND = { added: "新規", modified: "変更", deleted: "削除", renamed: "改名" };

const {
  title = "(無題)", slug = "", date = "", verdict = "条件付き", summary = "",
  links = {}, acceptance = [], tasks = [], changes = [], checks = [],
  notes = [], leftovers = [], scope = {}, diff = "",
} = data;

const v = VERDICT[verdict] ?? VERDICT["条件付き"];
const tally = (k) => acceptance.filter((a) => a.status === k).length;

// ── unified diff のパース ───────────────────────────────
// git diff の生出力から、ファイルごとのハンクと「旧側/新側の行番号」を復元する。
// ハンクヘッダ @@ -oldStart,oldCount +newStart,newCount @@ が起点。
function parseDiff(text) {
  const files = [];
  let f = null, h = null;
  // 末尾の改行が生む空要素を落とす（残すと空のコンテキスト行が1行増える）
  const lines = String(text).split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  for (const l of lines) {
    const gm = l.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gm) {
      f = { path: gm[2], from: gm[1], kind: "modified", binary: false, hunks: [], add: 0, del: 0 };
      files.push(f); h = null; continue;
    }
    if (!f) continue;
    if (l.startsWith("new file mode")) { f.kind = "added"; continue; }
    if (l.startsWith("deleted file mode")) { f.kind = "deleted"; continue; }
    if (l.startsWith("rename to ")) { f.kind = "renamed"; f.path = l.slice(10); continue; }
    if (l.startsWith("Binary files")) { f.binary = true; continue; }
    if (l.startsWith("--- ") || l.startsWith("+++ ") || l.startsWith("index ")) continue;

    const hm = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/);
    if (hm) {
      h = { header: hm[3], o: +hm[1], n: +hm[2], rows: [] };
      f.hunks.push(h); continue;
    }
    if (!h) continue;

    const c = l[0];
    if (c === "+") { h.rows.push({ t: "add", o: null, n: h.n++, s: l.slice(1) }); f.add++; }
    else if (c === "-") { h.rows.push({ t: "del", o: h.o++, n: null, s: l.slice(1) }); f.del++; }
    else if (c === "\\") { h.rows.push({ t: "meta", o: null, n: null, s: l }); }
    else { h.rows.push({ t: "ctx", o: h.o++, n: h.n++, s: l.slice(1) }); }
  }
  return files;
}

const diffFiles = diff ? parseDiff(diff) : [];
const diffAdd = diffFiles.reduce((a, f) => a + f.add, 0);
const diffDel = diffFiles.reduce((a, f) => a + f.del, 0);

// ── 部品 ───────────────────────────────────────────────
const list = (items, empty) => items.length
  ? `<ul class="notes">${items.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
  : `<p class="empty">${esc(empty)}</p>`;

const block = (heading, body, sub) => body
  ? `<section><h2>${esc(heading)}</h2>${sub ? `<p class="lead">${esc(sub)}</p>` : ""}${body}</section>`
  : "";

// ── タブ1: 計画 ────────────────────────────────────────
const tasksList = tasks.length ? `
<ul class="tasks">${tasks.map((t) => `
  <li class="${t.done ? "done" : "todo"}">
    <span class="tick">${t.done ? "✓" : "○"}</span>
    <div>
      <div class="t-name"><span class="mono small dim">${esc(t.id ?? "")}</span> ${esc(t.name)}</div>
      ${t.red ? `<div class="t-sub">RED: <span class="mono small">${esc(t.red)}</span></div>` : ""}
      ${t.note ? `<div class="t-sub">${esc(t.note)}</div>` : ""}
    </div>
  </li>`).join("")}</ul>` : "";

const declaredList = scope.declared?.length
  ? `<ul class="files">${scope.declared.map((s) => `<li class="mono small">${esc(s)}</li>`).join("")}</ul>`
  : "";

const criteriaOnly = acceptance.length ? `
<ol class="criteria">${acceptance.map((a) => `<li>${esc(a.criterion)}</li>`).join("")}</ol>` : "";

const planTab = [
  block("受入条件（計画時に決めたもの）", criteriaOnly,
    "実装前に固定した合格基準。証拠付きの判定は「総評」タブ。"),
  block("タスク", tasksList),
  block("スコープ宣言", declaredList, "この計画で触ると宣言したファイル。"),
].join("") || `<p class="empty">計画の情報がありません。</p>`;

// ── タブ2: 変更 ────────────────────────────────────────
// task 列は changes.md のタスク見出しの番号。「受入条件 → 担当タスク → ファイル」の
// 鎖の最後の一節にあたるので、記録が無いときは空欄にせず「—」を出して欠落だと分かるようにする。
const changesTable = changes.length ? `
<div class="scroll"><table>
  <thead><tr><th>ファイル</th><th style="width:5rem">種別</th><th style="width:5rem">タスク</th><th>なぜ変えたか</th></tr></thead>
  <tbody>${changes.map((c) => `<tr${c.inScope === false && !c.autoScope ? ' class="flag"' : ""}>
    <td class="mono small">${esc(c.path)}${
      c.autoScope ? ' <span class="pill neutral">自動許可</span>'
      : c.inScope === false ? ' <span class="pill bad">宣言外</span>' : ""}</td>
    <td class="small">${esc(KIND[c.kind] ?? c.kind ?? "")}</td>
    <td class="mono small">${esc(c.task) || '<span class="empty">—</span>'}</td>
    <td>${esc(c.why) || '<span class="empty">理由の記録なし</span>'}</td>
  </tr>`).join("")}</tbody>
</table></div>` : "";

const diffBlocks = diffFiles.length ? diffFiles.map((f) => `
<details class="file" open>
  <summary>
    <span class="mono fname">${esc(f.path)}</span>
    <span class="pill ${f.kind === "added" ? "ok" : f.kind === "deleted" ? "bad" : "neutral"}">${esc(KIND[f.kind] ?? f.kind)}</span>
    <span class="stat"><span class="a">+${f.add}</span> <span class="d">−${f.del}</span></span>
  </summary>
  ${f.binary ? '<p class="empty pad">バイナリファイル</p>' : f.hunks.map((h) => `
  <table class="diff">
    <tbody>
      <tr class="hunk"><td class="ln"></td><td class="ln"></td><td class="code">@@ -${h.o} +${h.n} @@ ${esc(h.header)}</td></tr>
      ${h.rows.map((r) => `<tr class="${r.t}">
        <td class="ln">${r.o ?? ""}</td>
        <td class="ln">${r.n ?? ""}</td>
        <td class="code"><span class="sign">${r.t === "add" ? "+" : r.t === "del" ? "-" : " "}</span>${esc(r.s)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`).join("")}
</details>`).join("") : "";

const changeTab = [
  changes.length || diffFiles.length
    ? `<p class="lead">変更 ${changes.length || diffFiles.length} ファイル${diffFiles.length ? ` · <span class="a">+${diffAdd}</span> <span class="d">−${diffDel}</span>` : ""}</p>`
    : "",
  block("なぜ変えたか", changesTable),
  block("差分", diffBlocks, diffFiles.length ? "行番号は左が変更前、右が変更後。" : ""),
].join("") || `<p class="empty">変更の記録がありません。</p>`;

// ── タブ3: 総評 ────────────────────────────────────────
const acceptanceTable = acceptance.length ? `
<div class="scroll"><table>
  <thead><tr><th style="width:2.5rem">#</th><th>受入条件</th><th style="width:5.5rem">判定</th><th>証拠</th></tr></thead>
  <tbody>${acceptance.map((a, i) => {
    const s = STATUS[a.status] ?? STATUS.warn;
    return `<tr>
      <td class="num">${esc(a.n ?? i + 1)}</td>
      <td>${esc(a.criterion)}</td>
      <td><span class="pill ${s.cls}">${s.label}</span></td>
      <td class="mono small">${esc(a.evidence) || '<span class="empty">—</span>'}</td>
    </tr>`;
  }).join("")}</tbody>
</table></div>` : "";

const checksBlocks = checks.length ? checks.map((c) => `
<details class="check" ${c.exit === 0 ? "" : "open"}>
  <summary>
    <span class="pill ${c.exit === 0 ? "ok" : "bad"}">exit ${esc(c.exit)}</span>
    <strong>${esc(c.name)}</strong>
    <code class="mono small">${esc(c.command)}</code>
    ${c.summary ? `<span class="dim small">${esc(c.summary)}</span>` : ""}
  </summary>
  ${c.output ? `<pre class="out">${esc(c.output)}</pre>` : '<p class="empty pad">出力の記録なし</p>'}
</details>`).join("") : "";

const autoAllowedBlock = scope.autoAllowed?.length
  ? `<p class="small dim">auto_scope による自動許可が ${scope.autoAllowed.length} 件（違反ではない）</p>
     <ul class="files">${scope.autoAllowed.map((s) => `<li class="mono small">${esc(s)}</li>`).join("")}</ul>`
  : "";

const scopeBlock = (scope.declared?.length || scope.unexpected?.length || scope.autoAllowed?.length) ? (
  (scope.unexpected?.length
    ? `<p class="bad-text"><strong>宣言外の変更が ${scope.unexpected.length} 件あります（原則1の違反）</strong></p>
       <ul class="files bad-list">${scope.unexpected.map((s) => `<li class="mono small">${esc(s)}</li>`).join("")}</ul>`
    : `<p class="ok-text">宣言どおり。宣言外に変わったファイルはありません。</p>`) + autoAllowedBlock
) : "";

const verdictTab = [
  `<div class="verdict">
     <span class="pill ${v.cls} lg">${esc(verdict)}</span>
     <span class="vnote">${esc(v.note)}</span>
   </div>`,
  summary ? `<p class="summary">${esc(summary)}</p>` : "",
  block("受入条件と証拠", acceptanceTable),
  block("実行した検証", checksBlocks),
  block("スコープの照合", scopeBlock),
  block("気づき", list(notes, "無し"), "頼まれていないが目に入ったもの。実行はしていない。"),
  block("積み残し", list(leftovers, "無し")),
].join("");

const linkBar = (links.design || links.plan) ? `<nav class="links">
  ${links.design ? `<a href="${esc(links.design)}">設計メモ</a>` : ""}
  ${links.plan ? `<a href="${esc(links.plan)}">実装計画</a>` : ""}
</nav>` : "";

// ── テンプレートに流し込む ────────────────────────────
let tpl;
try {
  tpl = readFileSync(TEMPLATE, "utf8");
} catch (e) {
  console.error(`テンプレートを読めない: ${TEMPLATE}\n${e.message}`);
  process.exit(1);
}

// 先頭の開発者向けコメントは生成物に載せない（テンプレを編集する人のためのもの）
tpl = tpl.replace(/^(<!doctype html>\s*)<!--[\s\S]*?-->\s*/i, "$1");

const vars = {
  TITLE: esc(title),
  META: [date, slug].filter(Boolean).map(esc).join(" · "),
  VERDICT: esc(verdict),
  VERDICT_CLASS: v.cls,
  TALLIES: `受入条件 ${acceptance.length} 件 — 達成 ${tally("pass")} / 未確認 ${tally("warn")} / 未達 ${tally("fail")}`,
  LINKS: linkBar,
  BADGE_PLAN: String(tasks.length || acceptance.length),
  BADGE_CHANGE: String(changes.length || diffFiles.length),
  PANEL_PLAN: planTab,
  PANEL_CHANGE: changeTab,
  PANEL_VERDICT: verdictTab,
  DATE: esc(date),
};

// 置換は関数で行う（値に $& や $1 が含まれても壊さないため）。
// テンプレに未定義のトークンが残っていたら、黙って空にせずエラーで落とす。
const missing = [];
const html = tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (!(k in vars)) { missing.push(k); return m; }
  return vars[k];
});
if (missing.length) {
  console.error(`テンプレートに未定義のトークンがある: ${[...new Set(missing)].join(", ")}`);
  console.error(`${TEMPLATE} と report.mjs の vars を合わせること。`);
  process.exit(1);
}

writeFileSync(outPath, html, "utf8");
console.log(outPath);
