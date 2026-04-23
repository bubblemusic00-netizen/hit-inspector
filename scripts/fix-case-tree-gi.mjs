#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
 * fix-case-tree-gi.mjs
 *
 * Fixes the `case-tree-gi` validator errors: subgenres where GENRE_TREE
 * uses a capitalized name ("Trap") but GENRE_INTUITION stores them in
 * lowercase ("trap"), so the app silently gets `undefined` when it looks
 * up pairing data for those subgenres.
 *
 * What it does:
 *   1. Reads public/data.json to figure out which GI keys need renaming
 *   2. Backs up HitEngine.jsx to HitEngine.jsx.bak
 *   3. Locates the `const GENRE_INTUITION = {...}` block
 *   4. Renames only the key-definition lines inside that block
 *   5. Reports what changed and what to do next
 *
 * Dry-run supported via --dry-run (shows what would change, writes nothing).
 *
 * Run:
 *   npm run snapshot                                     # refresh data.json first
 *   node scripts/fix-case-tree-gi.mjs --dry-run          # preview
 *   node scripts/fix-case-tree-gi.mjs                    # apply
 *   node scripts/fix-case-tree-gi.mjs --engine=C:/path/to/App.jsx
 * ════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const engineArg = args.find(a => a.startsWith("--engine="));
const dataArg = args.find(a => a.startsWith("--data="));

const HIT_ENGINE_PATH = engineArg
  ? engineArg.slice("--engine=".length)
  : (process.env.HIT_ENGINE_PATH || "C:/hit-engine/src/App.jsx");
const DATA_PATH = dataArg
  ? dataArg.slice("--data=".length)
  : "./public/data.json";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Load data.json ────────────────────────────────────────────────
if (!existsSync(resolve(DATA_PATH))) {
  console.error(`✗ Cannot find data.json at ${DATA_PATH}`);
  console.error(`  Run \`npm run snapshot\` first to generate it.`);
  process.exit(2);
}
const rawData = JSON.parse(readFileSync(resolve(DATA_PATH), "utf8"));
const data = rawData && rawData.data ? rawData.data : rawData;

const tree = data.GENRE_TREE || {};
const gi = data.GENRE_INTUITION || {};

// Collect subgenres from tree
const treeSubs = new Set();
for (const subs of Object.values(tree)) {
  for (const s of Object.keys(subs || {})) treeSubs.add(s);
}

// Lowercase → original casing map for GI keys
const giLower = new Map();
for (const k of Object.keys(gi)) {
  const kl = k.toLowerCase();
  // If multiple GI keys map to same lowercase, that's case-ambiguous (different
  // check). Skip those here — this script only handles single-variant mismatch.
  if (giLower.has(kl)) giLower.set(kl, null);
  else giLower.set(kl, k);
}

// Find renames needed
const renames = [];
for (const sub of treeSubs) {
  if (gi[sub]) continue;                           // already correctly cased
  const existing = giLower.get(sub.toLowerCase());
  if (!existing) continue;                         // no GI entry at all
  if (existing === sub) continue;                  // already matches
  renames.push([existing, sub]);
}

console.log(`Renames detected from data.json: ${renames.length}`);
for (const [o, n] of renames) console.log(`  "${o}"  →  "${n}"`);
if (renames.length === 0) {
  console.log(`\nNothing to do. GENRE_INTUITION keys already match tree casing.`);
  process.exit(0);
}

// ── Open HitEngine.jsx ────────────────────────────────────────────
if (!existsSync(HIT_ENGINE_PATH)) {
  console.error(`\n✗ HitEngine.jsx not found at ${HIT_ENGINE_PATH}`);
  console.error(`  Pass --engine=path or set HIT_ENGINE_PATH env var.`);
  process.exit(2);
}

const src = readFileSync(HIT_ENGINE_PATH, "utf8");

// Locate `const GENRE_INTUITION = {`
const giDeclRegex = /const\s+GENRE_INTUITION\s*=\s*\{/;
const match = src.match(giDeclRegex);
if (!match) {
  console.error(`✗ Could not find \`const GENRE_INTUITION = {\` in ${HIT_ENGINE_PATH}`);
  process.exit(2);
}
const giStart = match.index;
const giOpenBrace = src.indexOf("{", giStart);

// Walk brace depth to find matching close (skipping strings)
let depth = 0;
let giEnd = -1;
let inString = false;
let stringChar = "";
let escape = false;
for (let i = giOpenBrace; i < src.length; i++) {
  const c = src[i];
  if (escape) { escape = false; continue; }
  if (c === "\\") { escape = true; continue; }
  if (inString) {
    if (c === stringChar) inString = false;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") { inString = true; stringChar = c; continue; }
  if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) { giEnd = i; break; }
  }
}
if (giEnd === -1) {
  console.error(`✗ Could not find end of GENRE_INTUITION block`);
  process.exit(2);
}

const before = src.slice(0, giStart);
const giBlock = src.slice(giStart, giEnd + 1);
const after = src.slice(giEnd + 1);

// ── Apply renames only on key-definition lines ────────────────────
let modifiedGi = giBlock;
let applied = 0;
const skipped = [];
for (const [oldKey, newKey] of renames) {
  // A GI key definition looks like:  \n<indent>"oldkey": {
  // We require start-of-line + whitespace + quoted key + colon + {.
  const regex = new RegExp(
    `(\\n\\s+)"${escapeRegex(oldKey)}"(\\s*:\\s*\\{)`,
    "g"
  );
  const matches = [...modifiedGi.matchAll(regex)];
  if (matches.length === 0) {
    skipped.push([oldKey, "not found as a key definition inside block"]);
    continue;
  }
  if (matches.length > 1) {
    skipped.push([oldKey, `matched ${matches.length} times — expected exactly 1`]);
    continue;
  }
  modifiedGi = modifiedGi.replace(regex, `$1"${newKey}"$2`);
  applied++;
}

console.log(``);
console.log(`Found block:        bytes ${giStart.toLocaleString()} – ${giEnd.toLocaleString()}`);
console.log(`Applied renames:    ${applied}/${renames.length}`);
if (skipped.length) {
  console.log(`Skipped:`);
  for (const [k, reason] of skipped) console.log(`  "${k}" — ${reason}`);
}

if (applied === 0) {
  console.log(`\nNo changes made.`);
  process.exit(0);
}

if (dryRun) {
  console.log(``);
  console.log(`--dry-run: no file written. Remove the flag to apply.`);
  process.exit(0);
}

// ── Write: backup first, then patched file ────────────────────────
const bakPath = HIT_ENGINE_PATH + ".bak";
writeFileSync(bakPath, src);
console.log(`Backup written:     ${bakPath}`);

const newSrc = before + modifiedGi + after;
writeFileSync(HIT_ENGINE_PATH, newSrc);
console.log(`Patched:            ${HIT_ENGINE_PATH}`);
console.log(`Size delta:         ${(newSrc.length - src.length)} bytes`);

console.log(``);
console.log(`Next steps:`);
console.log(`  cd C:\\hit-engine`);
console.log(`  git diff src/App.jsx                                 # review`);
console.log(`  git add src/App.jsx`);
console.log(`  git commit -m "fix ${applied} GENRE_INTUITION case mismatches"`);
console.log(`  git push origin main`);
console.log(``);
console.log(`Then in hit-inspector:`);
console.log(`  npm run snapshot`);
console.log(`  npm run validate          # case-tree-gi should drop to 0`);
console.log(``);
console.log(`If the diff looks wrong, roll back with:`);
console.log(`  copy /Y "${bakPath}" "${HIT_ENGINE_PATH}"`);
