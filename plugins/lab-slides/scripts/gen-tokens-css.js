#!/usr/bin/env node
/*
 * gen-tokens-css.js — tokens.json から Marp 用の :root 変数(theme/_tokens.css)を生成。
 * これにより色・フォントの真実は tokens.json ただ一つになり、CSS と pptx レンダラーが
 * 同じ値を共有する(二重管理・ズレを防ぐ)。build.sh が毎回これを実行する。
 */
const fs = require("fs");
const path = require("path");
const T = JSON.parse(fs.readFileSync(path.join(__dirname, "../theme/tokens.json"), "utf8"));
const c = T.colors, f = T.fonts;
const css = `/* 自動生成: tokens.json から。手で編集しないこと(編集は tokens.json 側で) */
:root {
  --c-bg: #${c.bg};
  --c-text: #${c.text};
  --c-muted: #${c.muted};
  --c-accent: #${c.accent};
  --c-accent-soft: #${c.accentSoft};
  --c-panel: #${c.panel};
  --c-line: #${c.line};
  --font-serif: '${f.serif}', 'Yu Mincho', 'Noto Serif JP', serif;
  --font-body: '${f.body}', 'Noto Sans JP', sans-serif;
}
`;
fs.writeFileSync(path.join(__dirname, "../theme/_tokens.css"), css);
console.log("generated: theme/_tokens.css");
