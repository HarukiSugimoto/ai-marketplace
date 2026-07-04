#!/usr/bin/env node
/*
 * gen-tokens-css.js — 解決済みトークン(共通→会社パック)から Marp 用の :root 変数を生成。
 * 色は colors の全キーを --c-<kebab-case> として機械的に出すので、
 * 会社パックが独自色を足しても生成器の修正は不要。build.sh が毎ビルド実行する。
 *
 * 使い方: node gen-tokens-css.js [deck.json|dir]   (deck の場所から会社を解決)
 */
const fs = require("fs");
const path = require("path");
const { resolveTokens } = require("./resolve-tokens");

const { tokens: T, company } = resolveTokens(process.argv[2] || ".");
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const colorVars = Object.entries(T.colors)
  .map(([k, v]) => `  --c-${kebab(k)}: #${v};`)
  .join("\n");

const css = `/* 自動生成: tokens.json(共通)+ 会社パック から。手で編集しないこと */
:root {
${colorVars}
  --font-head: '${T.fonts.head}', 'Noto Sans JP', 'Meiryo', sans-serif;
  --font-body: '${T.fonts.body}', 'Noto Sans JP', 'Meiryo', sans-serif;
}
`;
fs.writeFileSync(path.join(__dirname, "../theme/_tokens.css"), css);
console.log(`generated: theme/_tokens.css${company ? ` (company: ${company})` : " (共通既定)"}`);
