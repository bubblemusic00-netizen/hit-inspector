import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ═══════════════════════════════════════════════════════════════════════
// HIT INSPECTOR — Vite config
// ═══════════════════════════════════════════════════════════════════════
//
// The dev plugin below reads your Hit Engine's App.jsx from disk and
// serves its catalog data at /api/data. Re-reads on every request so
// live edits to App.jsx reflect immediately without restarting dev.
//
// Path resolution priority:
//   1. HIT_ENGINE_PATH environment variable (explicit override)
//   2. C:\hit-engine\src\App.jsx (your Windows default)
//   3. ~/hit-engine/src/App.jsx (Unix/Mac fallback)
//   4. Sibling dir: ../hit-engine/src/App.jsx (if repos are siblings)
// ═══════════════════════════════════════════════════════════════════════

function resolveHitEnginePath() {
  const env = process.env.HIT_ENGINE_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = [
    "C:\\hit-engine\\src\\App.jsx",
    path.join(os.homedir(), "hit-engine", "src", "App.jsx"),
    path.resolve(process.cwd(), "..", "hit-engine", "src", "App.jsx"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Extract top-level `const NAME = {...}` or `const NAME = [...]` from
// a JS/JSX source. Works by walking the source char-by-char tracking
// brace/bracket depth so we capture complete literals across many lines.
// Strings and comments are handled so braces inside them don't confuse
// the depth counter.
function extractConstDeclarations(source, wantedNames) {
  const result = {};
  const wanted = new Set(wantedNames);

  for (const name of wanted) {
    // Find `const NAME = ` at line start (top-level declaration)
    const re = new RegExp(`^const\\s+${name}\\s*=\\s*`, "m");
    const match = re.exec(source);
    if (!match) continue;
    const startIdx = match.index + match[0].length;
    const firstChar = source[startIdx];
    if (firstChar !== "{" && firstChar !== "[") continue;

    // Walk forward to find the matching closing brace/bracket, tracking
    // strings, template literals, and comments so nested delimiters
    // inside those don't break depth tracking.
    let depth = 0;
    let inString = null;   // quote char if inside string, else null
    let inLineComment = false;
    let inBlockComment = false;
    let i = startIdx;
    const len = source.length;

    while (i < len) {
      const ch = source[i];
      const next = source[i + 1];

      // Comment handling first (can contain braces that don't count)
      if (inLineComment) {
        if (ch === "\n") inLineComment = false;
        i++;
        continue;
      }
      if (inBlockComment) {
        if (ch === "*" && next === "/") { inBlockComment = false; i += 2; continue; }
        i++;
        continue;
      }
      if (inString !== null) {
        if (ch === "\\") { i += 2; continue; }  // skip escaped char
        if (ch === inString) { inString = null; }
        i++;
        continue;
      }
      // Entry into strings/comments
      if (ch === "/" && next === "/") { inLineComment = true; i += 2; continue; }
      if (ch === "/" && next === "*") { inBlockComment = true; i += 2; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { inString = ch; i++; continue; }

      // Depth tracking
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          // Include this closing char in the slice
          const literal = source.slice(startIdx, i + 1);
          try {
            // Evaluate as a JS literal. Because our source contains only
            // plain JSON-like data (arrays, objects, strings, numbers),
            // `new Function("return " + literal)()` safely produces the
            // live value. No React, no imports, no side effects.
            const value = new Function(`"use strict"; return (${literal});`)();
            result[name] = value;
          } catch (err) {
            result[name] = { __extractError: err.message, __literal: literal.slice(0, 200) };
          }
          break;
        }
      }
      i++;
    }
  }
  return result;
}

// The big list of things we want to pull out of Hit Engine's App.jsx.
// Adding a new name here + restarting dev server surfaces it in the
// inspector. The inspector UI references CATALOGS by logical category.
const WANTED_CONSTS = [
  // Core catalogs
  "GENRE_TREE",
  "MOODS", "MOOD_CATEGORIES",
  "ENERGIES",
  "GROOVES",
  "VOCALISTS",
  "LYRICAL_VIBES",
  "LANGUAGES",
  "HARMONIC_STYLES",
  "SOUND_TEXTURES",
  "MIX_CHARS",
  "SPECIFIC_INSTRUMENTS",
  // Complement tables (family relationships)
  "MOOD_COMPLEMENTS",
  "GROOVE_COMPLEMENTS",
  "LYRICAL_COMPLEMENTS",
  "ENERGY_COMPLEMENTS",
  "VOCALIST_COMPLEMENTS",
  "HARMONIC_COMPLEMENTS",
  "TEXTURE_COMPLEMENTS",
  "MIX_COMPLEMENTS",
  // Auxiliary
  "SUGGESTION_MAP",
  "GENRE_INTUITION",
  "TOP_5",
];

function hitEngineDataPlugin() {
  return {
    name: "hit-engine-data",
    configureServer(server) {
      server.middlewares.use("/api/data", (req, res) => {
        const sourcePath = resolveHitEnginePath();
        if (!sourcePath) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({
            error: "Hit Engine App.jsx not found",
            tried: [
              "HIT_ENGINE_PATH env var",
              "C:\\hit-engine\\src\\App.jsx",
              "~/hit-engine/src/App.jsx",
              "../hit-engine/src/App.jsx",
            ],
            hint: "Set HIT_ENGINE_PATH to the absolute path of your App.jsx",
          }));
          return;
        }
        try {
          const source = fs.readFileSync(sourcePath, "utf-8");
          const data = extractConstDeclarations(source, WANTED_CONSTS);
          const mtime = fs.statSync(sourcePath).mtime.toISOString();
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.setHeader("cache-control", "no-cache");
          res.end(JSON.stringify({
            sourcePath,
            sourceModified: mtime,
            sourceSize: source.length,
            data,
          }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: String(err && err.message), stack: err && err.stack }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), hitEngineDataPlugin()],
  server: {
    port: 5174,            // Hit Engine uses 5173; avoid clash if both run
    strictPort: false,
  },
});
