#!/usr/bin/env node
/*
 * render-marp.js — deck.json(構造化スライド)から Marp Markdown(slides.md)を生成。
 *
 * work-slides の二枚看板レンダラーのうち「高速プレビュー」側。
 * render-pptx.js と同じ deck.json を入力にするので、プレビューと本番 pptx が
 * 必ず同じ内容から生成される(唯一の真実 = deck.json)。
 *
 * 使い方: node render-marp.js <deck.json> [out.md]
 */
const fs = require("fs");
const path = require("path");

const deckPath = process.argv[2];
if (!deckPath) { console.error("usage: render-marp.js <deck.json> [out.md]"); process.exit(1); }
const deck = JSON.parse(fs.readFileSync(deckPath, "utf8"));
const outPath = process.argv[3] || deckPath.replace(/\.json$/, "") + ".md";

const esc = (t) => (t == null ? "" : String(t));
const bullets = (arr) => (arr || []).map((b) => `- ${esc(typeof b === "string" ? b : b.text)}`).join("\n");
const mdTable = (cols, rows) =>
  `| ${cols.map(esc).join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n` +
  (rows || []).map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");

const noHeader = new Set(["title", "agenda", "section"]);

function slideMd(s) {
  const cls = s.layout === "body" || s.layout === "two-col" ? null : s.layout;
  const dir = [];
  if (cls) dir.push(`<!-- _class: ${cls} -->`);
  if (!noHeader.has(s.layout) && s.header) dir.push(`<!-- header: ${esc(s.header)} -->`);
  const head = dir.join("\n");

  let body = "";
  switch (s.layout) {
    case "title":
      body = (s.to ? `<div class="to">${esc(s.to)}</div>\n\n` : "") +
        `# ${esc(s.title)}\n\n` +
        (s.subtitle ? `<div class="subtitle">${esc(s.subtitle)}</div>\n\n` : "") +
        (s.meta ? `<div class="meta">${esc(s.meta)}</div>` : "");
      break;
    case "agenda":
      body = `# ${esc(s.title || "本日の内容")}\n\n` +
        (s.items || []).map((it, i) => `${i + 1}. ${s.current === i + 1 ? `**${esc(it)}**` : esc(it)}`).join("\n");
      break;
    case "section":
      body = `# ${esc(s.title)}` + (s.no ? `\n\n<div class="no">${esc(s.no)}</div>` : "");
      break;
    case "exec-summary": {
      const pts = (s.points || []).map((p, i) =>
        `${i + 1}. ${typeof p === "string" ? esc(p) : `**${esc(p.label)}** — ${esc(p.text)}`}`).join("\n");
      body = `## ${esc(s.headline || "エグゼクティブサマリ")}\n\n` +
        `<div class="ask"><span class="k">結論</span>${esc(s.ask)}</div>\n\n${pts}`;
      break;
    }
    case "body":
      body = `## ${esc(s.headline)}\n\n${bullets(s.bullets)}`;
      break;
    case "two-col": {
      const L = s.left || {}, R = s.right || {};
      const leftCell = L.image ? `![](${esc(L.image)})` : bullets(L.bullets);
      const rightCell = R.bullets ? bullets(R.bullets) : (R.image ? `![](${esc(R.image)})` : "");
      body = `## ${esc(s.headline)}\n\n<div class="cols${s.wide ? " w64" : ""}">\n<div>\n\n${leftCell}\n\n</div>\n<div>\n\n${rightCell}\n\n</div>\n</div>`;
      break;
    }
    case "problem-solution": {
      const P = s.problem || {}, X = s.solution || {};
      body = `## ${esc(s.headline)}\n\n<div class="ps">\n<div class="box problem">\n\n### ${esc(P.title || "課題")}\n\n${bullets(P.bullets)}\n\n</div>\n<div class="arrow">➤</div>\n<div class="box solution">\n\n### ${esc(X.title || "解決策")}\n\n${bullets(X.bullets)}\n\n</div>\n</div>`;
      break;
    }
    case "compare": {
      const cols = (s.options || []).map((o) =>
        `<div class="opt${o.recommended ? " recommended" : ""}">\n\n### ${esc(o.title)}\n\n${bullets(o.bullets)}\n\n</div>`).join("\n");
      body = `## ${esc(s.headline)}\n\n<div class="opts">\n${cols}\n</div>`;
      break;
    }
    case "table":
      body = `## ${esc(s.headline)}\n\n${mdTable(s.columns || [], s.rows)}\n\n` +
        (s.note ? `<div class="note">${esc(s.note)}</div>` : "");
      break;
    case "roadmap": {
      const ph = (s.phases || []).map((p) =>
        `<div class="phase"><div class="ph-label">${esc(p.label)}</div><div class="ph-period">${esc(p.period || "")}</div>\n\n${bullets(p.items)}\n\n</div>`).join("\n");
      body = `## ${esc(s.headline)}\n\n<div class="phases">\n${ph}\n</div>`;
      break;
    }
    case "kpi":
      body = `## ${esc(s.headline)}\n\n<div class="metrics">\n` +
        (s.metrics || []).map((m) => `<div class="metric"><div class="value">${esc(m.value)}</div><div class="label">${esc(m.label)}</div></div>`).join("\n") +
        `\n</div>`;
      break;
    case "next-action":
      body = `## ${esc(s.headline || "次のアクション")}\n\n` +
        mdTable(["担当", "アクション", "期限"], (s.actions || []).map((a) => [a.who, a.what, a.when])) +
        (s.message ? `\n\n<div class="message">${esc(s.message)}</div>` : "");
      break;
    default:
      body = `## [未対応レイアウト: ${esc(s.layout)}]`;
  }
  return (head ? head + "\n\n" : "") + body;
}

const front = `---\nmarp: true\ntheme: work\npaginate: true\n---`;
const md = [front, ...deck.slides.map(slideMd)].join("\n\n---\n\n") + "\n";
fs.writeFileSync(outPath, md);
console.log("generated: " + outPath);
