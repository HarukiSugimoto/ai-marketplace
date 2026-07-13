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

// スライド幾何は tokens.json が真実(pptx 側と同じ領域アスペクトで SVG を描くため)。
// 色は CSS 変数(--c-*)経由で参照するので、ここでは色トークンは読まない。
const S = JSON.parse(fs.readFileSync(path.join(__dirname, "../theme/tokens.json"), "utf8")).slide;

const esc = (t) => (t == null ? "" : String(t));
// SVG/HTML テキスト用のエスケープ(< & > がマークアップを壊さないように)
const he = (t) => esc(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bullets = (arr) => (arr || []).map((b) => `- ${esc(typeof b === "string" ? b : b.text)}`).join("\n");

// flow レイアウト: deck.json のノード/エッジ/グループ/ラベルをインライン SVG に描く。
// render-pptx.js の flow レシピと同じ正規化座標→領域写像・同じ variant 色(CSS変数)を使い、
// プレビュー(HTML)と本番(pptx)の見た目を一致させる。
function flowSvg(s) {
  const noteH = s.note ? 0.45 : 0;
  const BY = S.top + 1.25;                        // 見出し下(pptx の addHeadline と一致)
  const regionH = S.h - BY - 0.5 - noteH;         // 描画領域の高さ(インチ)
  const CW = S.w - S.margin * 2;                  // 描画領域の幅(インチ)
  const VW = 1000, VH = Math.max(1, Math.round(VW * regionH / CW));   // viewBox(領域アスペクト保持)
  const AX = (v) => +(v * VW).toFixed(1);
  const AY = (v) => +(v * VH).toFixed(1);

  const VSTYLE = {
    neutral: "fill:var(--c-white);stroke:var(--c-line)",
    frozen:  "fill:var(--c-panel);stroke:var(--c-muted)",
    accent:  "fill:var(--c-accent-soft);stroke:var(--c-accent)",
  };
  const TITLECOLOR = { neutral: "var(--c-text)", frozen: "var(--c-text)", accent: "var(--c-accent)" };
  const LABELCOLOR = { neutral: "var(--c-line)", frozen: "var(--c-muted)", accent: "var(--c-accent)" };

  const nodes = s.nodes || [];
  const byId = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  const box = (n) => ({ x: n.x * VW, y: n.y * VH, w: n.w * VW, h: n.h * VH });
  const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const anchor = (b, side) => {
    const c = center(b);
    if (side === "top") return { x: c.x, y: b.y };
    if (side === "bottom") return { x: c.x, y: b.y + b.h };
    if (side === "left") return { x: b.x, y: c.y };
    if (side === "right") return { x: b.x + b.w, y: c.y };
    return c;
  };
  const autoSides = (ba, bb) => {
    const ca = center(ba), cb = center(bb);
    const dx = cb.x - ca.x, dy = cb.y - ca.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  };

  const parts = [];

  // グループ囲み枠
  (s.groups || []).forEach((g) => {
    const st = VSTYLE[g.variant] || VSTYLE.frozen;
    parts.push(`<rect x="${AX(g.x)}" y="${AY(g.y)}" width="${AX(g.w)}" height="${AY(g.h)}" rx="12" style="${st};fill-opacity:.4;stroke-width:1.5;stroke-dasharray:7 5"/>`);
    if (g.label) parts.push(`<text x="${AX(g.x) + 12}" y="${AY(g.y) + 24}" style="fill:${LABELCOLOR[g.variant] || "var(--c-muted)"};font-size:17px;font-weight:700;letter-spacing:.04em">${he(g.label)}</text>`);
  });

  // エッジ
  (s.edges || []).forEach((e) => {
    const na = byId[e.from], nb = byId[e.to];
    if (!na || !nb) return;
    const ba = box(na), bb = box(nb);
    let sideA = e.fromSide, sideB = e.toSide;
    if (!sideA || sideA === "auto" || !sideB || sideB === "auto") {
      const [sa, sb] = autoSides(ba, bb);
      if (!sideA || sideA === "auto") sideA = sa;
      if (!sideB || sideB === "auto") sideB = sb;
    }
    const start = anchor(ba, sideA), end = anchor(bb, sideB);
    let pts;
    if (Array.isArray(e.waypoints) && e.waypoints.length) {
      pts = [start, ...e.waypoints.map((w) => ({ x: w.x * VW, y: w.y * VH })), end];
    } else {
      const horiz = sideA === "left" || sideA === "right";
      pts = horiz
        ? [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end]
        : [start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end];
    }
    const dashArr = e.style === "dashed" ? "stroke-dasharray:8 6;" : e.style === "dotted" ? "stroke-dasharray:2 6;" : "";
    const arrow = e.arrow || "end";
    const mEnd = arrow === "end" || arrow === "both" ? ` marker-end="url(#flowArrowE)"` : "";
    const mBeg = arrow === "begin" || arrow === "both" ? ` marker-start="url(#flowArrowB)"` : "";
    const poly = pts.map((p) => `${+p.x.toFixed(1)},${+p.y.toFixed(1)}`).join(" ");
    parts.push(`<polyline points="${poly}" fill="none" style="stroke:var(--c-muted);stroke-width:2;${dashArr}"${mEnd}${mBeg}/>`);
    if (e.label) {
      const mid = pts[Math.floor((pts.length - 1) / 2)];
      const w = he(e.label).length * 8 + 10;
      parts.push(`<rect x="${(mid.x - w / 2).toFixed(1)}" y="${(mid.y - 12).toFixed(1)}" width="${w}" height="22" style="fill:var(--c-bg)"/>`);
      parts.push(`<text x="${mid.x.toFixed(1)}" y="${(mid.y + 4).toFixed(1)}" text-anchor="middle" style="fill:var(--c-muted);font-size:14px">${he(e.label)}</text>`);
    }
  });

  // ノード
  nodes.forEach((n) => {
    const b = box(n);
    const c = center(b);
    const v = VSTYLE[n.variant] || VSTYLE.neutral;
    const shape = n.shape || "roundRect";
    if (shape === "ellipse") {
      parts.push(`<ellipse cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" rx="${(b.w / 2).toFixed(1)}" ry="${(b.h / 2).toFixed(1)}" style="${v};stroke-width:1.5"/>`);
    } else if (shape === "diamond") {
      const pts = `${c.x},${b.y} ${b.x + b.w},${c.y} ${c.x},${b.y + b.h} ${b.x},${c.y}`;
      parts.push(`<polygon points="${pts}" style="${v};stroke-width:1.5"/>`);
    } else {
      const rx = shape === "rect" ? 0 : 10;
      parts.push(`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="${rx}" style="${v};stroke-width:1.5"/>`);
    }
    const rows = [];
    if (n.title) rows.push({ t: n.title, title: true });
    (n.lines || []).forEach((l) => rows.push({ t: l, title: false }));
    if (rows.length) {
      const lh = 19, startY = c.y - (rows.length - 1) * lh / 2 + 5;
      const tspans = rows.map((r, i) =>
        `<tspan x="${c.x.toFixed(1)}"${i === 0 ? ` y="${startY.toFixed(1)}"` : ` dy="${lh}"`} style="${r.title ? `font-weight:700;font-size:15px;fill:${TITLECOLOR[n.variant] || "var(--c-text)"}` : "font-size:12.5px;fill:var(--c-text)"}">${he(r.t)}</tspan>`
      ).join("");
      parts.push(`<text text-anchor="middle">${tspans}</text>`);
    }
  });

  // 自由ラベル
  (s.labels || []).forEach((l) => {
    const b = box({ x: l.x, y: l.y, w: l.w || 0.3, h: l.h || 0.08 });
    const c = center(b);
    const color = l.variant === "accent" ? "var(--c-accent)" : l.variant === "muted" ? "var(--c-muted)" : "var(--c-text)";
    const anchorAttr = l.align === "left" ? "start" : l.align === "right" ? "end" : "middle";
    const tx = l.align === "left" ? b.x : l.align === "right" ? b.x + b.w : c.x;
    parts.push(`<text x="${tx.toFixed(1)}" y="${(c.y + 5).toFixed(1)}" text-anchor="${anchorAttr}" style="fill:${color};font-size:${(l.size || 12) + 2}px;${l.bold ? "font-weight:700;" : ""}${l.serif ? "font-family:var(--font-serif);" : ""}">${he(l.text)}</text>`);
  });

  const defs = `<defs>` +
    `<marker id="flowArrowE" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" style="fill:var(--c-muted)"/></marker>` +
    `<marker id="flowArrowB" markerWidth="9" markerHeight="9" refX="1" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" style="fill:var(--c-muted)"/></marker>` +
    `</defs>`;
  return `<svg class="flow-svg" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg">${defs}${parts.join("")}</svg>`;
}

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
    case "flow":
      body = `## ${esc(s.headline)}\n\n${flowSvg(s)}` + (s.note ? `\n\n<div class="flow-note">${esc(s.note)}</div>` : "");
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
