#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
 * validate-data.mjs  —  Hit Engine data integrity validator
 *
 * Step 1 of the "real database" plan. Reads the catalog JSON and asserts
 * every invariant it should obey. Reports anything broken, suspicious, or
 * inconsistent, grouped by severity. Exits non-zero on errors so it can
 * be wired into CI, pre-commit, or a pre-deploy guard.
 *
 * Run:
 *   node scripts/validate-data.mjs                       # uses ./public/data.json
 *   node scripts/validate-data.mjs path/to/data.json
 *   node scripts/validate-data.mjs --full                # print every offender
 *
 * No external dependencies. Pure Node stdlib.
 * ════════════════════════════════════════════════════════════════════════ */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const showFull = args.includes("--full");
const pathArg = args.find(a => !a.startsWith("--"));
const candidates = pathArg
  ? [pathArg]
  : ["./public/data.json", "./data.json", "./src/data.json"];

let dataPath = null;
for (const p of candidates) {
  if (existsSync(resolve(p))) { dataPath = resolve(p); break; }
}
if (!dataPath) {
  if (pathArg) {
    console.error(`✗ File not found: ${pathArg}`);
    console.error(`  Resolved to: ${resolve(pathArg)}`);
  } else {
    console.error(`✗ Could not find data.json. Tried:`);
    for (const p of candidates) console.error(`    ${resolve(p)}`);
    console.error(`  Run \`npm run snapshot\` first to generate public/data.json,`);
    console.error(`  or pass a path explicitly: node scripts/validate-data.mjs path/to/data.json`);
  }
  process.exit(2);
}

let raw;
try {
  raw = JSON.parse(readFileSync(dataPath, "utf8"));
} catch (e) {
  console.error(`✗ Failed to parse ${dataPath}: ${e.message}`);
  process.exit(2);
}

// Data may be wrapped { sourcePath, sourceModified, data: {...} } or flat
const data = raw && typeof raw === "object" && raw.data ? raw.data : raw;

// ════════════════════════════════════════════════════════════════════════
// SCHEMA MAP — the single source of truth for category → vocab relationships.
// Every check below reads from this, so adding a new category is one edit.
// ════════════════════════════════════════════════════════════════════════

const VOCABS = {
  MOODS:           { key: "MOODS",           kind: "strings" },
  ENERGIES:        { key: "ENERGIES",        kind: "strings" },
  GROOVES:         { key: "GROOVES",         kind: "objects", idField: "id",   labelField: "label" },
  VOCALISTS:       { key: "VOCALISTS",       kind: "strings" },
  LYRICAL_VIBES:   { key: "LYRICAL_VIBES",   kind: "strings" },
  HARMONIC_STYLES: { key: "HARMONIC_STYLES", kind: "strings" },
  SOUND_TEXTURES:  { key: "SOUND_TEXTURES",  kind: "strings" },
  MIX_CHARS:       { key: "MIX_CHARS",       kind: "strings" },
  LANGUAGES:       { key: "LANGUAGES",       kind: "objects", idField: "code", labelField: "label" },
};

// The 8 complement tables. Each entry: table name → self vocab.
// Each complement entry's inner fields point at other vocabs via FIELD_TO_VOCAB.
const COMPLEMENT_TABLES = [
  { table: "MOOD_COMPLEMENTS",     selfVocab: "MOODS",           selfField: "mood" },
  { table: "ENERGY_COMPLEMENTS",   selfVocab: "ENERGIES",        selfField: "energy" },
  { table: "GROOVE_COMPLEMENTS",   selfVocab: "GROOVES",         selfField: "groove" },
  { table: "VOCALIST_COMPLEMENTS", selfVocab: "VOCALISTS",       selfField: "vocalist" },
  { table: "LYRICAL_COMPLEMENTS",  selfVocab: "LYRICAL_VIBES",   selfField: "lyricalVibe" },
  { table: "HARMONIC_COMPLEMENTS", selfVocab: "HARMONIC_STYLES", selfField: "harmonic" },
  { table: "TEXTURE_COMPLEMENTS",  selfVocab: "SOUND_TEXTURES",  selfField: "texture" },
  { table: "MIX_COMPLEMENTS",      selfVocab: "MIX_CHARS",       selfField: "mix" },
];
const FIELD_TO_VOCAB = Object.fromEntries(COMPLEMENT_TABLES.map(t => [t.selfField, t.selfVocab]));
const VOCAB_TO_TABLE = Object.fromEntries(COMPLEMENT_TABLES.map(t => [t.selfVocab, t.table]));
const VOCAB_TO_FIELD = Object.fromEntries(COMPLEMENT_TABLES.map(t => [t.selfVocab, t.selfField]));

// GENRE_INTUITION field names (the per-subgenre shape)
const GI_VOCAB_FIELDS = [
  { field: "moods",      vocab: "MOODS" },
  { field: "energies",   vocab: "ENERGIES" },
  { field: "grooves",    vocab: "GROOVES" },
  { field: "harmonics",  vocab: "HARMONIC_STYLES" },
  { field: "textures",   vocab: "SOUND_TEXTURES" },
  { field: "mixes",      vocab: "MIX_CHARS" },
];

// ════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════

function vocabIds(data, vocab) {
  const v = VOCABS[vocab];
  const raw = data[v.key] || [];
  if (v.kind === "strings") return new Set(raw);
  return new Set(raw.map(o => o[v.idField]));
}

function allVocabSets(data) {
  const out = {};
  for (const name of Object.keys(VOCABS)) out[name] = vocabIds(data, name);
  return out;
}

function collectTreeNodes(tree) {
  const bigs = new Set(), mids = new Set(), smalls = new Set();
  const midByName = {}, smallByName = {};
  for (const [big, subs] of Object.entries(tree || {})) {
    bigs.add(big);
    for (const [mid, micros] of Object.entries(subs || {})) {
      mids.add(mid); midByName[mid] = big;
      if (Array.isArray(micros)) {
        for (const m of micros) { smalls.add(m); smallByName[m] = mid; }
      }
    }
  }
  return { bigs, mids, smalls, midByName, smallByName };
}

// Levenshtein distance, capped early
function lev(a, b, max = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length > b.length) [a, b] = [b, a];
  let prev = Array(a.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    const curr = [i];
    let minRow = i;
    for (let j = 1; j <= a.length; j++) {
      const c = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1),
      );
      curr.push(c);
      if (c < minRow) minRow = c;
    }
    if (minRow > max) return max + 1;
    prev = curr;
  }
  return prev[a.length];
}

// ════════════════════════════════════════════════════════════════════════
// CHECKS
//
// Each check returns:
//   { severity, code, title, description, examples: [string], count }
// ════════════════════════════════════════════════════════════════════════

// ── 1. Referential integrity in complement tables ─────────────────
function checkComplementReferentialIntegrity(data) {
  const vocabs = allVocabSets(data);
  const bad = [];
  for (const { table, selfVocab } of COMPLEMENT_TABLES) {
    const t = data[table] || {};
    for (const [key, entry] of Object.entries(t)) {
      // Key itself must be in self vocab
      if (!vocabs[selfVocab].has(key)) {
        bad.push(`${table}["${key}"] — key not in ${selfVocab}`);
      }
      // Each field inside must reference real vocab items
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        for (const [field, values] of Object.entries(entry)) {
          const tgt = FIELD_TO_VOCAB[field];
          if (!tgt || !Array.isArray(values)) continue;
          for (const v of values) {
            if (!vocabs[tgt].has(v)) {
              bad.push(`${table}["${key}"].${field} → "${v}" not in ${tgt}`);
            }
          }
        }
      }
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "complement-refs",
    title: "Referential integrity of complement tables",
    description: "Every key in a complement table must exist in that table's self-vocab. Every value in an entry's field must exist in the referenced vocab.",
    examples: bad,
    count: bad.length,
  };
}

// ── 2. Referential integrity in GENRE_INTUITION ───────────────────
function checkGIReferentialIntegrity(data) {
  const vocabs = allVocabSets(data);
  const gi = data.GENRE_INTUITION || {};
  const bad = [];
  for (const [key, entry] of Object.entries(gi)) {
    if (!entry || typeof entry !== "object") continue;
    for (const { field, vocab } of GI_VOCAB_FIELDS) {
      const vals = entry[field];
      if (!Array.isArray(vals)) continue;
      for (const v of vals) {
        if (!vocabs[vocab].has(v)) {
          bad.push(`GENRE_INTUITION["${key}"].${field} → "${v}" not in ${vocab}`);
        }
      }
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "gi-refs",
    title: "Referential integrity of GENRE_INTUITION",
    description: "Every value referenced in a GENRE_INTUITION entry's moods/energies/grooves/harmonics/textures/mixes must exist in the corresponding vocabulary.",
    examples: bad,
    count: bad.length,
  };
}

// ── 3. Case mismatch between GENRE_TREE and GENRE_INTUITION ───────
function checkCaseMismatchTreeGI(data) {
  const tree = data.GENRE_TREE || {};
  const gi = data.GENRE_INTUITION || {};
  const giKeys = Object.keys(gi);
  const giLower = new Map(giKeys.map(k => [k.toLowerCase(), k]));
  const bad = [];
  const { mids } = collectTreeNodes(tree);
  for (const sub of mids) {
    if (!gi[sub]) {
      const ciMatch = giLower.get(sub.toLowerCase());
      if (ciMatch) {
        bad.push(`GENRE_TREE has "${sub}" → GENRE_INTUITION only has "${ciMatch}"`);
      }
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "case-tree-gi",
    title: "Tree uses different casing than GENRE_INTUITION",
    description: "GENRE_TREE uses a capitalized subgenre name but GENRE_INTUITION only stores the lowercase variant. The app silently gets undefined when it looks up by the tree key, so attribute pairings vanish for that subgenre.",
    examples: bad,
    count: bad.length,
  };
}

// ── 4. Case-ambiguous keys within GENRE_INTUITION ─────────────────
function checkCaseAmbiguousGI(data) {
  const gi = data.GENRE_INTUITION || {};
  const byLower = {};
  for (const k of Object.keys(gi)) {
    const kl = k.toLowerCase();
    (byLower[kl] ||= []).push(k);
  }
  const bad = [];
  for (const [, variants] of Object.entries(byLower)) {
    if (variants.length > 1) {
      bad.push(`${variants.map(v => `"${v}"`).join(" vs ")}`);
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "case-ambiguous-gi",
    title: "Two GENRE_INTUITION entries that differ only by case",
    description: "Two keys resolve to the same subgenre (e.g. \"Dark Plugg\" and \"dark plugg\"). Object.keys order decides which one wins when code looks up case-insensitively. Merge them and keep one canonical casing.",
    examples: bad,
    count: bad.length,
  };
}

// ── 5. Missing GI coverage for subgenres (even case-insensitive) ──
function checkMissingGI(data) {
  const tree = data.GENRE_TREE || {};
  const gi = data.GENRE_INTUITION || {};
  const giLower = new Set(Object.keys(gi).map(k => k.toLowerCase()));
  const bad = [];
  const { mids, midByName } = collectTreeNodes(tree);
  for (const sub of mids) {
    if (!gi[sub] && !giLower.has(sub.toLowerCase())) {
      bad.push(`[${midByName[sub]}] "${sub}" has no GENRE_INTUITION entry`);
    }
  }
  return {
    severity: bad.length ? "warning" : "info",
    code: "missing-gi",
    title: "Subgenres with no GENRE_INTUITION data",
    description: "The subgenre exists in the tree but nothing in GENRE_INTUITION describes its moods, grooves, harmonics, etc. Hit Engine can't generate informed prompts for this subgenre.",
    examples: bad,
    count: bad.length,
  };
}

// ── 6. Duplicate values within GI arrays ──────────────────────────
function checkDuplicateValues(data) {
  const gi = data.GENRE_INTUITION || {};
  const bad = [];
  for (const [key, entry] of Object.entries(gi)) {
    if (!entry || typeof entry !== "object") continue;
    for (const { field } of GI_VOCAB_FIELDS) {
      const vals = entry[field];
      if (!Array.isArray(vals)) continue;
      const seen = new Set(), dups = new Set();
      for (const v of vals) {
        if (seen.has(v)) dups.add(v);
        seen.add(v);
      }
      if (dups.size) {
        bad.push(`GI["${key}"].${field}: duplicate values ${[...dups].map(d => `"${d}"`).join(", ")}`);
      }
    }
  }
  return {
    severity: bad.length ? "warning" : "info",
    code: "duplicate-values",
    title: "Duplicate values inside a GENRE_INTUITION array",
    description: "An array like GI[\"Neo-Soul\"].harmonics contains the same value twice. Probably a paste error. Harmless at runtime but clutters the data and inflates apparent coverage.",
    examples: bad,
    count: bad.length,
  };
}

// ── 7. Orphan GI entries (key is not a real subgenre or microstyle) ──
function checkOrphanGI(data) {
  const tree = data.GENRE_TREE || {};
  const gi = data.GENRE_INTUITION || {};
  const { mids, smalls } = collectTreeNodes(tree);
  const known = new Set([...mids, ...smalls]);
  const knownLower = new Set([...known].map(k => k.toLowerCase()));
  const bad = [];
  for (const key of Object.keys(gi)) {
    if (!known.has(key) && !knownLower.has(key.toLowerCase())) {
      bad.push(`"${key}"`);
    }
  }
  return {
    severity: bad.length ? "warning" : "info",
    code: "orphan-gi",
    title: "GENRE_INTUITION keys that are not in the tree",
    description: "These entries describe some name that doesn't exist in GENRE_TREE as a subgenre OR microstyle (case-insensitive). They may be cruft from deleted subgenres, drafts that were never promoted, or typos. The app never reads them.",
    examples: bad,
    count: bad.length,
  };
}

// ── 8. Symmetry of pairings (one-way complements) ────────────────
function checkOneWayPairings(data) {
  const direction = {};
  for (const { table: srcTable, selfVocab: srcVocab, selfField: srcField } of COMPLEMENT_TABLES) {
    const src = data[srcTable] || {};
    for (const [srcKey, entry] of Object.entries(src)) {
      if (!entry || typeof entry !== "object") continue;
      for (const [field, values] of Object.entries(entry)) {
        const tgtVocab = FIELD_TO_VOCAB[field];
        if (!tgtVocab || !Array.isArray(values)) continue;
        const tgtTable = VOCAB_TO_TABLE[tgtVocab];
        const tgt = data[tgtTable] || {};
        for (const v of values) {
          const recip = (tgt[v] || {})[srcField];
          if (!Array.isArray(recip) || !recip.includes(srcKey)) {
            const k = `${srcVocab} → ${tgtVocab}`;
            direction[k] = (direction[k] || 0) + 1;
          }
        }
      }
    }
  }
  const total = Object.values(direction).reduce((a, b) => a + b, 0);
  const examples = Object.entries(direction)
    .sort((a, b) => b[1] - a[1])
    .map(([dir, n]) => `${dir}: ${n} one-way`);
  return {
    severity: total > 0 ? "warning" : "info",
    code: "one-way-pairings",
    title: "Asymmetric complement pairings",
    description: "Complement A says B is a pair, but B's entry doesn't list A back. Some may be deliberate (not every pairing is reciprocal) but consistent asymmetry usually indicates drift between tables.",
    examples,
    count: total,
  };
}

// ── 9. Near-duplicate vocab items ─────────────────────────────────
function checkNearDuplicateVocab(data) {
  const bad = [];
  // LANGUAGES uses 2-letter ISO codes; "en" vs "es" collide trivially
  // and mean nothing. Only check on vocabs where items are ≥ 4 chars.
  const SKIP = new Set(["LANGUAGES"]);
  for (const vocab of Object.keys(VOCABS)) {
    if (SKIP.has(vocab)) continue;
    const ids = [...vocabIds(data, vocab)].filter(id => id.length >= 4);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const d = lev(ids[i].toLowerCase(), ids[j].toLowerCase(), 2);
        if (d <= 1 && ids[i] !== ids[j]) {
          bad.push(`${vocab}: "${ids[i]}" ↔ "${ids[j]}" (distance ${d})`);
        }
      }
    }
  }
  return {
    severity: bad.length ? "warning" : "info",
    code: "near-dup-vocab",
    title: "Near-duplicate vocabulary items",
    description: "Two items with almost identical names (Levenshtein distance ≤ 1 case-insensitive). Usually a typo or an accidental duplicate entry.",
    examples: bad,
    count: bad.length,
  };
}

// ── 10. Whitespace issues ─────────────────────────────────────────
function checkWhitespace(data) {
  const bad = [];
  for (const vocab of Object.keys(VOCABS)) {
    for (const id of vocabIds(data, vocab)) {
      if (id !== id.trim()) bad.push(`${vocab}: "${id}" has leading/trailing whitespace`);
      else if (/\s{2,}/.test(id)) bad.push(`${vocab}: "${id}" contains double whitespace`);
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "whitespace",
    title: "Whitespace anomalies in vocab IDs",
    description: "IDs that start/end with whitespace or contain doubled whitespace will silently fail lookups.",
    examples: bad,
    count: bad.length,
  };
}

// ── 11. MOOD_CATEGORIES coverage of MOODS ─────────────────────────
function checkMoodCategoriesCoverage(data) {
  const moods = vocabIds(data, "MOODS");
  const cats = data.MOOD_CATEGORIES || [];
  const all = [];
  for (const c of cats) for (const item of (c.items || [])) all.push(item);
  const categorized = new Set(all);
  const bad = [];
  const dups = all.length - categorized.size;
  for (const m of moods) if (!categorized.has(m)) bad.push(`"${m}" in MOODS but in no MOOD_CATEGORIES group`);
  for (const m of categorized) if (!moods.has(m)) bad.push(`"${m}" in MOOD_CATEGORIES but not in MOODS`);
  if (dups > 0) bad.push(`${dups} mood(s) appear in multiple MOOD_CATEGORIES groups`);
  return {
    severity: bad.length ? "error" : "info",
    code: "mood-categories",
    title: "MOOD_CATEGORIES coverage of MOODS",
    description: "Every mood in MOODS should appear in exactly one MOOD_CATEGORIES group. Any mismatch means the Moods map will have items that can't be grouped.",
    examples: bad,
    count: bad.length,
  };
}

// ── 12. Vocab items with zero references anywhere ─────────────────
function checkOrphanVocab(data) {
  const gi = data.GENRE_INTUITION || {};
  const bad = [];
  for (const vocab of Object.keys(VOCABS)) {
    if (vocab === "LANGUAGES") continue; // languages have no pairings; skip
    const ids = vocabIds(data, vocab);
    const referenced = new Set();
    // Referenced from complement tables (as self-keys AND as values elsewhere)
    const ownTable = data[VOCAB_TO_TABLE[vocab]] || {};
    for (const k of Object.keys(ownTable)) referenced.add(k);
    const srcField = VOCAB_TO_FIELD[vocab];
    for (const { table } of COMPLEMENT_TABLES) {
      const t = data[table] || {};
      for (const entry of Object.values(t)) {
        if (entry && typeof entry === "object") {
          const vals = entry[srcField];
          if (Array.isArray(vals)) for (const v of vals) referenced.add(v);
        }
      }
    }
    // Referenced from GENRE_INTUITION
    const giField = GI_VOCAB_FIELDS.find(f => f.vocab === vocab)?.field;
    if (giField) {
      for (const entry of Object.values(gi)) {
        if (entry && typeof entry === "object") {
          const vals = entry[giField];
          if (Array.isArray(vals)) for (const v of vals) referenced.add(v);
        }
      }
    }
    for (const id of ids) {
      if (!referenced.has(id)) bad.push(`${vocab}: "${id}" has zero references anywhere`);
    }
  }
  return {
    severity: bad.length ? "warning" : "info",
    code: "orphan-vocab",
    title: "Vocabulary items referenced nowhere",
    description: "A vocab item that isn't mentioned in any complement table or GENRE_INTUITION — effectively dead weight. Either add pairings or remove it.",
    examples: bad,
    count: bad.length,
  };
}

// ── 13. SUGGESTION_MAP references ─────────────────────────────────
function checkSuggestionMap(data) {
  const sm = data.SUGGESTION_MAP || {};
  const inst = data.SPECIFIC_INSTRUMENTS || {};
  const allInstruments = new Set();
  for (const family of Object.values(inst)) {
    if (family && typeof family === "object") {
      for (const inst of Object.keys(family)) allInstruments.add(inst);
    }
  }
  const vocabs = allVocabSets(data);
  const bad = [];
  for (const [key, entry] of Object.entries(sm)) {
    if (!allInstruments.has(key)) bad.push(`SUGGESTION_MAP["${key}"] — key is not a known instrument`);
    if (!entry || typeof entry !== "object") continue;
    for (const [field, values] of Object.entries(entry)) {
      const tgt = FIELD_TO_VOCAB[field];
      if (!tgt || !Array.isArray(values)) continue;
      for (const v of values) {
        if (!vocabs[tgt].has(v)) bad.push(`SUGGESTION_MAP["${key}"].${field} → "${v}" not in ${tgt}`);
      }
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "suggestion-map",
    title: "SUGGESTION_MAP integrity",
    description: "Every key in SUGGESTION_MAP must be a known instrument. Every referenced value must be a real vocab item.",
    examples: bad,
    count: bad.length,
  };
}

// ── 14. TOP_5 references ──────────────────────────────────────────
function checkTop5(data) {
  const t5 = data.TOP_5 || {};
  const vocabs = allVocabSets(data);
  const bad = [];
  const fieldToVocab = { ...FIELD_TO_VOCAB };
  for (const [field, list] of Object.entries(t5)) {
    const tgt = fieldToVocab[field];
    if (!tgt) { bad.push(`TOP_5.${field} — unknown field`); continue; }
    if (!Array.isArray(list)) { bad.push(`TOP_5.${field} — not an array`); continue; }
    for (const v of list) {
      if (!vocabs[tgt].has(v)) bad.push(`TOP_5.${field} → "${v}" not in ${tgt}`);
    }
  }
  return {
    severity: bad.length ? "error" : "info",
    code: "top-5",
    title: "TOP_5 references",
    description: "Every value in TOP_5 must exist in the corresponding vocab. If a vocab item was renamed but TOP_5 wasn't updated, this check catches it.",
    examples: bad,
    count: bad.length,
  };
}

// ── 15. Database stats (info only) ────────────────────────────────
function computeStats(data) {
  const { bigs, mids, smalls } = collectTreeNodes(data.GENRE_TREE || {});
  const instFamilies = Object.keys(data.SPECIFIC_INSTRUMENTS || {}).length;
  let pairings = 0;
  for (const { table } of COMPLEMENT_TABLES) {
    const t = data[table] || {};
    for (const entry of Object.values(t)) {
      if (entry && typeof entry === "object") {
        for (const vals of Object.values(entry)) if (Array.isArray(vals)) pairings += vals.length;
      }
    }
  }
  const lines = [
    `${bigs.size} genres · ${mids.size} subgenres · ${smalls.size} microstyles`,
    `${instFamilies} instrument families`,
  ];
  for (const v of Object.keys(VOCABS)) {
    lines.push(`${VOCABS[v].key}: ${vocabIds(data, v).size} items`);
  }
  lines.push(`${pairings} total complement pairings`);
  lines.push(`${Object.keys(data.GENRE_INTUITION || {}).length} GENRE_INTUITION entries`);
  return { severity: "info", code: "stats", title: "Catalog shape", description: "", examples: lines, count: 0 };
}

// ════════════════════════════════════════════════════════════════════════
// RUN + REPORT
// ════════════════════════════════════════════════════════════════════════

const CHECKS = [
  checkComplementReferentialIntegrity,
  checkGIReferentialIntegrity,
  checkCaseMismatchTreeGI,
  checkCaseAmbiguousGI,
  checkMissingGI,
  checkDuplicateValues,
  checkOrphanGI,
  checkOneWayPairings,
  checkNearDuplicateVocab,
  checkWhitespace,
  checkMoodCategoriesCoverage,
  checkOrphanVocab,
  checkSuggestionMap,
  checkTop5,
];

const results = CHECKS.map(fn => fn(data));
const stats = computeStats(data);

const errors   = results.filter(r => r.severity === "error" && r.count > 0);
const warnings = results.filter(r => r.severity === "warning" && r.count > 0);

const HRULE = "─".repeat(66);
const DHRULE = "═".repeat(66);

function banner(title) {
  console.log();
  console.log(DHRULE);
  console.log(`  ${title}`);
  console.log(DHRULE);
}

function section(label, count) {
  console.log();
  console.log(HRULE);
  console.log(`  ${label}${count != null ? `  (${count})` : ""}`);
  console.log(HRULE);
}

function printFinding(r) {
  const tag = `[${r.code}]`;
  console.log();
  console.log(`  ${tag}  ${r.count} ${r.count === 1 ? "occurrence" : "occurrences"}`);
  console.log(`  ${r.title}`);
  if (r.description) {
    // wrap description at 62 cols
    const words = r.description.split(/\s+/);
    let line = "    ";
    for (const w of words) {
      if ((line + w).length > 66) { console.log(line); line = "    "; }
      line += w + " ";
    }
    if (line.trim()) console.log(line);
  }
  console.log();
  const shown = showFull ? r.examples : r.examples.slice(0, 6);
  for (const ex of shown) console.log(`      ${ex}`);
  if (!showFull && r.examples.length > shown.length) {
    console.log(`      (+ ${r.examples.length - shown.length} more — run with --full to see all)`);
  }
}

banner(`Hit Engine · data.json validation`);
console.log(`  Source: ${dataPath}`);
if (raw.sourceModified) console.log(`  Modified: ${raw.sourceModified}`);
console.log();
for (const line of stats.examples) console.log(`  ${line}`);

if (errors.length > 0) {
  section(`ERRORS — integrity violations that need fixing`, errors.length);
  for (const r of errors) printFinding(r);
}

if (warnings.length > 0) {
  section(`WARNINGS — review these, some may be intentional`, warnings.length);
  for (const r of warnings) printFinding(r);
}

if (errors.length === 0 && warnings.length === 0) {
  section("All checks passed");
  console.log(`  data.json is structurally consistent.`);
}

section("Summary");
console.log(`  ${errors.length} error type${errors.length === 1 ? "" : "s"}, ${warnings.length} warning type${warnings.length === 1 ? "" : "s"}`);
const totalErrs = errors.reduce((a, r) => a + r.count, 0);
const totalWarns = warnings.reduce((a, r) => a + r.count, 0);
console.log(`  ${totalErrs} items flagged as errors · ${totalWarns} items flagged as warnings`);
console.log();

process.exit(errors.length > 0 ? 1 : 0);
