#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// BUILD-SNAPSHOT — runs once before deploy to bake Hit Engine data
// into a static JSON file the inspector can fetch from Vercel.
//
// Usage:
//   node scripts/build-snapshot.js
//   → reads C:\hit-engine\src\App.jsx (or $HIT_ENGINE_PATH)
//   → writes public/data.json
//
// The inspector React app fetches /data.json in production (Vercel
// serves public/ files at the site root) and /api/data in dev.
// ═══════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveHitEnginePath() {
  const env = process.env.HIT_ENGINE_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = [
    "C:\\hit-engine\\src\\App.jsx",
    path.join(os.homedir(), "hit-engine", "src", "App.jsx"),
    path.resolve(process.cwd(), "..", "hit-engine", "src", "App.jsx"),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return null;
}

function extractConstDeclarations(source, wantedNames) {
  const result = {};
  for (const name of wantedNames) {
    const re = new RegExp(`^const\\s+${name}\\s*=\\s*`, "m");
    const match = re.exec(source);
    if (!match) continue;
    const startIdx = match.index + match[0].length;
    const firstChar = source[startIdx];
    if (firstChar !== "{" && firstChar !== "[") continue;
    let depth = 0, inString = null, inLineComment = false, inBlockComment = false, i = startIdx;
    while (i < source.length) {
      const ch = source[i], next = source[i + 1];
      if (inLineComment) { if (ch === "\n") inLineComment = false; i++; continue; }
      if (inBlockComment) { if (ch === "*" && next === "/") { inBlockComment = false; i += 2; continue; } i++; continue; }
      if (inString !== null) { if (ch === "\\") { i += 2; continue; } if (ch === inString) inString = null; i++; continue; }
      if (ch === "/" && next === "/") { inLineComment = true; i += 2; continue; }
      if (ch === "/" && next === "*") { inBlockComment = true; i += 2; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { inString = ch; i++; continue; }
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          const literal = source.slice(startIdx, i + 1);
          try {
            result[name] = new Function(`"use strict"; return (${literal});`)();
          } catch (err) {
            result[name] = { __extractError: err.message };
          }
          break;
        }
      }
      i++;
    }
  }
  return result;
}

const WANTED_CONSTS = [
  "GENRE_TREE",
  "MOODS", "MOOD_CATEGORIES",
  "ENERGIES", "GROOVES",
  "VOCALISTS", "LYRICAL_VIBES",
  "LANGUAGES",
  "HARMONIC_STYLES", "SOUND_TEXTURES", "MIX_CHARS",
  "SPECIFIC_INSTRUMENTS",
  "MOOD_COMPLEMENTS", "GROOVE_COMPLEMENTS", "LYRICAL_COMPLEMENTS",
  "ENERGY_COMPLEMENTS", "VOCALIST_COMPLEMENTS", "HARMONIC_COMPLEMENTS",
  "TEXTURE_COMPLEMENTS", "MIX_COMPLEMENTS",
  "SUGGESTION_MAP", "GENRE_INTUITION", "TOP_5",
];

const sourcePath = resolveHitEnginePath();
if (!sourcePath) {
  console.error("ERROR: Could not find Hit Engine App.jsx");
  console.error("Tried:");
  console.error("  HIT_ENGINE_PATH env var");
  console.error("  C:\\hit-engine\\src\\App.jsx");
  console.error("  ~/hit-engine/src/App.jsx");
  console.error("  ../hit-engine/src/App.jsx");
  console.error("Set HIT_ENGINE_PATH to the absolute path of your App.jsx and retry.");
  process.exit(1);
}

console.log(`Reading: ${sourcePath}`);
const source = fs.readFileSync(sourcePath, "utf-8");
const data = extractConstDeclarations(source, WANTED_CONSTS);
const mtime = fs.statSync(sourcePath).mtime.toISOString();

const snapshot = {
  sourcePath,
  sourceModified: mtime,
  sourceSize: source.length,
  data,
};

// Write to public/data.json so Vite's static-file handling copies it
// into dist/ during build. Vercel serves public/ files at site root.
const publicDir = path.resolve(__dirname, "..", "public");
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
const outPath = path.join(publicDir, "data.json");
fs.writeFileSync(outPath, JSON.stringify(snapshot));

// Print summary
const extractedCount = Object.keys(data).filter(k => {
  const v = data[k];
  return v && !v.__extractError;
}).length;
const failed = Object.keys(data).filter(k => data[k] && data[k].__extractError);

console.log(`Wrote: ${outPath}`);
console.log(`  ${(source.length / 1024 / 1024).toFixed(2)} MB source`);
console.log(`  ${extractedCount}/${WANTED_CONSTS.length} constants extracted`);
if (failed.length > 0) {
  console.warn(`  WARNINGS — these constants failed to parse:`);
  for (const f of failed) console.warn(`    ${f}: ${data[f].__extractError}`);
}
console.log("Done. You can now run: npm run build");
