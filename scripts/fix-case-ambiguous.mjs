#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
 * fix-case-ambiguous.mjs
 *
 * Fixes the `case-ambiguous-gi` validator errors: two GENRE_INTUITION
 * entries exist for what should be one subgenre (e.g. "Dark Plugg" and
 * "dark plugg"). Object.keys order decides which one wins when code
 * looks up the name, so pairings are intermittently wrong.
 *
 * What it does:
 *   1. Reads public/data.json to find case-ambiguous pairs
 *   2. Picks a canonical casing (tree match first, else title case)
 *   3. Merges the entries: union of array fields, widest bpmRange
 *   4. Rewrites the canonical entry's body in HitEngine.jsx with the
 *      merged content, then deletes the non-canonical sibling(s)
 *
 * Run:
 *   npm run snapshot                                # refresh data.json first
 *   node scripts/fix-case-ambiguous.mjs --dry-run   # preview
 *   node scripts/fix-case-ambiguous.mjs             # apply
 *   node scripts/fix-case-ambiguous.mjs --engine=C:/path/to/App.jsx
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

// Canonical field order (matches what's in existing GI entries)
const FIELD_ORDER = [
  "bpmRange", "grooves", "harmonics", "textures",
  "mixes", "energies", "moods", "instrumentKeywords",
];

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

const treeSubs = new Set();
for (const subs of Object.values(tree)) {
  for (const s of Object.keys(subs || {})) treeSubs.add(s);
}

// ── Find case-ambiguous pairs and compute merges ───────────────────
const byLower = {};
for (const k of Object.keys(gi)) {
  const kl = k.toLowerCase();
  (byLower[kl] ||= []).push(k);
}

const merges = [];
for (const variants of Object.values(byLower)) {
  if (variants.length < 2) continue;

  // Pick canonical: tree match first, else title-cased, else first
  let canonical = variants.find(v => treeSubs.has(v));
  if (!canonical) canonical = variants.find(v => v[0] !== v[0].toLowerCase());
  if (!canonical) canonical = variants[0];
  const nonCanonical = variants.filter(v => v !== canonical);

  // Merge array fields (union, dedup, preserve first-seen order).
  // bpmRange: widen (min of mins, max of maxes).
  const merged = {};
  const allFields = new Set();
  for (const v of variants) {
    const e = gi[v];
    if (e && typeof e === "object") for (const f of Object.keys(e)) allFields.add(f);
  }
  for (const field of allFields) {
    if (field === "bpmRange") {
      const mins = [], maxs = [];
      for (const v of variants) {
        const arr = gi[v]?.bpmRange;
        if (Array.isArray(arr) && arr.length >= 2) {
          if (typeof arr[0] === "number") mins.push(arr[0]);
          if (typeof arr[1] === "number") maxs.push(arr[1]);
        }
      }
      if (mins.length && maxs.length) merged.bpmRange = [Math.min(...mins), Math.max(...maxs)];
    } else {
      const seen = new Set(), out = [];
      for (const v of variants) {
        const arr = gi[v]?.[field];
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (!seen.has(item)) { seen.add(item); out.push(item); }
        }
      }
      merged[field] = out;
    }
  }

  merges.push({ canonical, nonCanonical, mergedEntry: merged });
}

console.log(`Case-ambiguous pairs to merge: ${merges.length}`);
for (const m of merges) {
  const orig = [m.canonical, ...m.nonCanonical].map(v =>
    `"${v}" (${Object.keys(gi[v] || {}).length} fields)`).join(" + ");
  console.log(`  ${orig}  →  "${m.canonical}"`);
}
if (merges.length === 0) { console.log(`\nNothing to do.`); process.exit(0); }

// ── Open HitEngine.jsx ────────────────────────────────────────────
if (!existsSync(HIT_ENGINE_PATH)) {
  console.error(`\n✗ HitEngine.jsx not found at ${HIT_ENGINE_PATH}`);
  console.error(`  Pass --engine=path or set HIT_ENGINE_PATH env var.`);
  process.exit(2);
}
const src = readFileSync(HIT_ENGINE_PATH, "utf8");

// Locate the `const GENRE_INTUITION = {...}` block
function findGIBlockBounds(text) {
  const decl = text.match(/const\s+GENRE_INTUITION\s*=\s*\{/);
  if (!decl) return null;
  const openBrace = text.indexOf("{", decl.index);
  let depth = 0, inStr = false, strCh = "", esc = false;
  for (let i = openBrace; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { start: decl.index, blockStart: openBrace, end: i + 1 };
    }
  }
  return null;
}

const bounds = findGIBlockBounds(src);
if (!bounds) {
  console.error(`✗ Could not locate \`const GENRE_INTUITION = {\` in ${HIT_ENGINE_PATH}`);
  process.exit(2);
}

// Isolate the block so we can mutate it without offset drift
const before = src.slice(0, bounds.start);
let giBlock = src.slice(bounds.start, bounds.end);
const after = src.slice(bounds.end);

// ── Helpers for finding an entry within the GI block text ──────────
function findEntryRange(text, key) {
  const re = new RegExp(`(\\n)(\\s+)"${escapeRegex(key)}"(\\s*:\\s*)\\{`, "g");
  const m = re.exec(text);
  if (!m) return null;
  const lineStart = m.index + 1;            // right after the leading \n
  const bodyStart = text.indexOf("{", m.index);
  let depth = 0, inStr = false, strCh = "", esc = false;
  for (let i = bodyStart; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === strCh) inStr = false; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = true; strCh = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const bodyEnd = i + 1;
        let tailEnd = bodyEnd;
        if (text[tailEnd] === ",") tailEnd++;
        if (text[tailEnd] === "\n") tailEnd++;
        else if (text[tailEnd] === "\r" && text[tailEnd + 1] === "\n") tailEnd += 2;
        return { lineStart, bodyStart, bodyEnd, tailEnd, indent: m[2] };
      }
    }
  }
  return null;
}

function serializeValue(v) {
  if (Array.isArray(v)) return "[" + v.map(serializeValue).join(", ") + "]";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}
function serializeEntry(entry, innerIndent) {
  const lines = [];
  for (const key of FIELD_ORDER) {
    if (!(key in entry)) continue;
    lines.push(innerIndent + key + ": " + serializeValue(entry[key]) + ",");
  }
  for (const key of Object.keys(entry)) {
    if (FIELD_ORDER.includes(key)) continue;
    lines.push(innerIndent + key + ": " + serializeValue(entry[key]) + ",");
  }
  // Close brace sits at outer indent (2 spaces less than inner)
  const closeIndent = innerIndent.length >= 2 ? innerIndent.slice(2) : "";
  return "{\n" + lines.join("\n") + "\n" + closeIndent + "}";
}

// ── Apply each merge ───────────────────────────────────────────────
let appliedCount = 0;
const problems = [];

for (const { canonical, nonCanonical, mergedEntry } of merges) {
  // 1. Find and replace canonical body with merged content
  const canRange = findEntryRange(giBlock, canonical);
  if (!canRange) {
    problems.push(`canonical "${canonical}" not found`);
    continue;
  }
  const innerIndent = canRange.indent + "  ";  // entries are 2 spaces; fields are 4
  const newBody = serializeEntry(mergedEntry, innerIndent);
  giBlock = giBlock.slice(0, canRange.bodyStart) + newBody + giBlock.slice(canRange.bodyEnd);

  // 2. Delete each non-canonical entry (search freshly since offsets shifted)
  for (const nc of nonCanonical) {
    const ncRange = findEntryRange(giBlock, nc);
    if (!ncRange) {
      problems.push(`non-canonical "${nc}" not found`);
      continue;
    }
    giBlock = giBlock.slice(0, ncRange.lineStart) + giBlock.slice(ncRange.tailEnd);
  }
  appliedCount++;
}

console.log(``);
console.log(`Applied merges:     ${appliedCount}/${merges.length}`);
if (problems.length) {
  console.log(`Problems:`);
  for (const p of problems) console.log(`  ⚠ ${p}`);
}

if (appliedCount === 0) { console.log(`\nNo changes made.`); process.exit(0); }

if (dryRun) {
  console.log(`\n--dry-run: no file written. Remove the flag to apply.`);
  process.exit(0);
}

// ── Write backup + new file ────────────────────────────────────────
const bakPath = HIT_ENGINE_PATH + ".bak";
writeFileSync(bakPath, src);
console.log(`Backup written:     ${bakPath}`);

const newSrc = before + giBlock + after;
writeFileSync(HIT_ENGINE_PATH, newSrc);
console.log(`Patched:            ${HIT_ENGINE_PATH}`);
console.log(`Size delta:         ${newSrc.length - src.length} bytes`);

console.log(``);
console.log(`Next steps:`);
console.log(`  cd C:\\hit-engine`);
console.log(`  git diff src/App.jsx                                   # review`);
console.log(`  git add src/App.jsx`);
console.log(`  git commit -m "merge ${appliedCount} case-ambiguous GENRE_INTUITION entries"`);
console.log(`  git push origin main`);
console.log(``);
console.log(`Then in hit-inspector:`);
console.log(`  npm run snapshot`);
console.log(`  npm run validate            # case-ambiguous-gi should drop to 0`);
console.log(``);
console.log(`If the diff looks wrong, roll back with:`);
console.log(`  copy /Y "${bakPath}" "${HIT_ENGINE_PATH}"`);
