#!/usr/bin/env node
/*
 * render-pptx.js — deck.json(構造化スライド)から編集可能な .pptx を生成する。
 *
 * work-slides の二枚看板レンダラーのうち「本番 pptx」側。
 * カタログの各レイアウトを PptxGenJS の図形+テキスト+表で組む(= 図形レシピ)。
 * カード・矢印・帯などの装飾が図形として保持され、表は PowerPoint のネイティブ表になり、
 * 全テキストが編集可能。
 *
 * トークンは resolve-tokens.js で「共通 → 会社パック」を解決した結果を使う。
 * 会社パックに assets.logo があれば表紙に自動配置する。
 *
 * 使い方: node render-pptx.js <deck.json> [out.pptx]
 * deck.json のスキーマは catalog/layouts.yaml の各レイアウトの deck 例に対応。
 */
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const { resolveTokens } = require("./resolve-tokens");

// ---- 入力 ----
const deckPath = process.argv[2];
if (!deckPath) { console.error("usage: render-pptx.js <deck.json> [out.pptx]"); process.exit(1); }
const deck = JSON.parse(fs.readFileSync(deckPath, "utf8"));
const outPath = process.argv[3] || deckPath.replace(/\.json$/, "") + ".pptx";
const baseDir = path.dirname(path.resolve(deckPath));   // 画像の相対パス解決用

// ---- トークン解決(共通 → 会社パック)----
const { tokens: T, company, packDir } = resolveTokens(deckPath);
const C = T.colors, F = T.fonts, S = T.slide;
const M = S.margin;                 // 左右マージン
const CW = S.w - M * 2;             // コンテンツ幅
const hex = (c) => c;               // トークンは既に # なし hex

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WORK", width: S.w, height: S.h });
pptx.layout = "WORK";

// ---- 共通ヘルパ ----
function resolveImg(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.join(baseDir, p);
  return fs.existsSync(abs) ? abs : null;
}
// 会社パックのロゴ(companies/<id>/tokens.json の assets.logo。パック相対パス)
function logoPath() {
  const lp = T.assets && T.assets.logo;
  if (!lp || !packDir) return null;
  const abs = path.isAbsolute(lp) ? lp : path.join(packDir, lp);
  return fs.existsSync(abs) ? abs : null;
}
// 見出し: 左の縦バー + 太字ゴシック + 下の細罫。CSS の h2(左バー式)を図形で再現。
function addHeadline(slide, text, y = S.top) {
  slide.addShape(pptx.ShapeType.rect, { x: M, y: y + 0.05, w: 0.09, h: 0.6, fill: { color: hex(C.accent) } });
  slide.addText(text || "", {
    x: M + 0.28, y, w: CW - 0.28, h: 0.72, fontFace: F.head, fontSize: 23, bold: true,
    color: hex(C.text), align: "left", valign: "middle",
  });
  slide.addShape(pptx.ShapeType.line, {
    x: M, y: y + 0.82, w: CW, h: 0, line: { color: hex(C.line), width: 0.75 },
  });
  return y + 1.1;   // 本文開始 y
}
// 章ヘッダー(右上固定表示)
function addChapterHeader(slide, chapter) {
  if (!chapter) return;
  slide.addShape(pptx.ShapeType.rect, { x: S.w - M - 2.0, y: 0.3, w: 0.1, h: 0.1, fill: { color: hex(C.accent) } });
  slide.addText(chapter, {
    x: S.w - M - 1.8, y: 0.22, w: 1.8, h: 0.3, fontFace: F.head, fontSize: 10.5,
    color: hex(C.muted), align: "left", valign: "middle", charSpacing: 2,
  });
}
function addPageNum(slide, n) {
  slide.addText(String(n), {
    x: S.w - M - 0.6, y: S.h - 0.5, w: 0.6, h: 0.3, fontFace: F.head, fontSize: 10,
    color: hex(C.muted), align: "right",
  });
}
function bulletsText(bullets, size = 16) {
  return (bullets || []).map((b) => ({
    text: typeof b === "string" ? b : b.text,
    options: { bullet: { code: "2022", indent: 16 }, color: hex(C.text), fontSize: size, paraSpaceAfter: 8 },
  }));
}
// 表の行データを PptxGenJS 形式へ(ヘッダ行 = 紺地白字、本文 = 縞模様)
function tableRows(cols, rows, opts = {}) {
  const headRow = cols.map((c) => ({
    text: String(c), options: {
      bold: true, color: hex(C.white), fill: { color: hex(C.accent) },
      fontFace: F.head, fontSize: 12.5, align: "center", valign: "middle",
    },
  }));
  const bodyRows = (rows || []).map((r, ri) => r.map((cell, ci) => ({
    text: cell == null ? "" : String(cell), options: {
      color: hex(C.text), fill: { color: ri % 2 ? hex(C.panel) : hex(C.bg) },
      fontFace: F.body, fontSize: 12.5, valign: "middle",
      align: opts.aligns ? opts.aligns[ci] : "left",
    },
  })));
  return [headRow, ...bodyRows];
}

// ---- レイアウトごとの図形レシピ ----
const RECIPES = {
  title(slide, s) {
    slide.background = { color: hex(C.bg) };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: S.w, h: 0.16, fill: { color: hex(C.accent) } });
    if (s.to) slide.addText(s.to, {
      x: 1.0, y: 1.7, w: S.w - 2.0, h: 0.45, fontFace: F.head, fontSize: 16,
      color: hex(C.text), align: "left",
    });
    slide.addText(s.title || "", {
      x: 1.0, y: 2.5, w: S.w - 2.0, h: 1.5, fontFace: F.head, fontSize: 34, bold: true,
      color: hex(C.text), align: "left", valign: "middle",
    });
    slide.addShape(pptx.ShapeType.rect, { x: 1.0, y: 4.15, w: 1.2, h: 0.06, fill: { color: hex(C.accent) } });
    if (s.subtitle) slide.addText(s.subtitle, {
      x: 1.0, y: 4.4, w: S.w - 2.0, h: 0.5, fontFace: F.head, fontSize: 17,
      color: hex(C.muted), align: "left",
    });
    if (s.meta) slide.addText(s.meta, {
      x: 1.0, y: S.h - 1.1, w: S.w - 2.0, h: 0.4, fontFace: F.body, fontSize: 13,
      color: hex(C.muted), align: "left", charSpacing: 1,
    });
    const logo = logoPath();
    if (logo) slide.addImage({ path: logo, x: S.w - 2.6, y: S.h - 1.25, w: 1.9, h: 0.7, sizing: { type: "contain", w: 1.9, h: 0.7 } });
  },

  agenda(slide, s) {
    slide.background = { color: hex(C.bg) };
    slide.addText(s.title || "本日の内容", {
      x: M, y: 0.9, w: CW, h: 0.7, fontFace: F.head, fontSize: 22, bold: true,
      color: hex(C.text), align: "center", charSpacing: 4,
    });
    const items = s.items || [];
    const rowH = 0.62, startY = 2.05, listW = CW * 0.7, listX = (S.w - listW) / 2;
    items.forEach((it, i) => {
      const y = startY + i * rowH;
      const isCur = s.current === i + 1;
      slide.addText(String(i + 1).padStart(2, "0"), {
        x: listX, y, w: 0.7, h: rowH, fontFace: F.head, fontSize: 16, bold: true,
        color: hex(C.accent), valign: "middle",
      });
      slide.addText(it, {
        x: listX + 0.8, y, w: listW - 0.8, h: rowH, fontFace: F.head, fontSize: 17,
        color: isCur ? hex(C.accent) : hex(C.text), bold: isCur, valign: "middle",
      });
      slide.addShape(pptx.ShapeType.line, {
        x: listX, y: y + rowH, w: listW, h: 0, line: { color: hex(C.line), width: 0.75 },
      });
    });
  },

  section(slide, s) {
    slide.background = { color: hex(C.accent) };
    slide.addShape(pptx.ShapeType.rect, { x: M, y: S.h / 2 - 0.45, w: 0.12, h: 0.9, fill: { color: hex(C.white) } });
    slide.addText(s.title || "", {
      x: M + 0.4, y: S.h / 2 - 0.7, w: CW - 2.0, h: 1.4, fontFace: F.head, fontSize: 30, bold: true,
      color: hex(C.white), align: "left", valign: "middle", charSpacing: 2,
    });
    if (s.no) slide.addText(String(s.no), {
      x: S.w - 3.2, y: S.h - 2.3, w: 2.6, h: 1.8, fontFace: F.head, fontSize: 80, bold: true,
      color: hex(C.white), transparency: 75, align: "right", valign: "bottom",
    });
  },

  "exec-summary"(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline || "エグゼクティブサマリ");
    // 結論ボックス(お願い・決めてほしいこと)
    const askH = 1.05;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: M, y: by, w: CW, h: askH, rectRadius: 0.06,
      fill: { color: hex(C.accentSoft) }, line: { color: hex(C.accent), width: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, { x: M, y: by, w: 0.09, h: askH, fill: { color: hex(C.accent) } });
    slide.addText([
      { text: "結論   ", options: { bold: true, color: hex(C.accent), charSpacing: 3 } },
      { text: s.ask || "", options: { bold: true, color: hex(C.text) } },
    ], {
      x: M + 0.32, y: by, w: CW - 0.64, h: askH, fontFace: F.head, fontSize: 17, valign: "middle",
    });
    // 根拠ポイント
    const py = by + askH + 0.3;
    (s.points || []).forEach((p, i) => {
      const y = py + i * 0.72;
      const runs = [{ text: `${i + 1}.  `, options: { bold: true, color: hex(C.accent) } }];
      if (typeof p === "string") runs.push({ text: p, options: { color: hex(C.text) } });
      else {
        runs.push({ text: `${p.label} — `, options: { bold: true, color: hex(C.text) } });
        runs.push({ text: p.text || "", options: { color: hex(C.text) } });
      }
      slide.addText(runs, { x: M + 0.1, y, w: CW - 0.2, h: 0.65, fontFace: F.body, fontSize: 15.5, valign: "middle" });
    });
  },

  body(slide, s) {
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

  "problem-solution"(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const colH = S.h - by - 0.7;
    const arrowW = 0.6, gap = 0.22;
    const colW = (CW - arrowW - gap * 2) / 2;
    const P = s.problem || {}, X = s.solution || {};
    // 課題カード
    slide.addShape(pptx.ShapeType.roundRect, {
      x: M, y: by, w: colW, h: colH, rectRadius: 0.06,
      fill: { color: hex(C.panel) }, line: { color: hex(C.line), width: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, { x: M, y: by, w: colW, h: 0.06, fill: { color: hex(C.danger) } });
    slide.addText(P.title || "課題", {
      x: M + 0.3, y: by + 0.2, w: colW - 0.6, h: 0.45, fontFace: F.head, fontSize: 17, bold: true,
      color: hex(C.danger), valign: "top",
    });
    slide.addText(bulletsText(P.bullets, 15), { x: M + 0.3, y: by + 0.8, w: colW - 0.6, h: colH - 1.05, valign: "top", fontFace: F.body });
    // 矢印
    slide.addShape(pptx.ShapeType.rightArrow, {
      x: M + colW + gap, y: by + colH / 2 - 0.32, w: arrowW, h: 0.64, fill: { color: hex(C.accent) },
    });
    // 解決カード
    const sx = M + colW + gap + arrowW + gap;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: sx, y: by, w: colW, h: colH, rectRadius: 0.06,
      fill: { color: hex(C.accentSoft) }, line: { color: hex(C.accent), width: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, { x: sx, y: by, w: colW, h: 0.06, fill: { color: hex(C.accent) } });
    slide.addText(X.title || "解決策", {
      x: sx + 0.3, y: by + 0.2, w: colW - 0.6, h: 0.45, fontFace: F.head, fontSize: 17, bold: true,
      color: hex(C.accent), valign: "top",
    });
    slide.addText(bulletsText(X.bullets, 15), { x: sx + 0.3, y: by + 0.8, w: colW - 0.6, h: colH - 1.05, valign: "top", fontFace: F.body });
  },

  compare(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const ops = s.options || [];
    const n = Math.max(ops.length, 1), gap = 0.35;
    const colW = (CW - gap * (n - 1)) / n, colH = S.h - by - 0.75;
    const top = by + 0.15;   // 推奨バッジがはみ出す分の余白
    ops.forEach((o, i) => {
      const x = M + i * (colW + gap);
      const rec = !!o.recommended;
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: top, w: colW, h: colH, rectRadius: 0.06,
        fill: { color: rec ? hex(C.accentSoft) : hex(C.panel) },
        line: { color: rec ? hex(C.accent) : hex(C.line), width: rec ? 1.5 : 1 },
      });
      if (rec) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: x + colW - 0.95, y: top - 0.16, w: 0.8, h: 0.34, rectRadius: 0.05, fill: { color: hex(C.accent) },
        });
        slide.addText("推奨", {
          x: x + colW - 0.95, y: top - 0.16, w: 0.8, h: 0.34, fontFace: F.head, fontSize: 11, bold: true,
          color: hex(C.white), align: "center", valign: "middle", charSpacing: 2,
        });
      }
      slide.addText(o.title || "", {
        x: x + 0.28, y: top + 0.22, w: colW - 0.56, h: 0.5, fontFace: F.head, fontSize: 16, bold: true,
        color: rec ? hex(C.accent) : hex(C.text), valign: "top",
      });
      slide.addText(bulletsText(o.bullets, 13.5), {
        x: x + 0.28, y: top + 0.85, w: colW - 0.56, h: colH - 1.1, valign: "top", fontFace: F.body,
      });
    });
  },

  table(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    slide.addTable(tableRows(s.columns || [], s.rows), {
      x: M, y: by + 0.1, w: CW, rowH: 0.42,
      border: { type: "solid", color: hex(C.line), pt: 0.5 },
      fontFace: F.body, autoPage: false, valign: "middle",
    });
    if (s.note) slide.addText(s.note, {
      x: M, y: S.h - 0.75, w: CW, h: 0.35, fontFace: F.body, fontSize: 11,
      color: hex(C.muted), align: "left",
    });
  },

  roadmap(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const ph = s.phases || [];
    const n = Math.max(ph.length, 1), gap = 0.14;
    const w = (CW - gap * (n - 1)) / n, chevH = 0.6;
    ph.forEach((p, i) => {
      const x = M + i * (w + gap);
      slide.addShape(i === 0 ? pptx.ShapeType.homePlate : pptx.ShapeType.chevron, {
        x, y: by + 0.1, w, h: chevH, fill: { color: hex(C.accent) },
      });
      slide.addText(p.label || "", {
        x, y: by + 0.1, w, h: chevH, fontFace: F.head, fontSize: 14, bold: true,
        color: hex(C.white), align: "center", valign: "middle",
      });
      if (p.period) slide.addText(p.period, {
        x, y: by + 0.78, w, h: 0.3, fontFace: F.body, fontSize: 11,
        color: hex(C.muted), align: "center",
      });
      slide.addText(bulletsText(p.items, 12.5), {
        x: x + 0.05, y: by + 1.15, w: w - 0.1, h: S.h - by - 1.8, valign: "top", fontFace: F.body,
      });
    });
  },

  kpi(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline);
    const ms = s.metrics || [];
    const gap = 0.4, n = ms.length || 1;
    const cardW = (CW - gap * (n - 1)) / n;
    const cardH = 2.3, cardY = by + (S.h - by - 0.6 - cardH) / 2;
    ms.forEach((m, i) => {
      const x = M + i * (cardW + gap);
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: cardY, w: cardW, h: cardH, rectRadius: 0.06,
        fill: { color: hex(C.bg) }, line: { color: hex(C.line), width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, { x, y: cardY, w: cardW, h: 0.06, fill: { color: hex(C.accent) } });
      slide.addText(m.value || "", {
        x, y: cardY + 0.4, w: cardW, h: 1.2, fontFace: F.head, fontSize: 38, bold: true,
        color: hex(C.accent), align: "center", valign: "middle",
      });
      slide.addText(m.label || "", {
        x, y: cardY + 1.6, w: cardW, h: 0.5, fontFace: F.body, fontSize: 13,
        color: hex(C.muted), align: "center", charSpacing: 2,
      });
    });
  },

  "next-action"(slide, s) {
    slide.background = { color: hex(C.bg) };
    const by = addHeadline(slide, s.headline || "次のアクション");
    const acts = s.actions || [];
    slide.addTable(
      tableRows(["担当", "アクション", "期限"], acts.map((a) => [a.who, a.what, a.when]), { aligns: ["center", "left", "center"] }),
      {
        x: M, y: by + 0.1, w: CW, rowH: 0.45, colW: [2.2, CW - 4.4, 2.2],
        border: { type: "solid", color: hex(C.line), pt: 0.5 },
        fontFace: F.body, autoPage: false, valign: "middle",
      }
    );
    if (s.message) {
      const boxY = S.h - 1.55;
      slide.addShape(pptx.ShapeType.roundRect, {
        x: M, y: boxY, w: CW, h: 0.9, rectRadius: 0.06,
        fill: { color: hex(C.bg) }, line: { color: hex(C.accent), width: 1 },
      });
      slide.addShape(pptx.ShapeType.rect, { x: M, y: boxY, w: 0.09, h: 0.9, fill: { color: hex(C.accent) } });
      slide.addText(s.message, {
        x: M + 0.35, y: boxY, w: CW - 0.7, h: 0.9, fontFace: F.head, fontSize: 17, bold: true,
        color: hex(C.text), valign: "middle",
      });
    }
  },
};

// ---- 生成ループ ----
const noHeaderLayouts = new Set(["title", "agenda", "section"]);
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
  console.log("built: " + outPath + (company ? ` (company: ${company})` : " (共通既定)"));
}).catch((e) => { console.error(e); process.exit(1); });
