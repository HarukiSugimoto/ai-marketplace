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
