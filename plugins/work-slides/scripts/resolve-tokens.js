#!/usr/bin/env node
/*
 * resolve-tokens.js — トークンのカスケード解決(共通層 → 会社層)。work-slides の新機軸。
 *
 * 体裁の優先度: 会社パック(companies/<id>/tokens.json) > 共通既定(theme/tokens.json)。
 * どの会社パックを使うかは、deck の場所から上へ辿った .work-slides/workspace.yaml の
 * `company: <id>` で宣言される(職場ディレクトリに1回書くだけ。案件側は無編集)。
 * workspace.yaml が無い/company 未指定なら共通既定のまま動く。
 *
 * CLI:
 *   node resolve-tokens.js <deck.json|dir>             解決済みトークン JSON を stdout へ
 *   node resolve-tokens.js <deck.json|dir> --company   会社 id を表示(未設定なら空)
 *   node resolve-tokens.js <deck.json|dir> --packdir   会社パックのディレクトリ(無ければ空)
 * module:
 *   const { resolveTokens } = require("./resolve-tokens");
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_ROOT = path.join(__dirname, "..");

// オブジェクトは深く、それ以外(文字列・配列)は会社側で上書き
function deepMerge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const b = base ? base[k] : undefined, o = over[k];
    out[k] = (o && typeof o === "object" && !Array.isArray(o) && b && typeof b === "object" && !Array.isArray(b))
      ? deepMerge(b, o) : o;
  }
  return out;
}

// deck の場所から上へ .work-slides/workspace.yaml を探す(職場ディレクトリの発見)
function findWorkspace(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const ws = path.join(dir, ".work-slides", "workspace.yaml");
    if (fs.existsSync(ws)) return ws;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// workspace.yaml は `company: <id>` の素朴な1行を読む(YAML パーサ依存を避ける)
function readCompanyId(wsPath) {
  if (!wsPath) return null;
  const m = fs.readFileSync(wsPath, "utf8").match(/^company:[ \t]*["']?([\w.-]+)["']?/m);
  return m ? m[1] : null;
}

function resolveTokens(deckPath) {
  const base = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "theme", "tokens.json"), "utf8"));
  let startDir = process.cwd();
  if (deckPath && fs.existsSync(deckPath)) {
    startDir = fs.statSync(deckPath).isDirectory() ? deckPath : path.dirname(path.resolve(deckPath));
  }
  const company = readCompanyId(findWorkspace(startDir));
  if (!company) return { tokens: base, company: null, packDir: null };

  const packDir = path.join(PLUGIN_ROOT, "companies", company);
  if (!fs.existsSync(packDir)) {
    console.error(`warn: 会社パックが見つかりません: companies/${company}(共通既定で続行)`);
    return { tokens: base, company, packDir: null };
  }
  const packTokensPath = path.join(packDir, "tokens.json");
  const tokens = fs.existsSync(packTokensPath)
    ? deepMerge(base, JSON.parse(fs.readFileSync(packTokensPath, "utf8")))
    : base;
  return { tokens, company, packDir };
}

module.exports = { resolveTokens, findWorkspace };

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = args.find((a) => a.startsWith("--"));
  const target = args.find((a) => !a.startsWith("--")) || ".";
  const r = resolveTokens(target);
  if (flag === "--company") process.stdout.write(r.company || "");
  else if (flag === "--packdir") process.stdout.write(r.packDir || "");
  else process.stdout.write(JSON.stringify(r.tokens, null, 2) + "\n");
}
