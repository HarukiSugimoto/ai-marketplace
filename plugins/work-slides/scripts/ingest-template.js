#!/usr/bin/env node
/*
 * ingest-template.js — 会社の指定テンプレ pptx から配色・書体を吸い出し、
 * 会社パック(companies/<id>/tokens.json)を生成する。入社・転職時の取り込みツール。
 *
 * pptx は zip なので、中の ppt/theme/theme1.xml(Office テーマ)から
 * カラースキーム(dk1/lt1/accent1..6)とフォントスキームを抽出する。
 * 依存を増やさないため解凍は macOS/Linux 標準の unzip を使う。
 *
 * 注意: テーマ色が形骸化した pptx(全部ベタ塗り指定)もあるため、
 *       出力後に必ずデモデッキをビルドして目視確認すること(/company-add が案内)。
 *
 * 使い方: node ingest-template.js <会社テンプレ.pptx> <会社id>
 *   companies/<会社id>/ が無ければ _example から複製して作る。
 *   既存の tokens.json があれば上書き前に .bak を残す。
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PLUGIN_ROOT = path.join(__dirname, "..");

const [pptxPath, companyId] = process.argv.slice(2);
if (!pptxPath || !companyId) {
  console.error("usage: ingest-template.js <会社テンプレ.pptx> <会社id>");
  process.exit(1);
}
if (!fs.existsSync(pptxPath)) { console.error("ERROR: pptx が見つかりません: " + pptxPath); process.exit(1); }
if (!/^[\w.-]+$/.test(companyId)) { console.error("ERROR: 会社idは半角英数・ハイフンで: " + companyId); process.exit(1); }

// ---- theme1.xml を取り出す(pptx = zip)----
let xml;
try {
  xml = execFileSync("unzip", ["-p", pptxPath, "ppt/theme/theme1.xml"], { encoding: "utf8" });
} catch (e) {
  console.error("ERROR: theme1.xml を取り出せませんでした(pptx が壊れているか、テーマ無し)");
  process.exit(1);
}

// ---- カラースキーム抽出 ----
// <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1> と
// <a:accent1><a:srgbClr val="4472C4"/></a:accent1> の両形式に対応
function schemeColor(name) {
  const block = xml.match(new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`));
  if (!block) return null;
  const srgb = block[1].match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
  if (srgb) return srgb[1].toUpperCase();
  const sys = block[1].match(/lastClr="([0-9A-Fa-f]{6})"/);
  return sys ? sys[1].toUpperCase() : null;
}
// ---- フォントスキーム抽出(見出し=majorFont / 本文=minorFont。日本語は ea を優先)----
function schemeFont(kind) {
  const block = xml.match(new RegExp(`<a:${kind}Font>([\\s\\S]*?)</a:${kind}Font>`));
  if (!block) return null;
  const ea = block[1].match(/<a:ea typeface="([^"]+)"/);
  if (ea && ea[1]) return ea[1];
  const latin = block[1].match(/<a:latin typeface="([^"]+)"/);
  return latin ? latin[1] : null;
}

// アクセント色を淡色化(accentSoft 用: 白と 88:12 で混ぜる)
function soften(hexColor, ratio = 0.12) {
  const n = parseInt(hexColor, 16);
  const mix = (v) => Math.round(255 * (1 - ratio) + v * ratio);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const extracted = {
  dk1: schemeColor("dk1"), lt1: schemeColor("lt1"),
  dk2: schemeColor("dk2"), lt2: schemeColor("lt2"),
  accent1: schemeColor("accent1"), accent2: schemeColor("accent2"),
  headFont: schemeFont("major"), bodyFont: schemeFont("minor"),
};

if (!extracted.accent1) {
  console.error("ERROR: カラースキームを読み取れませんでした。手動で tokens.json を書いてください。");
  process.exit(1);
}

// ---- 会社パックの tokens.json に変換 ----
// 共通 theme/tokens.json への「上書き差分」だけを書く(bg 等は既定を活かす)
const packTokens = {
  colors: {
    accent: extracted.accent1,
    accentSoft: soften(extracted.accent1),
    ...(extracted.dk1 && extracted.dk1 !== "000000" ? { text: extracted.dk1 } : {}),
  },
  ...(extracted.headFont || extracted.bodyFont ? {
    fonts: {
      ...(extracted.headFont ? { head: extracted.headFont } : {}),
      ...(extracted.bodyFont ? { body: extracted.bodyFont } : {}),
    },
  } : {}),
  assets: { logo: "assets/logo.png" },
};

// ---- パックの作成 / 上書き ----
const packDir = path.join(PLUGIN_ROOT, "companies", companyId);
if (!fs.existsSync(packDir)) {
  fs.cpSync(path.join(PLUGIN_ROOT, "companies", "_example"), packDir, { recursive: true });
  console.log("created: companies/" + companyId + "/(_example から複製)");
}
const tokensPath = path.join(packDir, "tokens.json");
if (fs.existsSync(tokensPath)) fs.copyFileSync(tokensPath, tokensPath + ".bak");
fs.writeFileSync(tokensPath, JSON.stringify(packTokens, null, 2) + "\n");

// ---- 結果レポート ----
console.log("wrote: companies/" + companyId + "/tokens.json");
console.log("");
console.log("抽出結果(元テンプレと目視で照合してください):");
console.log("  accent    : #" + extracted.accent1 + "(テーマ accent1)");
console.log("  accentSoft: #" + packTokens.colors.accentSoft + "(自動淡色化)");
if (packTokens.colors.text) console.log("  text      : #" + packTokens.colors.text + "(テーマ dk1)");
if (extracted.accent2) console.log("  参考 accent2: #" + extracted.accent2 + "(第2色が要るなら手動で追加)");
console.log("  見出し書体: " + (extracted.headFont || "(取得できず・共通既定のまま)"));
console.log("  本文書体  : " + (extracted.bodyFont || "(取得できず・共通既定のまま)"));
console.log("");
console.log("次のステップ:");
console.log("  1. ロゴ画像を companies/" + companyId + "/assets/logo.png に置く(無いなら tokens.json の assets を削除)");
console.log("  2. companies/" + companyId + "/rules.yaml を会社の規定に合わせて編集");
console.log("  3. デモをビルドして色を目視確認(テーマ色が形骸化した pptx もあるため):");
console.log("     workspace.yaml(company: " + companyId + ")のある場所でデモデッキを build.sh all");
