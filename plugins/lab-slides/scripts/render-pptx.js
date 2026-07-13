#!/usr/bin/env node
/*
 * render-pptx.js — deck.json(構造化スライド)から編集可能な .pptx を生成する。
 *
 * lab-slides の二枚看板レンダラーのうち「本番 pptx」側。
 * カタログの各レイアウトを PptxGenJS の図形+テキストで組む(= 図形レシピ)。
 * LibreOffice 変換と違い、カード・アクセントバー等の装飾が図形として保持され、
 * かつ全テキストが PowerPoint で編集可能になる。
 *
 * 使い方: node render-pptx.js <deck.json> [out.pptx]
 * deck.json のスキーマは catalog/layouts.yaml の各レイアウトの content フィールドに対応。
 */
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const T = JSON.parse(fs.readFileSync(path.join(__dirname, "../theme/tokens.json"), "utf8"));
const C = T.colors, F = T.fonts, S = T.slide;
const M = S.margin;                 // 左右マージン
const CW = S.w - M * 2;             // コンテンツ幅
const hex = (c) => c;              // トークンは既に # なし hex

// ---- 入力 ----
const deckPath = process.argv[2];
if (!deckPath) { console.error("usage: render-pptx.js <deck.json> [out.pptx]"); process.exit(1); }
const deck = JSON.parse(fs.readFileSync(deckPath, "utf8"));
const outPath = process.argv[3] || deckPath.replace(/\.json$/, "") + ".pptx";
const baseDir = path.dirname(path.resolve(deckPath));   // 画像の相対パス解決用

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "LAB", width: S.w, height: S.h });
pptx.layout = "LAB";

// ---- 共通ヘルパ ----
function resolveImg(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.join(baseDir, p);
  return fs.existsSync(abs) ? abs : null;
}
// 見出し(h2 相当)+ 下のアクセントバー。CSS の h2::after を図形で再現。
function addHeadline(slide, text, y = S.top) {
  slide.addText(text || "", {
    x: M, y, w: CW, h: 0.9, fontFace: F.serif, fontSize: 26, bold: true,
    color: hex(C.text), align: "left", valign: "top",
  });
  slide.addShape(pptx.ShapeType.rect, { x: M, y: y + 0.95, w: 1.4, h: 0.055, fill: { color: hex(C.accent) } });
  return y + 1.25;   // 本文開始 y
}
// 章ヘッダー(右上固定表示)。CSS の header を図形で再現。
function addChapterHeader(slide, chapter) {
  if (!chapter) return;
  slide.addShape(pptx.ShapeType.rect, { x: S.w - M - 1.9, y: 0.32, w: 0.1, h: 0.1, fill: { color: hex(C.accent) } });
  slide.addText(chapter, {
    x: S.w - M - 1.7, y: 0.24, w: 1.7, h: 0.3, fontFace: F.serif, fontSize: 11,
    color: hex(C.muted), align: "left", valign: "middle", charSpacing: 2,
  });
}
function addPageNum(slide, n) {
  slide.addText(String(n), {
    x: S.w - M - 0.6, y: S.h - 0.5, w: 0.6, h: 0.3, fontFace: F.serif, fontSize: 10,
    color: hex(C.muted), align: "right",
  });
}
function bulletsText(bullets) {
  return (bullets || []).map((b) => ({
    text: typeof b === "string" ? b : b.text,
    options: { bullet: { code: "2022", indent: 18 }, color: hex(C.text), fontSize: 17, paraSpaceAfter: 8 },
  }));
}
// 点列から連続重複点と共線の中間点(3点が一直線)を除去。エルボー経路の整形用。
function dedupePts(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.y - p.y) > 1e-6) out.push(p);
  }
  if (out.length <= 2) return out;
  const res = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1], b = out[i], c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 1e-6) res.push(b);   // 一直線でなければ折れ点として残す
  }
  res.push(out[out.length - 1]);
  return res;
}
// flow レイアウト共通: variant → ノードの塗り/枠/見出し色(すべて tokens 由来)
const FLOW_VARIANT = {
  neutral: { fill: C.white, line: C.line, title: C.text },
  frozen:  { fill: C.panel, line: C.muted, title: C.text },
  accent:  { fill: C.accentSoft, line: C.accent, title: C.accent },
};

// ---- レイアウトごとの図形レシピ ----
const RECIPES = {
  title(slide, s) {
    slide.background = { color: hex(C.bg) };
    slide.addText(s.title || "", {
      x: 1.2, y: 2.4, w: S.w - 2.4, h: 1.8, fontFace: F.serif, fontSize: 40, bold: true,
      color: hex(C.text), align: "center", valign: "middle", charSpacing: 1,
    });
    slide.addShape(pptx.ShapeType.rect, { x: S.w / 2 - 0.5, y: 4.35, w: 1.0, h: 0.04, fill: { color: hex(C.accent) } });
    if (s.meta) slide.addText(s.meta, {
      x: 1.2, y: 4.6, w: S.w - 2.4, h: 0.5, fontFace: F.body, fontSize: 15,
      color: hex(C.muted), align: "center", charSpacing: 2,
    });
  },

  toc(slide, s) {
    slide.background = { color: hex(C.bg) };
    slide.addText(s.title || "目次", {
      x: M, y: 0.9, w: CW, h: 0.8, fontFace: F.serif, fontSize: 24,
      color: hex(C.text), align: "center", charSpacing: 6,
    });
    const items = s.items || [];
    const rowH = 0.62, startY = 2.1, listW = CW * 0.72, listX = (S.w - listW) / 2;
    items.forEach((it, i) => {
      const y = startY + i * rowH;
      const isCur = s.current === i + 1;
      slide.addText(String(i + 1).padStart(2, "0"), {
        x: listX, y, w: 0.7, h: rowH, fontFace: F.serif, fontSize: 17, bold: true,
        color: hex(C.accent), valign: "middle",
      });
      slide.addText(it, {
        x: listX + 0.8, y, w: listW - 0.8, h: rowH, fontFace: F.serif, fontSize: 18,
        color: isCur ? hex(C.accent) : hex(C.text), bold: isCur, valign: "middle", charSpacing: 1,
      });
      slide.addShape(pptx.ShapeType.line, {
        x: listX, y: y + rowH, w: listW, h: 0,
        line: { color: hex(C.line), width: 0.75, dashType: "dot" },
      });
    });
  },

  section(slide, s) {
    slide.background = { color: hex(C.bg) };
    slide.addText([
      { text: "— ", options: { color: hex(C.accent) } },
      { text: s.title || "", options: { color: hex(C.text) } },
      { text: " —", options: { color: hex(C.accent) } },
    ], {
      x: M, y: S.h / 2 - 0.7, w: CW, h: 1.4, fontFace: F.serif, fontSize: 34, bold: true,
      align: "center", valign: "middle", charSpacing: 3,
    });
  },

  plain(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    slide.addText(bulletsText(s.bullets), {
      x: M, y: by, w: CW, h: S.h - by - 0.6, valign: "top", fontFace: F.body,
    });
  },

  "two-col"(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const gap = 0.5;
    const leftW = s.wide ? CW * 0.58 : CW / 2 - gap / 2;
    const rightX = M + leftW + gap;
    const rightW = S.w - M - rightX;
    const colH = S.h - by - 0.6;
    const L = s.left || {}, R = s.right || {};
    const img = resolveImg(L.image);
    if (img) slide.addImage({ path: img, x: M, y: by, w: leftW, h: colH, sizing: { type: "contain", w: leftW, h: colH } });
    else if (L.bullets) slide.addText(bulletsText(L.bullets), { x: M, y: by, w: leftW, h: colH, valign: "top", fontFace: F.body });
    if (R.bullets) slide.addText(bulletsText(R.bullets), { x: rightX, y: by, w: rightW, h: colH, valign: "middle", fontFace: F.body });
    else if (R.image) { const ri = resolveImg(R.image); if (ri) slide.addImage({ path: ri, x: rightX, y: by, w: rightW, h: colH, sizing: { type: "contain", w: rightW, h: colH } }); }
  },

  compare(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const gap = 0.4, colW = CW / 2 - gap / 2, colH = S.h - by - 0.6;
    const cols = [
      { d: s.baseline || {}, x: M, fill: C.panel, border: C.line, titleColor: C.muted },
      { d: s.proposed || {}, x: M + colW + gap, fill: C.accentSoft, border: C.accent, titleColor: C.accent },
    ];
    cols.forEach(({ d, x, fill, border, titleColor }) => {
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: by, w: colW, h: colH, rectRadius: 0.08,
        fill: { color: hex(fill) }, line: { color: hex(border), width: 1 },
      });
      slide.addText(d.title || "", {
        x: x + 0.3, y: by + 0.25, w: colW - 0.6, h: 0.5, fontFace: F.serif, fontSize: 18, bold: true,
        color: hex(titleColor), valign: "top",
      });
      slide.addText(bulletsText(d.bullets), {
        x: x + 0.3, y: by + 0.95, w: colW - 0.6, h: colH - 1.2, valign: "top", fontFace: F.body,
      });
    });
  },

  "figure-full"(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const capH = s.caption ? 0.5 : 0;
    const imgH = S.h - by - 0.5 - capH;
    const img = resolveImg(s.image);
    if (img) slide.addImage({ path: img, x: M, y: by, w: CW, h: imgH, sizing: { type: "contain", w: CW, h: imgH } });
    else slide.addText("[画像なし: " + (s.image || "") + "]", { x: M, y: by, w: CW, h: imgH, align: "center", valign: "middle", color: hex(C.muted), fontSize: 14 });
    if (s.caption) slide.addText(s.caption, {
      x: M, y: by + imgH + 0.05, w: CW, h: capH, fontFace: F.serif, fontSize: 12,
      color: hex(C.muted), align: "center",
    });
  },

  metrics(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const ms = s.metrics || [];
    const gap = 0.4, n = ms.length || 1;
    const cardW = (CW - gap * (n - 1)) / n;
    const cardH = 2.3, cardY = by + (S.h - by - 0.6 - cardH) / 2;
    ms.forEach((m, i) => {
      const x = M + i * (cardW + gap);
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: cardY, w: cardW, h: cardH, rectRadius: 0.08,
        fill: { color: hex(C.bg) }, line: { color: hex(C.line), width: 1 },
      });
      // 上辺のアクセント(CSS の border-top: 3px accent)
      slide.addShape(pptx.ShapeType.rect, { x, y: cardY, w: cardW, h: 0.06, fill: { color: hex(C.accent) } });
      slide.addText(m.value || "", {
        x, y: cardY + 0.4, w: cardW, h: 1.2, fontFace: F.serif, fontSize: 40, bold: true,
        color: hex(C.accent), align: "center", valign: "middle",
      });
      slide.addText(m.label || "", {
        x, y: cardY + 1.6, w: cardW, h: 0.5, fontFace: F.body, fontSize: 13,
        color: hex(C.muted), align: "center", charSpacing: 2,
      });
    });
  },

  table(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const cols = s.columns || [];
    const rows = s.rows || [];
    const nCol = Math.max(cols.length, 1);
    const highlight = new Set(s.highlight || []);
    const noteH = s.note ? 0.5 : 0;
    const availH = S.h - by - 0.6 - noteH;

    let colW;
    if (Array.isArray(s.widths) && s.widths.length === nCol) {
      const sum = s.widths.reduce((a, b) => a + b, 0);
      colW = s.widths.map((x) => (CW * x) / sum);
    } else {
      const firstW = CW * (nCol <= 4 ? 0.4 : 0.32);
      const restW = (CW - firstW) / Math.max(nCol - 1, 1);
      colW = cols.map((_, i) => (i === 0 ? firstW : restW));
    }

    const nRows = rows.length + 1;
    const fs2 = nRows > 12 ? 10 : nRows > 8 ? 11 : 13;
    const rowH = Math.max(0.32, Math.min(0.52, availH / nRows));

    const headerRow = cols.map((c) => ({
      text: String(c),
      options: {
        bold: true, color: "FFFFFF", fill: { color: hex(C.accent) },
        fontFace: F.body, fontSize: fs2, align: "center", valign: "middle",
      },
    }));
    const bodyRows = rows.map((r, ri) => {
      const hot = highlight.has(ri);
      const cells = Array.isArray(r) ? r : [r];
      return cells.map((cell, ci) => ({
        text: String(cell),
        options: {
          color: hot ? hex(C.accent) : hex(C.text),
          bold: hot,
          fill: { color: hex(hot ? C.accentSoft : ri % 2 ? C.panel : C.bg) },
          fontFace: F.body, fontSize: fs2,
          align: ci === 0 ? "left" : "center", valign: "middle",
        },
      }));
    });

    slide.addTable([headerRow, ...bodyRows], {
      x: M, y: by, w: CW, colW, rowH,
      border: { type: "solid", pt: 0.5, color: hex(C.line) },
      valign: "middle", autoPage: false,
    });
    if (s.note) slide.addText(s.note, {
      x: M, y: by + rowH * nRows + 0.1, w: CW, h: noteH,
      fontFace: F.serif, fontSize: 12, color: hex(C.muted), align: "left", valign: "top",
    });
  },

  discussion(slide, s) {
    slide.background = { color: hex(C.panel) };
    slide.addText(s.title || "議論したいこと", {
      x: M, y: S.top, w: CW, h: 0.8, fontFace: F.serif, fontSize: 26, bold: true, color: hex(C.accent),
    });
    const items = s.items || [];
    const startY = S.top + 1.1, rowH = Math.min(1.0, (S.h - startY - 0.6) / Math.max(items.length, 1));
    items.forEach((it, i) => {
      const y = startY + i * (rowH + 0.15);
      slide.addShape(pptx.ShapeType.rect, { x: M, y, w: CW, h: rowH, fill: { color: hex(C.bg) } });
      slide.addShape(pptx.ShapeType.rect, { x: M, y, w: 0.06, h: rowH, fill: { color: hex(C.accent) } });
      slide.addText([
        { text: (i + 1) + ". ", options: { bold: true, color: hex(C.accent) } },
        { text: it, options: { color: hex(C.text) } },
      ], { x: M + 0.3, y, w: CW - 0.6, h: rowH, valign: "middle", fontFace: F.body, fontSize: 17 });
    });
  },

  takeaway(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline || "まとめ");
    if (s.bullets) slide.addText(bulletsText(s.bullets), { x: M, y: by, w: CW, h: 2.2, valign: "top", fontFace: F.body });
    if (s.message) {
      const boxY = S.h - 1.7;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: M, y: boxY, w: CW, h: 1.0, rectRadius: 0.06,
        fill: { color: hex(C.bg) }, line: { color: hex(C.accent), width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, { x: M, y: boxY, w: 0.08, h: 1.0, fill: { color: hex(C.accent) } });
      slide.addText(s.message, {
        x: M + 0.35, y: boxY, w: CW - 0.7, h: 1.0, fontFace: F.serif, fontSize: 19, bold: true,
        color: hex(C.text), valign: "middle",
      });
    }
  },

  // flow: 矩形/楕円/菱形ノード + 矢印コネクタ + グループ囲み + 自由ラベルからなる
  // 汎用ダイアグラム。正規化座標(0〜1)を見出し下のコンテンツ領域に写像し、
  // 本物の図形(roundRect/ellipse/diamond/line/text)で描くので PowerPoint で編集可能。
  flow(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const noteH = s.note ? 0.45 : 0;
    const R = { x: M, y: by, w: CW, h: S.h - by - 0.5 - noteH };   // 描画領域(絶対座標)
    const AX = (v) => R.x + v * R.w;      // 正規化 → 絶対(x)
    const AY = (v) => R.y + v * R.h;      // 正規化 → 絶対(y)

    const SHAPES = {
      rect: pptx.ShapeType.rect, roundRect: pptx.ShapeType.roundRect,
      ellipse: pptx.ShapeType.ellipse, diamond: pptx.ShapeType.diamond,
    };
    const nodes = s.nodes || [];
    const byId = {};
    nodes.forEach((n) => { byId[n.id] = n; });
    const box = (n) => ({ x: AX(n.x), y: AY(n.y), w: n.w * R.w, h: n.h * R.h });
    const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    const anchor = (b, side) => {
      const c = center(b);
      if (side === "top") return { x: c.x, y: b.y };
      if (side === "bottom") return { x: c.x, y: b.y + b.h };
      if (side === "left") return { x: b.x, y: c.y };
      if (side === "right") return { x: b.x + b.w, y: c.y };
      return c;
    };
    // 接続辺の自動選択: 2ノード中心の相対位置で、支配的な軸の対向辺どうしをつなぐ
    const autoSides = (ba, bb) => {
      const ca = center(ba), cb = center(bb);
      const dx = cb.x - ca.x, dy = cb.y - ca.y;
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
      return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
    };

    // 1) グループ囲み枠(最背面)
    (s.groups || []).forEach((g) => {
      const v = FLOW_VARIANT[g.variant] || FLOW_VARIANT.frozen;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: AX(g.x), y: AY(g.y), w: g.w * R.w, h: g.h * R.h, rectRadius: 0.06,
        fill: { color: hex(v.fill), transparency: 55 },
        line: { color: hex(v.line), width: 1, dashType: "dash" },
      });
      if (g.label) slide.addText(g.label, {
        x: AX(g.x) + 0.1, y: AY(g.y) + 0.05, w: g.w * R.w - 0.2, h: 0.3,
        fontFace: F.body, fontSize: 11, bold: true, color: hex(v.line),
        align: "left", valign: "top", charSpacing: 1,
      });
    });

    // 2) エッジ(ノードより先に描く = ノードの塗りが端点を隠す)
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
        pts = [start, ...e.waypoints.map((w) => ({ x: AX(w.x), y: AY(w.y) })), end];
      } else {
        // 既定は直交エルボー: 出口の向き(水平/垂直)で折り返し点を作る
        const horiz = sideA === "left" || sideA === "right";
        pts = horiz
          ? [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end]
          : [start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end];
      }
      pts = dedupePts(pts);
      const dash = e.style === "dashed" ? "dash" : e.style === "dotted" ? "sysDot" : "solid";
      const arrow = e.arrow || "end";
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const line = { color: hex(C.muted), width: 1.5, dashType: dash };
        if (i === pts.length - 2 && (arrow === "end" || arrow === "both")) line.endArrowType = "triangle";
        if (i === 0 && (arrow === "begin" || arrow === "both")) line.beginArrowType = "triangle";
        slide.addShape(pptx.ShapeType.line, {
          x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
          w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y),
          flipH: p2.x < p1.x, flipV: p2.y < p1.y, line,
        });
      }
      if (e.label) {
        const mid = pts[Math.floor((pts.length - 1) / 2)];
        slide.addText(e.label, {
          x: mid.x - 0.9, y: mid.y - 0.18, w: 1.8, h: 0.36,
          fontFace: F.body, fontSize: 10, color: hex(C.muted),
          align: "center", valign: "middle", fill: { color: hex(C.bg) },
        });
      }
    });

    // 3) ノード(図形 + 中央寄せテキスト)
    nodes.forEach((n) => {
      const b = box(n);
      const v = FLOW_VARIANT[n.variant] || FLOW_VARIANT.neutral;
      const shape = SHAPES[n.shape] || SHAPES.roundRect;
      slide.addShape(shape, {
        x: b.x, y: b.y, w: b.w, h: b.h, rectRadius: 0.08,
        fill: { color: hex(v.fill) }, line: { color: hex(v.line), width: 1.25 },
      });
      const txt = [];
      if (n.title) txt.push({ text: n.title, options: { bold: true, fontSize: 13, color: hex(v.title), breakLine: true } });
      (n.lines || []).forEach((l) => txt.push({ text: l, options: { fontSize: 10.5, color: hex(C.text), breakLine: true } }));
      if (txt.length) slide.addText(txt, {
        x: b.x + 0.08, y: b.y, w: b.w - 0.16, h: b.h,
        align: "center", valign: "middle", fontFace: F.body,
      });
    });

    // 4) 自由ラベル(枠なしテキスト: 注記・式・凡例)
    (s.labels || []).forEach((l) => {
      const color = l.variant === "accent" ? C.accent : l.variant === "muted" ? C.muted : C.text;
      slide.addText(l.text || "", {
        x: AX(l.x), y: AY(l.y), w: (l.w || 0.3) * R.w, h: (l.h || 0.08) * R.h,
        fontFace: l.serif ? F.serif : F.body, fontSize: l.size || 12, color: hex(color),
        bold: !!l.bold, align: l.align || "center", valign: "middle",
      });
    });

    // 5) note(領域下・任意)
    if (s.note) slide.addText(s.note, {
      x: M, y: S.h - 0.5 - noteH + 0.05, w: CW, h: noteH,
      fontFace: F.serif, fontSize: 12, color: hex(C.muted), align: "left", valign: "top",
    });
  },
};

// ---- 生成ループ ----
const noHeaderLayouts = new Set(["title", "toc", "section"]);
deck.slides.forEach((s, idx) => {
  const recipe = RECIPES[s.layout];
  const slide = pptx.addSlide();
  if (!recipe) {
    slide.background = { color: hex(C.bg) };
    slide.addText(`[未対応レイアウト: ${s.layout}]`, { x: M, y: 1, w: CW, h: 1, color: hex(C.accent), fontSize: 18 });
  } else {
    recipe(slide, s);
    if (!noHeaderLayouts.has(s.layout)) addChapterHeader(slide, s.header);
    if (idx > 0) addPageNum(slide, idx + 1);
  }
});

pptx.writeFile({ fileName: outPath }).then(() => {
  console.log("built: " + outPath);
}).catch((e) => { console.error(e); process.exit(1); });
