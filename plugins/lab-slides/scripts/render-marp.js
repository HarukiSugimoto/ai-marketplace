#!/usr/bin/env node
/*
 * render-marp.js — deck.json(構造化スライド)から Marp Markdown(slides.md)を生成。
 *
 * lab-slides の二枚看板レンダラーのうち「高速プレビュー」側。
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

const noHeader = new Set(["title", "toc", "section"]);

function slideMd(s, idx) {
  const cls = s.layout === "plain" || s.layout === "two-col" ? null : s.layout;
  const dir = [];
  if (cls) dir.push(`<!-- _class: ${cls} -->`);
  // Marp の header は持続指定。noHeader レイアウトでは _header を空にして
  // そのスライドだけ前章の header を消す(次の本文スライドが自分の header を再設定)。
  if (noHeader.has(s.layout)) dir.push(`<!-- _header: '' -->`);
  else if (s.header) dir.push(`<!-- header: ${esc(s.header)} -->`);
  const head = dir.join("\n");

  let body = "";
  switch (s.layout) {
    case "title":
      body = `# ${esc(s.title)}\n\n<div class="meta">${esc(s.meta)}</div>`;
      break;
    case "toc":
      body = `# ${esc(s.title || "目次")}\n\n` +
        (s.items || []).map((it, i) => `${i + 1}. ${s.current === i + 1 ? `**${esc(it)}**` : esc(it)}`).join("\n");
      break;
    case "section":
      body = `# ${esc(s.title)}`;
      break;
    case "plain":
      body = `## ${esc(s.headline)}\n\n${bullets(s.bullets)}`;
      break;
    case "two-col": {
      const L = s.left || {}, R = s.right || {};
      const leftCell = L.image ? `![](${esc(L.image)})` : bullets(L.bullets);
      const rightCell = R.bullets ? bullets(R.bullets) : (R.image ? `![](${esc(R.image)})` : "");
      body = `## ${esc(s.headline)}\n\n<div class="cols${s.wide ? " w64" : ""}">\n<div>\n\n${leftCell}\n\n</div>\n<div>\n\n${rightCell}\n\n</div>\n</div>`;
      break;
    }
    case "compare": {
      const b = s.baseline || {}, p = s.proposed || {};
      body = `## ${esc(s.headline)}\n\n<div class="cols">\n<div class="col baseline">\n\n### ${esc(b.title)}\n\n${bullets(b.bullets)}\n\n</div>\n<div class="col proposed">\n\n### ${esc(p.title)}\n\n${bullets(p.bullets)}\n\n</div>\n</div>`;
      break;
    }
    case "figure-full":
      body = `## ${esc(s.headline)}\n\n![](${esc(s.image)})\n\n` + (s.caption ? `<div class="caption">${esc(s.caption)}</div>` : "");
      break;
    case "metrics":
      body = `## ${esc(s.headline)}\n\n<div class="metrics">\n` +
        (s.metrics || []).map((m) => `<div class="metric"><div class="value">${esc(m.value)}</div><div class="label">${esc(m.label)}</div></div>`).join("\n") +
        `\n</div>`;
      break;
    case "table": {
      const cols = s.columns || [];
      const hot = new Set(s.highlight || []);
      const head = `| ${cols.map(esc).join(" | ")} |`;
      const sep = `| ${cols.map(() => "---").join(" | ")} |`;
      const rowLines = (s.rows || []).map((r, ri) => {
        const cells = (Array.isArray(r) ? r : [r]).map(esc);
        return `| ${cells.map((c) => (hot.has(ri) ? `**${c}**` : c)).join(" | ")} |`;
      }).join("\n");
      body = `## ${esc(s.headline)}\n\n${head}\n${sep}\n${rowLines}` +
        (s.note ? `\n\n<div class="note">${esc(s.note)}</div>` : "");
      break;
    }
    case "discussion":
      body = `# ${esc(s.title || "議論したいこと")}\n\n` + (s.items || []).map((it, i) => `${i + 1}. ${esc(it)}`).join("\n");
      break;
    case "takeaway":
      body = `## ${esc(s.headline || "まとめ")}\n\n${bullets(s.bullets)}\n\n` + (s.message ? `<div class="takeaway">${esc(s.message)}</div>` : "");
      break;
    default:
      body = `## [未対応レイアウト: ${esc(s.layout)}]`;
  }
  return (head ? head + "\n\n" : "") + body;
}

const front = `---\nmarp: true\ntheme: lab\npaginate: true\n---`;
// フロントマター直後に最初のスライドを置く(区切り --- は slide 間だけに入れる)。
// [front, ...] を "---" で join すると front と slide1 の間にも --- が入り空スラができる。
const md = front + "\n\n" + deck.slides.map(slideMd).join("\n\n---\n\n") + "\n";
fs.writeFileSync(outPath, md);
console.log("generated: " + outPath);
