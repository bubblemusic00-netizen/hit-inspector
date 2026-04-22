// ═══════════════════════════════════════════════════════════════════════
// CATEGORIES — central config. Each entry describes one category's
// data shape, where to pull its items from, and how to compute its
// family/stats views. The inspector's generic renderer reads from here
// so adding a category is a single edit.
// ═══════════════════════════════════════════════════════════════════════

export const CATEGORIES = [
  // Genres — tree: {main: {sub: [micro...]}}
  { id: "genres",       group: "Genre",      label: "Genres",            shape: "tree-main",    fetcher: d => d.GENRE_TREE || {} },
  { id: "subgenres",    group: "Genre",      label: "Sub-genres",        shape: "tree-sub",     fetcher: d => d.GENRE_TREE || {} },
  { id: "microstyles",  group: "Genre",      label: "Micro-styles",      shape: "tree-micro",   fetcher: d => d.GENRE_TREE || {} },
  // Moods
  { id: "moods",        group: "Character",  label: "Moods",             shape: "flat-strings", fetcher: d => d.MOODS || [],
    complementTable: "MOOD_COMPLEMENTS",  selfKeyInOthers: "mood" },
  // Energy arcs
  { id: "energies",     group: "Character",  label: "Energy arcs",       shape: "flat-strings", fetcher: d => d.ENERGIES || [],
    complementTable: "ENERGY_COMPLEMENTS", selfKeyInOthers: "energy" },
  // Grooves (objects with id/label/desc)
  { id: "grooves",      group: "Rhythm",     label: "Grooves",           shape: "flat-objects", fetcher: d => d.GROOVES || [],
    itemKey: "id", itemLabel: "label", itemDesc: "desc",
    complementTable: "GROOVE_COMPLEMENTS", selfKeyInOthers: "groove" },
  // Vocalists
  { id: "vocalists",    group: "Vocal",      label: "Vocalists",         shape: "flat-strings", fetcher: d => d.VOCALISTS || [],
    complementTable: "VOCALIST_COMPLEMENTS", selfKeyInOthers: "vocalist" },
  // Lyrical vibes
  { id: "lyrical",      group: "Vocal",      label: "Lyrical vibes",     shape: "flat-strings", fetcher: d => d.LYRICAL_VIBES || [],
    complementTable: "LYRICAL_COMPLEMENTS", selfKeyInOthers: "lyricalVibe" },
  // Languages (objects with code/label)
  { id: "languages",    group: "Vocal",      label: "Languages",         shape: "flat-objects", fetcher: d => d.LANGUAGES || [],
    itemKey: "code", itemLabel: "label" },
  // Instruments (tree: {family: {instrument: [articulations...]}})
  { id: "instruments",  group: "Sound",      label: "Instruments",       shape: "tree-main",    fetcher: d => d.SPECIFIC_INSTRUMENTS || {} },
  // Harmonic styles
  { id: "harmonics",    group: "Sound",      label: "Harmonic styles",   shape: "flat-strings", fetcher: d => d.HARMONIC_STYLES || [],
    complementTable: "HARMONIC_COMPLEMENTS", selfKeyInOthers: "harmonic" },
  // Sound textures
  { id: "textures",     group: "Sound",      label: "Textures",          shape: "flat-strings", fetcher: d => d.SOUND_TEXTURES || [],
    complementTable: "TEXTURE_COMPLEMENTS", selfKeyInOthers: "texture" },
  // Mix characters
  { id: "mix",          group: "Sound",      label: "Mix characters",    shape: "flat-strings", fetcher: d => d.MIX_CHARS || [],
    complementTable: "MIX_COMPLEMENTS", selfKeyInOthers: "mix" },
];

// ═══════════════════════════════════════════════════════════════════════
// DERIVED DATA — real stats from catalog cross-references.
//
// "Popularity" per user's direction: cross-reference count. A mood that
// appears in 17 different complement-table entries has higher popularity
// than one that appears in 3. This is real signal, not placeholder data.
//
// We also count how many internal complement entries each item HAS as
// a source (i.e. its OWN complement-table entry count). That catches
// items added to catalog but missing from complement tables (the gap
// we already repaired in session 28).
// ═══════════════════════════════════════════════════════════════════════

export function buildDerivedData(rawData) {
  const COMPLEMENT_TABLES = [
    { name: "MOOD_COMPLEMENTS",     data: rawData.MOOD_COMPLEMENTS     || {} },
    { name: "GROOVE_COMPLEMENTS",   data: rawData.GROOVE_COMPLEMENTS   || {} },
    { name: "LYRICAL_COMPLEMENTS",  data: rawData.LYRICAL_COMPLEMENTS  || {} },
    { name: "ENERGY_COMPLEMENTS",   data: rawData.ENERGY_COMPLEMENTS   || {} },
    { name: "VOCALIST_COMPLEMENTS", data: rawData.VOCALIST_COMPLEMENTS || {} },
    { name: "HARMONIC_COMPLEMENTS", data: rawData.HARMONIC_COMPLEMENTS || {} },
    { name: "TEXTURE_COMPLEMENTS",  data: rawData.TEXTURE_COMPLEMENTS  || {} },
    { name: "MIX_COMPLEMENTS",      data: rawData.MIX_COMPLEMENTS      || {} },
  ];

  // Fields within a complement entry that can hold values of each type.
  // e.g. inside MOOD_COMPLEMENTS["Euphoric"], the `groove: [...]` field
  // lists grooves that pair with Euphoric. So to find a groove's xref
  // count we scan every complement table's `groove` field.
  const FIELD_FOR_CATEGORY = {
    mood:        "mood",
    energy:      "energy",
    groove:      "groove",
    vocalist:    "vocalist",
    lyricalVibe: "lyricalVibe",
    harmonic:    "harmonic",
    texture:     "texture",
    mix:         "mix",
  };

  // For each category-key above, build a map { value: xrefCount }.
  // Scan ALL complement tables, summing the count of occurrences in
  // every entry's matching field.
  const xref = {};
  Object.values(FIELD_FOR_CATEGORY).forEach(f => { xref[f] = {}; });
  for (const { data } of COMPLEMENT_TABLES) {
    for (const entry of Object.values(data)) {
      if (!entry || typeof entry !== "object") continue;
      for (const field of Object.values(FIELD_FOR_CATEGORY)) {
        const arr = entry[field];
        if (!Array.isArray(arr)) continue;
        for (const v of arr) {
          xref[field][v] = (xref[field][v] || 0) + 1;
        }
      }
    }
  }

  // Own-entry counts: for each complement table, record how many
  // keys it has and list the ones that have entries. Used to show
  // "this mood has its own complement entry" ✓/✗ in the item list.
  const ownEntryKeys = {};
  for (const { name, data } of COMPLEMENT_TABLES) {
    ownEntryKeys[name] = new Set(Object.keys(data));
  }

  return { xref, ownEntryKeys, COMPLEMENT_TABLES };
}

// Helper: given a CATEGORY and raw data, return flat list of items
// with a normalized shape { id, label, desc?, xref, hasOwnEntry, raw }.
export function flattenCategoryItems(category, raw, derived) {
  const fetched = category.fetcher(raw);
  const items = [];
  const xrefField = categoryXrefField(category);

  if (category.shape === "flat-strings") {
    for (const s of fetched) {
      items.push({
        id: s, label: s,
        xref: (xrefField && derived.xref[xrefField][s]) || 0,
        hasOwnEntry: category.complementTable
          ? derived.ownEntryKeys[category.complementTable]?.has(s) || false
          : null,
        raw: s,
      });
    }
  } else if (category.shape === "flat-objects") {
    for (const o of fetched) {
      const id = o[category.itemKey];
      items.push({
        id, label: o[category.itemLabel] || id,
        desc: category.itemDesc ? o[category.itemDesc] : null,
        xref: (xrefField && derived.xref[xrefField][id]) || 0,
        hasOwnEntry: category.complementTable
          ? derived.ownEntryKeys[category.complementTable]?.has(id) || false
          : null,
        raw: o,
      });
    }
  } else if (category.shape === "tree-main") {
    for (const mainKey of Object.keys(fetched)) {
      const subs = fetched[mainKey] || {};
      const subCount = Object.keys(subs).length;
      let microCount = 0;
      for (const s of Object.values(subs)) {
        if (Array.isArray(s)) microCount += s.length;
      }
      items.push({
        id: mainKey, label: mainKey,
        xref: 0,  // main genres / families aren't in complement tables directly
        hasOwnEntry: null,
        raw: { subCount, microCount, subs },
        meta: { subCount, microCount },
      });
    }
  } else if (category.shape === "tree-sub") {
    for (const mainKey of Object.keys(fetched)) {
      const subs = fetched[mainKey] || {};
      for (const subKey of Object.keys(subs)) {
        const micros = Array.isArray(subs[subKey]) ? subs[subKey] : [];
        items.push({
          id: `${mainKey} · ${subKey}`, label: subKey,
          desc: `in ${mainKey}`,
          xref: 0, hasOwnEntry: null,
          raw: { main: mainKey, micros },
          meta: { main: mainKey, microCount: micros.length },
        });
      }
    }
  } else if (category.shape === "tree-micro") {
    for (const mainKey of Object.keys(fetched)) {
      const subs = fetched[mainKey] || {};
      for (const subKey of Object.keys(subs)) {
        const micros = Array.isArray(subs[subKey]) ? subs[subKey] : [];
        for (const micro of micros) {
          items.push({
            id: `${mainKey} · ${subKey} · ${micro}`, label: micro,
            desc: `${mainKey} → ${subKey}`,
            xref: 0, hasOwnEntry: null,
            raw: { main: mainKey, sub: subKey, micro },
            meta: { main: mainKey, sub: subKey },
          });
        }
      }
    }
  }
  return items;
}

function categoryXrefField(category) {
  // Map category id → the field name used in complement entries.
  const map = {
    moods: "mood", energies: "energy", grooves: "groove",
    vocalists: "vocalist", lyrical: "lyricalVibe",
    harmonics: "harmonic", textures: "texture", mix: "mix",
  };
  return map[category.id] || null;
}
