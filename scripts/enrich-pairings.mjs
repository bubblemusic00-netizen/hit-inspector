// scripts/enrich-pairings.mjs
//
// Fills in the structural gaps in pairings data by deriving missing fields
// from what already exists. Non-destructive: only fills in EMPTY fields.
//
// What it derives:
//
// 1. GENRE_INTUITION entries (1515 subs/micros) get new fields:
//      • vocalists    — top 5 vocalist styles that pair well with the
//                       entry's moods / grooves / textures / etc.
//                       (derived from VOCALIST_COMPLEMENTS reverse lookup)
//      • lyricalVibes — same approach with LYRICAL_COMPLEMENTS
//
// 2. COMPLEMENT tables (MOOD, ENERGY, GROOVE, VOCALIST, LYRICAL, HARMONIC,
//    TEXTURE, MIX — 224 entries total) each get new fields:
//      • Same-category pairings (mood→mood for MOOD_COMPLEMENTS, etc.)
//        — derived from co-occurrence in GENRE_INTUITION entries
//      • genres / subs / micros — reverse lookup: which genres, subgenres
//        and microstyles use this attribute?
//
// Usage:
//   node scripts/enrich-pairings.mjs [input-path] [output-path]
//   node scripts/enrich-pairings.mjs --dry-run   (report only, no write)
//
// Defaults: input  = ./public/data.json
//           output = ./public/data.json (in-place)

import fs from "node:fs";

// ── CLI parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const positional = args.filter(a => !a.startsWith("--"));
const INPUT  = positional[0] || "./public/data.json";
const OUTPUT = positional[1] || INPUT;
const TOP_N = 5;

// ── Load ───────────────────────────────────────────────────────────
if (!fs.existsSync(INPUT)) {
  console.error(`[enrich-pairings] input not found: ${INPUT}`);
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const d = raw.data || raw;
const {
  GENRE_TREE, GENRE_INTUITION,
  MOOD_COMPLEMENTS, ENERGY_COMPLEMENTS, GROOVE_COMPLEMENTS,
  VOCALIST_COMPLEMENTS, LYRICAL_COMPLEMENTS, HARMONIC_COMPLEMENTS,
  TEXTURE_COMPLEMENTS, MIX_COMPLEMENTS,
} = d;

if (!GENRE_INTUITION || !GENRE_TREE) {
  console.error(`[enrich-pairings] data.json is missing GENRE_INTUITION or GENRE_TREE`);
  process.exit(1);
}

console.log(`[enrich-pairings] input: ${INPUT}${DRY_RUN ? " (dry-run)" : ""}`);

// ── Tree indices: sub/micro → parent ───────────────────────────────
const subToGenre = new Map();
const microToSub = new Map();
const microToGenre = new Map();
for (const [genre, subs] of Object.entries(GENRE_TREE)) {
  for (const [sub, micros] of Object.entries(subs)) {
    subToGenre.set(sub, genre);
    if (Array.isArray(micros)) {
      for (const micro of micros) {
        microToSub.set(micro, sub);
        microToGenre.set(micro, genre);
      }
    }
  }
}
const isSub   = name => subToGenre.has(name);
const isMicro = name => microToSub.has(name);

// ── Helpers ────────────────────────────────────────────────────────
function topN(counter, n) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}
function isEmpty(arr) { return !arr || !Array.isArray(arr) || arr.length === 0; }

const stats = {
  gi_vocalists_added: 0,
  gi_lyrical_added: 0,
  comp_same_cat_added: 0,
  comp_genres_added: 0,
  comp_subs_added: 0,
  comp_micros_added: 0,
};

// ── Step 1: Enrich GENRE_INTUITION with vocalists + lyricalVibes ───
//
// For each sub/micro entry, we score each vocalist (or lyrical vibe) by
// how many of its compatibility lists match this entry's attribute
// profile. Highest-scoring become the derived pairings.
function deriveReverseMatches(entry, complementsTable) {
  const scores = new Map();
  for (const [subject, comp] of Object.entries(complementsTable)) {
    let score = 0;
    for (const v of (entry.moods     || [])) if ((comp.mood     || []).includes(v)) score++;
    for (const v of (entry.grooves   || [])) if ((comp.groove   || []).includes(v)) score++;
    for (const v of (entry.textures  || [])) if ((comp.texture  || []).includes(v)) score++;
    for (const v of (entry.energies  || [])) if ((comp.energy   || []).includes(v)) score++;
    for (const v of (entry.mixes     || [])) if ((comp.mix      || []).includes(v)) score++;
    for (const v of (entry.harmonics || [])) if ((comp.harmonic || []).includes(v)) score++;
    if (score > 0) scores.set(subject, score);
  }
  return topN(scores, TOP_N);
}

for (const [name, entry] of Object.entries(GENRE_INTUITION)) {
  if (isEmpty(entry.vocalists) && VOCALIST_COMPLEMENTS) {
    const derived = deriveReverseMatches(entry, VOCALIST_COMPLEMENTS);
    if (derived.length) {
      entry.vocalists = derived;
      stats.gi_vocalists_added++;
    }
  }
  if (isEmpty(entry.lyricalVibes) && LYRICAL_COMPLEMENTS) {
    const derived = deriveReverseMatches(entry, LYRICAL_COMPLEMENTS);
    if (derived.length) {
      entry.lyricalVibes = derived;
      stats.gi_lyrical_added++;
    }
  }
}

// ── Step 2: Build reverse attribute→subs index ─────────────────────
//
// For every attribute category, map each value → set of GI entry names
// (subs and micros) that list it. This is built AFTER step 1 so the
// newly-derived vocalists and lyricalVibes participate in the lookup.
const fieldSingularPlural = {
  mood: "moods",
  groove: "grooves",
  energy: "energies",
  texture: "textures",
  mix: "mixes",
  harmonic: "harmonics",
  vocalist: "vocalists",
  lyricalVibe: "lyricalVibes",
};
const attrToSubs = {};
for (const sing of Object.keys(fieldSingularPlural)) attrToSubs[sing] = new Map();
for (const [name, entry] of Object.entries(GENRE_INTUITION)) {
  for (const [sing, plural] of Object.entries(fieldSingularPlural)) {
    for (const val of (entry[plural] || [])) {
      if (!attrToSubs[sing].has(val)) attrToSubs[sing].set(val, new Set());
      attrToSubs[sing].get(val).add(name);
    }
  }
}

// ── Step 3: Co-occurrence index for same-category pairings ─────────
//
// For each attribute category, map each value → Map(otherValue → count)
// where count = # of GI entries that list both values together.
function buildCoOccur(pluralField) {
  const co = new Map();
  for (const entry of Object.values(GENRE_INTUITION)) {
    const vals = [...new Set(entry[pluralField] || [])];
    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        if (i === j) continue;
        const a = vals[i], b = vals[j];
        if (!co.has(a)) co.set(a, new Map());
        co.get(a).set(b, (co.get(a).get(b) || 0) + 1);
      }
    }
  }
  return co;
}
const coOccur = {};
for (const [sing, plural] of Object.entries(fieldSingularPlural)) {
  coOccur[sing] = buildCoOccur(plural);
}

// ── Step 4: Enrich complement tables ───────────────────────────────
function topGenresFromNames(names, n) {
  const counter = new Map();
  for (const name of names) {
    const g = subToGenre.get(name) || microToGenre.get(name);
    if (g) counter.set(g, (counter.get(g) || 0) + 1);
  }
  return topN(counter, n);
}

// For subs/micros we want QUALITY-ranked results, not just insertion order.
// Score each name by how much of its GI profile overlaps with the complement
// entry's compatibility lists across every field.  A sub whose moods AND
// grooves AND textures all appear in the complement's compat lists is a
// better match than a sub that only overlaps on one field.
function buildNameScorer(complementEntry) {
  const overlapSets = {};
  for (const field of ["mood", "groove", "energy", "texture", "mix", "harmonic", "vocalist", "lyricalVibe"]) {
    overlapSets[field] = new Set(complementEntry[field] || []);
  }
  return (name) => {
    const gi = GENRE_INTUITION[name];
    if (!gi) return 0;
    let score = 0;
    for (const v of (gi.moods        || [])) if (overlapSets.mood.has(v))        score++;
    for (const v of (gi.grooves      || [])) if (overlapSets.groove.has(v))      score++;
    for (const v of (gi.energies     || [])) if (overlapSets.energy.has(v))      score++;
    for (const v of (gi.textures     || [])) if (overlapSets.texture.has(v))     score++;
    for (const v of (gi.mixes        || [])) if (overlapSets.mix.has(v))         score++;
    for (const v of (gi.harmonics    || [])) if (overlapSets.harmonic.has(v))    score++;
    for (const v of (gi.vocalists    || [])) if (overlapSets.vocalist.has(v))    score++;
    for (const v of (gi.lyricalVibes || [])) if (overlapSets.lyricalVibe.has(v)) score++;
    return score;
  };
}
function topSubsFromNames(names, n, scorer) {
  const scored = [];
  for (const name of names) if (isSub(name)) scored.push([name, scorer(name)]);
  scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return scored.slice(0, n).map(([k]) => k);
}
function topMicrosFromNames(names, n, scorer) {
  const scored = [];
  for (const name of names) if (isMicro(name)) scored.push([name, scorer(name)]);
  scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return scored.slice(0, n).map(([k]) => k);
}

function enrichComplementTable(table, singularField, label) {
  if (!table) return;
  for (const [attr, entry] of Object.entries(table)) {
    // (a) Same-category pairings.  E.g. MOOD_COMPLEMENTS["Defiant"].mood
    if (isEmpty(entry[singularField])) {
      const co = coOccur[singularField].get(attr);
      if (co && co.size) {
        entry[singularField] = topN(co, TOP_N);
        stats.comp_same_cat_added++;
      } else {
        entry[singularField] = [];
      }
    }

    // (b) Tree pairings: genres / subs / micros — ranked by match quality
    const usingNames = attrToSubs[singularField].get(attr) || new Set();
    const scorer = buildNameScorer(entry);
    if (isEmpty(entry.genres)) {
      entry.genres = topGenresFromNames(usingNames, TOP_N);
      if (entry.genres.length) stats.comp_genres_added++;
    }
    if (isEmpty(entry.subs)) {
      entry.subs = topSubsFromNames(usingNames, TOP_N, scorer);
      if (entry.subs.length) stats.comp_subs_added++;
    }
    if (isEmpty(entry.micros)) {
      entry.micros = topMicrosFromNames(usingNames, TOP_N, scorer);
      if (entry.micros.length) stats.comp_micros_added++;
    }
  }
}

enrichComplementTable(MOOD_COMPLEMENTS,     "mood",        "MOOD");
enrichComplementTable(GROOVE_COMPLEMENTS,   "groove",      "GROOVE");
enrichComplementTable(ENERGY_COMPLEMENTS,   "energy",      "ENERGY");
enrichComplementTable(TEXTURE_COMPLEMENTS,  "texture",     "TEXTURE");
enrichComplementTable(MIX_COMPLEMENTS,      "mix",         "MIX");
enrichComplementTable(HARMONIC_COMPLEMENTS, "harmonic",    "HARMONIC");
enrichComplementTable(VOCALIST_COMPLEMENTS, "vocalist",    "VOCALIST");
enrichComplementTable(LYRICAL_COMPLEMENTS,  "lyricalVibe", "LYRICAL");

// ── Step 5: Add tree-level pairings to every GI entry ──────────────
//
// For every sub/micro/genre in GENRE_INTUITION, compute its similarity to
// every OTHER entry via Jaccard overlap on the full attribute profile
// (moods + grooves + energies + textures + mixes + harmonics + vocalists
//  + lyricalVibes + instrumentKeywords).
//
// Then take the top-5 most similar items per tier:
//   • genres  — top similar MAIN genres (excl. self's parent / self)
//   • subs    — top similar sub-genres (excl. self, self's parent-sub if micro,
//                                       self's own subs if this is a genre)
//   • micros  — top similar micro-styles (excl. self, self's own descendants)
//
// This gives "if you like X, you'll also like these" at every tier —
// the core of a recommendation graph.

// Classify every GI entry by tier + lineage. Lookups are case-insensitive
// (GI keys sometimes use different casing than tree keys, e.g. "trap" vs
// "Trap") but output names are always canonicalized to tree casing.
const tierByLower = {};
const canonByLower = {};
for (const g of Object.keys(GENRE_TREE)) {
  tierByLower[g.toLowerCase()] = { tier: "genre", parent: null, grandparent: null };
  canonByLower[g.toLowerCase()] = g;
}
for (const [g, subs] of Object.entries(GENRE_TREE)) {
  for (const [sub, micros] of Object.entries(subs)) {
    tierByLower[sub.toLowerCase()] = { tier: "sub", parent: g, grandparent: null };
    canonByLower[sub.toLowerCase()] = sub;
    if (Array.isArray(micros)) {
      for (const micro of micros) {
        tierByLower[micro.toLowerCase()] = { tier: "micro", parent: sub, grandparent: g };
        canonByLower[micro.toLowerCase()] = micro;
      }
    }
  }
}
const getTier = name => tierByLower[name.toLowerCase()] || { tier: "unknown" };
const canonical = name => canonByLower[name.toLowerCase()] || name;

// Precompute a prefixed token Set per GI entry (prefixes prevent collisions
// between different field values, e.g. "808" as both a mood and instrument).
const giEntries = Object.keys(GENRE_INTUITION);
const tokens = {};
for (const name of giEntries) {
  const e = GENRE_INTUITION[name];
  const s = new Set();
  for (const v of (e.moods              || [])) s.add("m:"  + v);
  for (const v of (e.grooves            || [])) s.add("g:"  + v);
  for (const v of (e.energies           || [])) s.add("e:"  + v);
  for (const v of (e.textures           || [])) s.add("t:"  + v);
  for (const v of (e.mixes              || [])) s.add("x:"  + v);
  for (const v of (e.harmonics          || [])) s.add("h:"  + v);
  for (const v of (e.vocalists          || [])) s.add("v:"  + v);
  for (const v of (e.lyricalVibes       || [])) s.add("l:"  + v);
  for (const v of (e.instrumentKeywords || [])) s.add("ik:" + v);
  tokens[name] = s;
}

function jaccard(a, b) {
  const sa = tokens[a], sb = tokens[b];
  if (!sa || !sb || sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  const [small, big] = sa.size < sb.size ? [sa, sb] : [sb, sa];
  for (const v of small) if (big.has(v)) inter++;
  return inter / (sa.size + sb.size - inter);
}

stats.gi_tree_genres_added = 0;
stats.gi_tree_subs_added = 0;
stats.gi_tree_micros_added = 0;

for (const name of giEntries) {
  const entry = GENRE_INTUITION[name];
  const info = getTier(name);

  // Build exclusion sets per tier. Compared case-insensitively against
  // other entry names; output uses canonical tree-cased names.
  const parentGenreLower = info.tier === "sub"   ? (info.parent || "").toLowerCase()
                         : info.tier === "micro" ? (info.grandparent || "").toLowerCase() : null;
  const parentSubLower   = info.tier === "micro" ? (info.parent || "").toLowerCase() : null;
  const ownDescSubs  = new Set();    // lowercase names of own sub descendants
  const ownDescMicros = new Set();   // lowercase names of own micro descendants
  if (info.tier === "genre") {
    for (const [sub, ms] of Object.entries(GENRE_TREE[canonical(name)] || {})) {
      ownDescSubs.add(sub.toLowerCase());
      if (Array.isArray(ms)) for (const m of ms) ownDescMicros.add(m.toLowerCase());
    }
  } else if (info.tier === "sub") {
    const ms = (GENRE_TREE[info.parent] || {})[canonical(name)];
    if (Array.isArray(ms)) for (const m of ms) ownDescMicros.add(m.toLowerCase());
  }

  // Score every other entry.
  const scores = [];
  for (const other of giEntries) {
    if (other === name) continue;
    const sc = jaccard(name, other);
    if (sc > 0) scores.push({ name: other, score: sc });
  }
  scores.sort((a, b) => b.score - a.score);

  const gList = [], sList = [], mList = [];
  const gSeen = new Set(), sSeen = new Set(), mSeen = new Set();
  for (const { name: other } of scores) {
    const oi = getTier(other);
    const otherLower = other.toLowerCase();
    const otherCanon = canonical(other);
    if (oi.tier === "genre" && gList.length < TOP_N) {
      if (otherLower !== name.toLowerCase() && otherLower !== parentGenreLower && !gSeen.has(otherCanon)) {
        gList.push(otherCanon); gSeen.add(otherCanon);
      }
    } else if (oi.tier === "sub" && sList.length < TOP_N) {
      if (otherLower !== parentSubLower && !ownDescSubs.has(otherLower) && !sSeen.has(otherCanon)) {
        sList.push(otherCanon); sSeen.add(otherCanon);
      }
    } else if (oi.tier === "micro" && mList.length < TOP_N) {
      if (!ownDescMicros.has(otherLower) && !mSeen.has(otherCanon)) {
        mList.push(otherCanon); mSeen.add(otherCanon);
      }
    }
    if (gList.length >= TOP_N && sList.length >= TOP_N && mList.length >= TOP_N) break;
  }

  if (isEmpty(entry.genres)) { entry.genres = gList; if (gList.length) stats.gi_tree_genres_added++; }
  if (isEmpty(entry.subs))   { entry.subs   = sList; if (sList.length) stats.gi_tree_subs_added++; }
  if (isEmpty(entry.micros)) { entry.micros = mList; if (mList.length) stats.gi_tree_micros_added++; }
}

// ── Report ─────────────────────────────────────────────────────────
console.log("");
console.log("──────────────────────────────────────────────────────────");
console.log("ENRICHMENT REPORT");
console.log("──────────────────────────────────────────────────────────");
console.log(`GENRE_INTUITION entries:  ${Object.keys(GENRE_INTUITION).length}`);
console.log(`  + vocalists added:      ${stats.gi_vocalists_added}`);
console.log(`  + lyricalVibes added:   ${stats.gi_lyrical_added}`);
console.log(`  + tree: genres added:   ${stats.gi_tree_genres_added}`);
console.log(`  + tree: subs added:     ${stats.gi_tree_subs_added}`);
console.log(`  + tree: micros added:   ${stats.gi_tree_micros_added}`);
console.log("");
console.log(`Complement table entries: ${
  Object.keys(MOOD_COMPLEMENTS || {}).length +
  Object.keys(GROOVE_COMPLEMENTS || {}).length +
  Object.keys(ENERGY_COMPLEMENTS || {}).length +
  Object.keys(TEXTURE_COMPLEMENTS || {}).length +
  Object.keys(MIX_COMPLEMENTS || {}).length +
  Object.keys(HARMONIC_COMPLEMENTS || {}).length +
  Object.keys(VOCALIST_COMPLEMENTS || {}).length +
  Object.keys(LYRICAL_COMPLEMENTS || {}).length
}`);
console.log(`  + same-cat pairings:    ${stats.comp_same_cat_added}`);
console.log(`  + genres fields:        ${stats.comp_genres_added}`);
console.log(`  + subs fields:          ${stats.comp_subs_added}`);
console.log(`  + micros fields:        ${stats.comp_micros_added}`);
console.log("──────────────────────────────────────────────────────────");
console.log("");

// ── Write back ─────────────────────────────────────────────────────
if (!DRY_RUN) {
  fs.writeFileSync(OUTPUT, JSON.stringify(raw, null, 2));
  console.log(`[enrich-pairings] wrote enriched data → ${OUTPUT}`);
} else {
  console.log(`[enrich-pairings] DRY RUN — no files written`);
}
