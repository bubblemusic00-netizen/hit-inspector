import React, { useState, useEffect, Fragment } from "react";
import { T } from "../theme.js";
import { LINGUISTIC_FAMILIES, MUSIC_CONTEXT_CLUSTERS } from "../language-families.js";

export default function FamilyView({ category, items, raw, derived }) {
  // Tree categories: render as expandable hierarchy
  if (category.shape === "tree-main") {
    return <TreeFamily category={category} raw={raw} />;
  }
  if (category.shape === "tree-sub" || category.shape === "tree-micro") {
    return (
      <div style={{ color: T.textMuted, fontSize: 13, fontFamily: T.fontSans }}>
        Family view for <strong>{category.label}</strong> is shown in the
        Genres page (parent category). Navigate to Genres → Family to see
        the full tree.
      </div>
    );
  }

  // Languages: special-case — no complement table, but we have a
  // family tree based on linguistic ancestry + music-context clusters.
  if (category.id === "languages") {
    return <LanguagesFamily items={items} />;
  }

  // Flat categories without complement table: no family info
  if (!category.complementTable) {
    return (
      <div style={{ color: T.textMuted, fontSize: 13, fontFamily: T.fontSans }}>
        {category.label} has no family data — it's a standalone catalog without
        pairing relationships.
      </div>
    );
  }

  const complementData = raw[category.complementTable] || {};
  const [selected, setSelected] = useState(items[0]?.id || "");
  const entry = complementData[selected];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: T.s4, alignItems: "start" }}>
      {/* Item picker */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: T.r_md, maxHeight: "70vh", overflowY: "auto",
      }}>
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => setSelected(it.id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: `${T.s2}px ${T.s3}px`,
              background: selected === it.id ? T.bgHover : "transparent",
              border: "none", borderLeft: selected === it.id ? `2px solid ${T.accent}` : "2px solid transparent",
              color: selected === it.id ? T.text : T.textSec,
              fontFamily: T.fontSans, fontSize: 13,
              cursor: "pointer",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {it.label}
            {!it.hasOwnEntry && (
              <span style={{ float: "right", color: T.warning, fontSize: 10, fontFamily: T.fontMono }}>missing</span>
            )}
          </button>
        ))}
      </div>

      {/* Family detail panel */}
      <div>
        {!entry ? (
          <div style={{ color: T.warning, fontSize: 13, fontFamily: T.fontSans, padding: T.s4,
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_md }}>
            <strong>{selected}</strong> has no entry in <code style={{ color: T.info, fontFamily: T.fontMono }}>{category.complementTable}</code>.
            <div style={{ marginTop: T.s2, color: T.textMuted, fontSize: 12 }}>
              When a user picks this value, the suggestion system falls back to
              reverse-scanning SUGGESTION_MAP. The system still works but
              pairings will be less curated.
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              fontFamily: T.fontSans, fontSize: 16, fontWeight: 600, color: T.text,
              marginBottom: T.s4,
            }}>Pairings for <span style={{ color: T.accent }}>{selected}</span></div>
            {Object.entries(entry).map(([field, values]) => (
              <div key={field} style={{ marginBottom: T.s4 }}>
                <div style={{
                  fontFamily: T.fontMono, fontSize: 10,
                  color: T.textMuted, letterSpacing: "0.2em",
                  textTransform: "uppercase", marginBottom: T.s2,
                }}>{field}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: T.s2 }}>
                  {(Array.isArray(values) ? values : [values]).map((v, i) => (
                    <span key={`${v}-${i}`} style={{
                      padding: `${T.s1}px ${T.s2}px`,
                      background: T.bgCard,
                      border: `1px solid ${T.borderHi}`,
                      borderRadius: T.r_sm,
                      color: T.textSec, fontSize: 12, fontFamily: T.fontSans,
                    }}>{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tree picker+detail for Genres / Instruments ────────────────────
// Matches the Moods Family pattern: left = item picker, right = detail.
// Adapted for 3-level hierarchy (main → sub → leaf). Selection tracks
// which level was clicked so the detail pane can show the right info:
//   · main selected → summary of sub-categories with their counts
//   · sub selected → list of all leaves under this sub + parent crumb
//   · leaf selected → breadcrumb + cross-references in other catalogs
//                     (for Instruments: also SUGGESTION_MAP pairings)
function TreeFamily({ category, raw }) {
  const data = category.fetcher(raw);
  const [expandedMain, setExpandedMain] = useState({});
  const [expandedSub, setExpandedSub] = useState({});
  const [selected, setSelected] = useState(null); // { level, main, sub?, leaf? }

  // Auto-select the first main on mount so the right panel isn't empty
  useEffect(() => {
    if (!selected) {
      const firstMain = Object.keys(data)[0];
      if (firstMain) setSelected({ level: "main", main: firstMain });
    }
  }, []);

  const toggleMain = (key, e) => {
    e.stopPropagation();
    setExpandedMain(s => ({ ...s, [key]: !s[key] }));
  };
  const toggleSub = (key, e) => {
    e.stopPropagation();
    setExpandedSub(s => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: T.s4, alignItems: "start" }}>
      {/* ── LEFT: tree picker ── */}
      <div style={{
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: T.r_md, maxHeight: "75vh", overflowY: "auto",
        padding: T.s1,
      }}>
        {Object.entries(data).map(([main, subs]) => {
          const mainExpanded = !!expandedMain[main];
          const subKeys = Object.keys(subs || {});
          const isMainSelected = selected?.level === "main" && selected.main === main;
          return (
            <div key={main} style={{ marginBottom: 2 }}>
              <div
                onClick={() => setSelected({ level: "main", main })}
                style={{
                  display: "flex", alignItems: "center", gap: T.s2,
                  padding: `${T.s1}px ${T.s2}px`,
                  background: isMainSelected ? T.bgHover : "transparent",
                  borderLeft: isMainSelected ? `2px solid ${T.accent}` : "2px solid transparent",
                  borderRadius: T.r_sm,
                  color: isMainSelected ? T.text : T.textSec,
                  cursor: "pointer",
                  fontFamily: T.fontSans, fontSize: 13, fontWeight: 600,
                }}>
                <span
                  onClick={(e) => toggleMain(main, e)}
                  style={{
                    color: T.textMuted, fontFamily: T.fontMono, fontSize: 10,
                    width: 12, textAlign: "center", cursor: "pointer",
                    padding: "2px",
                  }}>
                  {mainExpanded ? "▾" : "▸"}
                </span>
                <span style={{ flex: 1 }}>{main}</span>
                <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 10 }}>
                  {subKeys.length}
                </span>
              </div>
              {mainExpanded && subKeys.map(subKey => {
                const leaves = Array.isArray(subs[subKey]) ? subs[subKey] : [];
                const subId = `${main}:${subKey}`;
                const subExpanded = !!expandedSub[subId];
                const isSubSelected = selected?.level === "sub" && selected.main === main && selected.sub === subKey;
                return (
                  <div key={subKey}>
                    <div
                      onClick={() => setSelected({ level: "sub", main, sub: subKey })}
                      style={{
                        display: "flex", alignItems: "center", gap: T.s2,
                        marginLeft: T.s4,
                        padding: `2px ${T.s2}px`,
                        background: isSubSelected ? T.bgHover : "transparent",
                        borderLeft: isSubSelected ? `2px solid ${T.accent}` : "2px solid transparent",
                        borderRadius: T.r_sm,
                        color: isSubSelected ? T.text : T.textSec,
                        cursor: "pointer",
                        fontFamily: T.fontSans, fontSize: 12,
                      }}>
                      <span
                        onClick={(e) => toggleSub(subId, e)}
                        style={{
                          color: T.textMuted, fontFamily: T.fontMono, fontSize: 9,
                          width: 12, textAlign: "center", cursor: "pointer",
                          padding: "2px",
                        }}>
                        {subExpanded ? "▾" : "▸"}
                      </span>
                      <span style={{ flex: 1 }}>{subKey}</span>
                      <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 10 }}>
                        {leaves.length}
                      </span>
                    </div>
                    {subExpanded && leaves.map(leaf => {
                      const isLeafSelected = selected?.level === "leaf"
                        && selected.main === main
                        && selected.sub === subKey
                        && selected.leaf === leaf;
                      return (
                        <div
                          key={leaf}
                          onClick={() => setSelected({ level: "leaf", main, sub: subKey, leaf })}
                          style={{
                            marginLeft: T.s6,
                            padding: `2px ${T.s2}px`,
                            background: isLeafSelected ? T.bgHover : "transparent",
                            borderLeft: isLeafSelected ? `2px solid ${T.accent}` : "2px solid transparent",
                            borderRadius: T.r_sm,
                            color: isLeafSelected ? T.text : T.textMuted,
                            cursor: "pointer",
                            fontFamily: T.fontMono, fontSize: 11,
                          }}>
                          {leaf}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── RIGHT: detail pane ── */}
      <div>
        <TreeDetail category={category} data={data} selected={selected} raw={raw} />
      </div>
    </div>
  );
}

function TreeDetail({ category, data, selected, raw }) {
  if (!selected) {
    return (
      <div style={{ color: T.textMuted, fontSize: 13, fontFamily: T.fontSans, padding: T.s4 }}>
        Pick an item from the tree on the left.
      </div>
    );
  }

  // Breadcrumb helper
  const Breadcrumb = ({ parts }) => (
    <div style={{
      fontFamily: T.fontMono, fontSize: 11,
      color: T.textMuted, letterSpacing: "0.05em",
      marginBottom: T.s3,
    }}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span style={{ margin: "0 6px", color: T.textDim }}>→</span>}
          <span style={{ color: i === parts.length - 1 ? T.text : T.textSec }}>{p}</span>
        </span>
      ))}
    </div>
  );

  const PairingPills = ({ values }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: T.s1 }}>
      {values.map((v, i) => (
        <span key={`${v}-${i}`} style={{
          padding: `${T.s1}px ${T.s2}px`,
          background: T.bgCard, border: `1px solid ${T.borderHi}`,
          borderRadius: T.r_sm,
          color: T.textSec, fontSize: 11, fontFamily: T.fontMono,
        }}>{v}</span>
      ))}
    </div>
  );

  // ── GenrePairings component: resolves GENRE_INTUITION data via
  // inheritance (exact match → parent walk → default) and renders the
  // same pairings-by-field block as Vocalists/Moods. When the resolved
  // entry is INHERITED from a parent (not the exact selected item), an
  // explicit notice is shown above the pairings so the user knows the
  // data isn't unique to the selected item.
  const GenrePairings = ({ main, sub, leaf }) => {
    if (category.id !== "genres") return null;
    const intuition = raw.GENRE_INTUITION || {};
    // Candidates in specificity order. The first is the "target" the
    // user is viewing. levelNames runs in lockstep so we can report
    // which level the fallback landed on.
    const candidates = [leaf, sub, main, "default"].filter(Boolean);
    if (candidates.length === 0) return null;
    const target = candidates[0];
    const levelNames = leaf
      ? ["leaf", "sub", "main", "default"]
      : sub
        ? ["sub", "main", "default"]
        : ["main", "default"];

    const lowerIntuitionKeys = {};
    for (const k of Object.keys(intuition)) lowerIntuitionKeys[k.toLowerCase()] = k;

    let resolved = null;
    let matchedKey = null;
    let matchedLevel = null;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const key = lowerIntuitionKeys[String(c).toLowerCase()];
      if (key && intuition[key]) {
        resolved = intuition[key];
        matchedKey = key;
        matchedLevel = levelNames[i];
        break;
      }
    }
    if (!resolved) return null;

    // Exact = the resolved key is the same entity as the target (case-insensitive).
    const isExact = String(target).toLowerCase() === matchedKey.toLowerCase();

    // Build a human description of the inheritance source.
    const targetLevelLabel = leaf ? "micro-style" : sub ? "sub-genre" : "main genre";
    const sourceLevelLabel =
      matchedLevel === "sub"  ? "parent sub-genre" :
      matchedLevel === "main" ? "parent main genre" :
      matchedLevel === "default" ? "system default fallback" :
      "exact match";

    // Map GENRE_INTUITION field names to the display labels used in the
    // rest of the inspector (match Vocalists/Moods Family format).
    const FIELD_ORDER = [
      { key: "moods",      label: "MOOD" },
      { key: "grooves",    label: "GROOVE" },
      { key: "energies",   label: "ENERGY" },
      { key: "harmonics",  label: "HARMONIC" },
      { key: "textures",   label: "TEXTURE" },
      { key: "mixes",      label: "MIX" },
      { key: "instrumentKeywords", label: "INSTRUMENT KEYWORDS" },
    ];
    // BPM range is a tuple [lo, hi] — render as a single pill.
    const bpm = Array.isArray(resolved.bpmRange) && resolved.bpmRange.length === 2
      ? `${resolved.bpmRange[0]}-${resolved.bpmRange[1]} BPM`
      : null;

    // De-dupe arrays (GENRE_INTUITION has intentional duplicates for
    // weighting — e.g. "straight" appears 3x to bias picks toward it —
    // but the inspector shows unique values).
    const dedupe = arr => {
      const seen = new Set();
      const out = [];
      for (const v of (arr || [])) {
        if (!seen.has(v)) { seen.add(v); out.push(v); }
      }
      return out;
    };

    return (
      <div style={{ marginBottom: T.s5 }}>
        <div style={{
          fontFamily: T.fontSans, fontSize: 16, fontWeight: 600, color: T.text,
          marginBottom: T.s3,
        }}>
          Pairings for <span style={{ color: T.accent }}>{leaf || sub || main}</span>
        </div>
        {!isExact && (
          <div style={{
            padding: `${T.s2}px ${T.s3}px`,
            marginBottom: T.s3,
            background: T.bgCard,
            border: `1px solid ${T.warning}`,
            borderLeft: `3px solid ${T.warning}`,
            borderRadius: T.r_sm,
            fontFamily: T.fontSans, fontSize: 12,
            lineHeight: 1.55,
          }}>
            <div style={{
              fontFamily: T.fontMono, fontSize: 9, color: T.warning,
              letterSpacing: "0.2em", textTransform: "uppercase",
              marginBottom: 2, fontWeight: 700,
            }}>Inherited pairings</div>
            <div style={{ color: T.textSec }}>
              This {targetLevelLabel} has no own entry in{" "}
              <code style={{ color: T.info, fontFamily: T.fontMono }}>GENRE_INTUITION</code>.
              {" "}Showing data inherited from {sourceLevelLabel}{" "}
              <span style={{ color: T.text, fontFamily: T.fontMono }}>"{matchedKey}"</span>.
            </div>
          </div>
        )}
        {bpm && (
          <div style={{ marginBottom: T.s3 }}>
            <div style={{
              fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
              letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s1,
            }}>TEMPO</div>
            <PairingPills values={[bpm]} />
          </div>
        )}
        {FIELD_ORDER.map(({ key, label }) => {
          const values = dedupe(resolved[key]);
          if (!values.length) return null;
          return (
            <div key={key} style={{ marginBottom: T.s3 }}>
              <div style={{
                fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
                letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s1,
              }}>{label}</div>
              <PairingPills values={values} />
            </div>
          );
        })}
      </div>
    );
  };

  // ── MAIN selected: show summary + list of sub-categories ──
  if (selected.level === "main") {
    const subs = data[selected.main] || {};
    const subEntries = Object.entries(subs);
    const totalLeaves = subEntries.reduce((a, [, v]) => a + (Array.isArray(v) ? v.length : 0), 0);
    return (
      <div>
        <Breadcrumb parts={[selected.main]} />
        <div style={{
          fontFamily: T.fontSans, fontSize: 20, fontWeight: 600, color: T.text,
          marginBottom: T.s3,
        }}>{selected.main}</div>
        <div style={{ display: "flex", gap: T.s4, marginBottom: T.s4 }}>
          <StatPill label={subLabel(category)} value={subEntries.length} />
          <StatPill label={leafLabel(category)} value={totalLeaves} />
        </div>
        <GenrePairings main={selected.main} />
        <div style={{
          fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
          letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s2,
        }}>{subLabel(category)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: T.s1 }}>
          {subEntries.map(([subKey, leaves]) => (
            <Fragment key={subKey}>
              <div style={{
                padding: `${T.s1}px ${T.s2}px`,
                color: T.text, fontFamily: T.fontSans, fontSize: 13,
                borderBottom: `1px solid ${T.border}`,
              }}>{subKey}</div>
              <div style={{
                padding: `${T.s1}px ${T.s2}px`,
                color: T.textMuted, fontFamily: T.fontMono, fontSize: 11,
                textAlign: "right",
                borderBottom: `1px solid ${T.border}`,
              }}>{Array.isArray(leaves) ? leaves.length : 0}</div>
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ── SUB selected: show all leaves under this sub ──
  if (selected.level === "sub") {
    const leaves = data[selected.main]?.[selected.sub] || [];
    // Instruments: the "sub" IS the instrument. Show its SUGGESTION_MAP
    // pairings same way Mood Family shows complements.
    const suggestionEntry = category.id === "instruments"
      ? raw.SUGGESTION_MAP?.[selected.sub]
      : null;
    return (
      <div>
        <Breadcrumb parts={[selected.main, selected.sub]} />
        <div style={{
          fontFamily: T.fontSans, fontSize: 20, fontWeight: 600, color: T.text,
          marginBottom: T.s3,
        }}>{selected.sub}</div>
        <div style={{ display: "flex", gap: T.s4, marginBottom: T.s4 }}>
          <StatPill label={leafLabel(category)} value={leaves.length} />
          {suggestionEntry && (
            <StatPill
              label="Pairing fields"
              value={Object.keys(suggestionEntry).filter(k => Array.isArray(suggestionEntry[k])).length}
            />
          )}
        </div>

        <GenrePairings main={selected.main} sub={selected.sub} />

        {/* Instruments show pairings FIRST (primary info), articulations
            second. Genres / other trees skip the pairings section. */}
        {suggestionEntry && (
          <div style={{ marginBottom: T.s5 }}>
            <div style={{
              fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
              letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s2,
            }}>Pairings (SUGGESTION_MAP)</div>
            {Object.entries(suggestionEntry).map(([field, values]) => (
              <div key={field} style={{ marginBottom: T.s3 }}>
                <div style={{
                  fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
                  letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: T.s1,
                  opacity: 0.8,
                }}>{field}</div>
                <PairingPills values={Array.isArray(values) ? values : [values]} />
              </div>
            ))}
          </div>
        )}

        {/* Instruments without a SUGGESTION_MAP entry — warning */}
        {category.id === "instruments" && !suggestionEntry && (
          <div style={{
            padding: T.s3, marginBottom: T.s4,
            background: T.bgCard, border: `1px solid ${T.warning}`, borderRadius: T.r_md,
            color: T.warning, fontSize: 12, fontFamily: T.fontSans,
          }}>
            No SUGGESTION_MAP entry for <span style={{ fontFamily: T.fontMono }}>"{selected.sub}"</span>.
            When users pick this instrument, suggestions fall back to reverse-scan.
          </div>
        )}

        <div style={{
          fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
          letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s2,
        }}>{leafLabel(category)}</div>
        <PairingPills values={Array.isArray(leaves) ? leaves : []} />
      </div>
    );
  }

  // ── LEAF selected: show breadcrumb + cross-references ──
  // For Instruments: if the LEAF is what gets picked as an "instrument"
  // in the Engine (SPECIFIC_INSTRUMENTS[family][instrument] = articulations
  // so instrument is actually the SUB level, not the leaf), and the leaves
  // are articulations. For Genres: leaf is a micro-style. Cross-references
  // look for the string in SUGGESTION_MAP, GENRE_INTUITION, etc.
  if (selected.level === "leaf") {
    const isInstruments = category.id === "instruments";
    const leaf = selected.leaf;
    return (
      <div>
        <Breadcrumb parts={[selected.main, selected.sub, leaf]} />
        <div style={{
          fontFamily: T.fontSans, fontSize: 20, fontWeight: 600, color: T.text,
          marginBottom: T.s3,
        }}>{leaf}</div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 11, color: T.textSec,
          marginBottom: T.s4,
        }}>
          {isInstruments ? "Articulation variant" : "Micro-style"}
          {" · "}
          <span style={{ color: T.textMuted }}>{selected.main} → {selected.sub}</span>
        </div>
        <GenrePairings main={selected.main} sub={selected.sub} leaf={leaf} />
        <CrossRefs value={leaf} raw={raw} isLeaf />
      </div>
    );
  }

  return null;
}

// ── Cross-reference finder — scans SUGGESTION_MAP + GENRE_INTUITION +
// all complement tables for mentions of a value, grouped by where found.
function CrossRefs({ value, raw, isLeaf }) {
  const hits = [];
  const valueLower = String(value).toLowerCase();

  // SUGGESTION_MAP: instrument → { mood: [...], groove: [...], ... }
  // We want instruments whose ANY array contains our value.
  if (raw.SUGGESTION_MAP) {
    const sugHits = [];
    for (const [inst, entry] of Object.entries(raw.SUGGESTION_MAP)) {
      if (!entry || typeof entry !== "object") continue;
      for (const arr of Object.values(entry)) {
        if (Array.isArray(arr) && arr.includes(value)) {
          sugHits.push(inst);
          break;
        }
      }
    }
    if (sugHits.length > 0) hits.push({ source: "SUGGESTION_MAP", items: sugHits });
  }

  // GENRE_INTUITION: genre → { moods: [...], grooves: [...], ... }
  if (raw.GENRE_INTUITION) {
    const genreHits = [];
    for (const [genre, entry] of Object.entries(raw.GENRE_INTUITION)) {
      if (!entry || typeof entry !== "object") continue;
      for (const arr of Object.values(entry)) {
        if (Array.isArray(arr) && arr.includes(value)) {
          genreHits.push(genre);
          break;
        }
      }
    }
    if (genreHits.length > 0) hits.push({ source: "GENRE_INTUITION", items: genreHits });
  }

  // All complement tables
  const complementTables = ["MOOD_COMPLEMENTS","GROOVE_COMPLEMENTS","LYRICAL_COMPLEMENTS","ENERGY_COMPLEMENTS","VOCALIST_COMPLEMENTS","HARMONIC_COMPLEMENTS","TEXTURE_COMPLEMENTS","MIX_COMPLEMENTS"];
  for (const tableName of complementTables) {
    const table = raw[tableName];
    if (!table) continue;
    const refs = [];
    for (const [key, entry] of Object.entries(table)) {
      if (!entry || typeof entry !== "object") continue;
      for (const arr of Object.values(entry)) {
        if (Array.isArray(arr) && arr.includes(value)) {
          refs.push(key);
          break;
        }
      }
    }
    if (refs.length > 0) hits.push({ source: tableName, items: refs });
  }

  if (hits.length === 0) {
    return (
      <div style={{
        padding: T.s4,
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_md,
        color: T.textMuted, fontSize: 12, fontFamily: T.fontSans,
      }}>
        No other catalogs reference <span style={{ color: T.textSec, fontFamily: T.fontMono }}>"{value}"</span>.
        This is a leaf value only used in its parent tree.
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
        letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s2,
      }}>Referenced in</div>
      {hits.map(({ source, items }) => (
        <div key={source} style={{ marginBottom: T.s3 }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 11, color: T.info,
            marginBottom: T.s1,
          }}>{source}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: T.s1 }}>
            {items.map(item => (
              <span key={item} style={{
                padding: `${T.s1}px ${T.s2}px`,
                background: T.bgCard, border: `1px solid ${T.borderHi}`,
                borderRadius: T.r_sm,
                color: T.textSec, fontSize: 11, fontFamily: T.fontMono,
              }}>{item}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={{
      padding: `${T.s2}px ${T.s3}px`,
      background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_md,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 9, color: T.textMuted,
        letterSpacing: "0.2em", textTransform: "uppercase",
      }}>{label}</div>
      <div style={{
        fontFamily: T.fontSans, fontSize: 20, fontWeight: 600, color: T.text,
        marginTop: 2,
      }}>{value}</div>
    </div>
  );
}

// Per-category labels so the UI says "Sub-genres" for genres vs
// "Instruments" for instruments, etc.
function subLabel(category) {
  if (category.id === "genres") return "Sub-genres";
  if (category.id === "instruments") return "Instruments";
  return "Items";
}
function leafLabel(category) {
  if (category.id === "genres") return "Micro-styles";
  if (category.id === "instruments") return "Articulations";
  return "Entries";
}

// ═══════════════════════════════════════════════════════════════════════
// LANGUAGES family view — taxonomy toggle between linguistic family and
// music-context cluster. Each group collapses/expands. Languages in the
// catalog but NOT placed in the current taxonomy's grouping surface at
// the bottom as "Uncategorized" so you can tell when something needs
// to be added to the grouping config.
// ═══════════════════════════════════════════════════════════════════════
function LanguagesFamily({ items }) {
  const [taxonomy, setTaxonomy] = useState("linguistic");
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(s => ({ ...s, [k]: !s[k] }));

  const groups = taxonomy === "linguistic"
    ? LINGUISTIC_FAMILIES
    : MUSIC_CONTEXT_CLUSTERS;

  // Map code → item for fast lookup
  const byCode = {};
  for (const it of items) byCode[it.id] = it;

  // Build the rendered group list. Track which codes were placed so we
  // can show "Uncategorized" at the end for any leftovers.
  const placed = new Set();
  const renderGroups = [];
  for (const [groupName, codes] of Object.entries(groups)) {
    const groupItems = codes
      .map(c => byCode[c])
      .filter(Boolean);
    if (groupItems.length === 0) continue;
    for (const c of codes) placed.add(c);
    renderGroups.push({ name: groupName, items: groupItems });
  }
  const uncategorized = items.filter(it => !placed.has(it.id));
  if (uncategorized.length > 0) {
    renderGroups.push({
      name: "Uncategorized (not yet placed in this taxonomy)",
      items: uncategorized,
      isWarning: true,
    });
  }

  return (
    <div>
      {/* Taxonomy toggle */}
      <div style={{
        display: "inline-flex", gap: 1,
        background: T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: T.r_md, padding: 2,
        marginBottom: T.s5,
      }}>
        {[
          { id: "linguistic", label: "Linguistic family", hint: "By ancestry + grammar" },
          { id: "music",      label: "Music context",     hint: "By pop/regional scene" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTaxonomy(t.id)}
            title={t.hint}
            style={{
              padding: `${T.s2}px ${T.s4}px`,
              background: taxonomy === t.id ? T.accent : "transparent",
              border: "none", borderRadius: T.r_sm,
              color: taxonomy === t.id ? "#fff" : T.textSec,
              fontFamily: T.fontSans, fontSize: 12, fontWeight: 500,
              cursor: "pointer",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Summary row */}
      <div style={{
        display: "flex", gap: T.s3, marginBottom: T.s4,
        fontFamily: T.fontMono, fontSize: 11, color: T.textMuted,
      }}>
        <span>{renderGroups.filter(g => !g.isWarning).length} groups</span>
        <span>·</span>
        <span>{items.length} total languages</span>
        {uncategorized.length > 0 && (
          <>
            <span>·</span>
            <span style={{ color: T.warning }}>{uncategorized.length} uncategorized</span>
          </>
        )}
      </div>

      {/* Group accordion */}
      {renderGroups.map(group => {
        const isOpen = expanded[group.name] !== false; // default expanded
        return (
          <div key={group.name} style={{ marginBottom: T.s3 }}>
            <button
              onClick={() => toggle(group.name)}
              style={{
                display: "flex", alignItems: "center", gap: T.s2,
                width: "100%", textAlign: "left",
                padding: `${T.s2}px ${T.s3}px`,
                background: T.bgCard,
                border: `1px solid ${group.isWarning ? T.warning : T.border}`,
                borderRadius: T.r_sm,
                color: group.isWarning ? T.warning : T.text,
                cursor: "pointer",
                fontFamily: T.fontSans, fontSize: 13, fontWeight: 600,
              }}>
              <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 11, width: 10 }}>
                {isOpen ? "▾" : "▸"}
              </span>
              <span style={{ flex: 1 }}>{group.name}</span>
              <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 11 }}>
                {group.items.length}
              </span>
            </button>
            {isOpen && (
              <div style={{
                marginLeft: T.s5, marginTop: T.s2,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: T.s2,
              }}>
                {group.items.map(it => (
                  <div key={it.id} style={{
                    padding: `${T.s2}px ${T.s3}px`,
                    background: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.r_sm,
                    display: "flex", alignItems: "center", gap: T.s3,
                  }}>
                    <span style={{
                      padding: `${T.s1}px ${T.s2}px`,
                      background: T.bgCard,
                      borderRadius: T.r_sm,
                      color: T.textMuted,
                      fontFamily: T.fontMono, fontSize: 10,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      flexShrink: 0,
                    }}>{it.id}</span>
                    <span style={{
                      color: T.text, fontFamily: T.fontSans, fontSize: 13,
                    }}>{it.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
