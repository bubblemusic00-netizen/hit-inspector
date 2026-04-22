import React, { useState, useEffect, Fragment } from "react";
import { T } from "../theme.js";
import { LINGUISTIC_FAMILIES, MUSIC_CONTEXT_CLUSTERS } from "../language-families.js";
import { useIsMobile } from "../responsive.js";

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
  const isMobile = useIsMobile();
  // Mobile list-detail: when user taps an item in the picker, switch to
  // detail view fullscreen with a back-to-list button. `showPicker`
  // tracks which view is active on mobile.
  const [showPicker, setShowPicker] = useState(false);

  // Shared picker markup — used as 240px column on desktop and as
  // fullscreen list on mobile.
  const pickerMarkup = (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: T.r_md,
      maxHeight: isMobile ? "none" : "70vh",
      overflowY: isMobile ? "visible" : "auto",
    }}>
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => {
            setSelected(it.id);
            if (isMobile) setShowPicker(false);
          }}
          style={{
            display: "block", width: "100%", textAlign: "left",
            padding: `${T.s3}px ${T.s3}px`,
            background: selected === it.id ? T.bgHover : "transparent",
            border: "none",
            borderLeft: selected === it.id ? `2px solid ${T.accent}` : "2px solid transparent",
            color: selected === it.id ? T.text : T.textSec,
            fontFamily: T.fontSans, fontSize: 13,
            cursor: "pointer",
            borderBottom: `1px solid ${T.border}`,
            minHeight: 44,
          }}
        >
          {it.label}
          {!it.hasOwnEntry && (
            <span style={{ float: "right", color: T.warning, fontSize: 10, fontFamily: T.fontMono }}>missing</span>
          )}
        </button>
      ))}
    </div>
  );

  const detailMarkup = (
    !entry ? (
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Array.isArray(values) ? values : [values]).map((v, i) => (
                <span key={`${v}-${i}`} style={{
                  padding: `5px 10px`,
                  background: T.bgSurface,
                  border: `1px solid ${T.borderHi}`,
                  borderRadius: T.r_sm,
                  color: T.text, fontSize: 12, fontFamily: T.fontMono, lineHeight: 1.3,
                }}>{v}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  );

  // ─── MOBILE: list-detail pattern ───
  if (isMobile) {
    if (showPicker) {
      return (
        <div>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginBottom: T.s3,
              background: "transparent", border: "none", padding: `${T.s2}px 0`,
              color: T.textSec, fontFamily: T.fontSans, fontSize: 13,
              cursor: "pointer", minHeight: 44,
            }}>
            <span style={{ fontSize: 16 }}>←</span> Back to detail
          </button>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
            letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s2,
          }}>Select {category.label.toLowerCase()}</div>
          {pickerMarkup}
        </div>
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            marginBottom: T.s4,
            padding: `${T.s2}px ${T.s3}px`,
            background: T.bgCard, border: `1px solid ${T.border}`,
            borderRadius: T.r_sm,
            color: T.text, fontFamily: T.fontSans, fontSize: 13,
            cursor: "pointer", minHeight: 44,
          }}>
          <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Viewing
          </span>
          <span style={{ fontWeight: 600 }}>{selected}</span>
          <span style={{ color: T.textMuted, marginLeft: 4 }}>▾</span>
        </button>
        {detailMarkup}
      </div>
    );
  }

  // ─── DESKTOP: split view ───
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: T.s4, alignItems: "start" }}>
      {pickerMarkup}
      <div>{detailMarkup}</div>
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
  const isMobile = useIsMobile();

  // Auto-select the first main on DESKTOP mount so the right panel isn't
  // empty. On mobile we prefer to start on the tree itself so the user
  // sees the hierarchy first and picks something deliberately.
  useEffect(() => {
    if (!selected && !isMobile) {
      const firstMain = Object.keys(data)[0];
      if (firstMain) setSelected({ level: "main", main: firstMain });
    }
  }, [isMobile]);

  const toggleMain = (key, e) => {
    e.stopPropagation();
    setExpandedMain(s => ({ ...s, [key]: !s[key] }));
  };
  const toggleSub = (key, e) => {
    e.stopPropagation();
    setExpandedSub(s => ({ ...s, [key]: !s[key] }));
  };

  const pickItem = (item) => setSelected(item);
  const backToTree = () => setSelected(null);

  const treeMarkup = (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: T.r_md,
      maxHeight: isMobile ? "none" : "75vh",
      overflowY: isMobile ? "visible" : "auto",
      padding: T.s1,
    }}>
      {Object.entries(data).map(([main, subs]) => {
        const mainExpanded = !!expandedMain[main];
        const subKeys = Object.keys(subs || {});
        const isMainSelected = selected?.level === "main" && selected.main === main;
        return (
          <div key={main} style={{ marginBottom: 2 }}>
            <div
              onClick={() => pickItem({ level: "main", main })}
              style={{
                display: "flex", alignItems: "center", gap: T.s2,
                padding: `${isMobile ? T.s3 : T.s1}px ${T.s2}px`,
                background: isMainSelected ? T.bgHover : "transparent",
                borderLeft: isMainSelected ? `2px solid ${T.accent}` : "2px solid transparent",
                borderRadius: T.r_sm,
                color: isMainSelected ? T.text : T.textSec,
                cursor: "pointer",
                fontFamily: T.fontSans, fontSize: isMobile ? 14 : 13, fontWeight: 600,
                minHeight: isMobile ? 44 : "auto",
              }}>
              <span
                onClick={(e) => toggleMain(main, e)}
                style={{
                  color: T.textMuted, fontFamily: T.fontMono,
                  fontSize: isMobile ? 12 : 10,
                  width: isMobile ? 20 : 12, textAlign: "center", cursor: "pointer",
                  padding: isMobile ? "6px 4px" : "2px",
                  flexShrink: 0,
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
                    onClick={() => pickItem({ level: "sub", main, sub: subKey })}
                    style={{
                      display: "flex", alignItems: "center", gap: T.s2,
                      marginLeft: isMobile ? T.s5 : T.s4,
                      padding: `${isMobile ? "10px" : "2px"} ${T.s2}px`,
                      background: isSubSelected ? T.bgHover : "transparent",
                      borderLeft: isSubSelected ? `2px solid ${T.accent}` : "2px solid transparent",
                      borderRadius: T.r_sm,
                      color: isSubSelected ? T.text : T.textSec,
                      cursor: "pointer",
                      fontFamily: T.fontSans, fontSize: isMobile ? 13 : 12,
                      minHeight: isMobile ? 40 : "auto",
                    }}>
                    <span
                      onClick={(e) => toggleSub(subId, e)}
                      style={{
                        color: T.textMuted, fontFamily: T.fontMono,
                        fontSize: isMobile ? 11 : 9,
                        width: isMobile ? 20 : 12, textAlign: "center", cursor: "pointer",
                        padding: isMobile ? "6px 4px" : "2px",
                        flexShrink: 0,
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
                        onClick={() => pickItem({ level: "leaf", main, sub: subKey, leaf })}
                        style={{
                          marginLeft: isMobile ? T.s7 : T.s6,
                          padding: `${isMobile ? "10px" : "2px"} ${T.s2}px`,
                          background: isLeafSelected ? T.bgHover : "transparent",
                          borderLeft: isLeafSelected ? `2px solid ${T.accent}` : "2px solid transparent",
                          borderRadius: T.r_sm,
                          color: isLeafSelected ? T.text : T.textMuted,
                          cursor: "pointer",
                          fontFamily: T.fontMono, fontSize: isMobile ? 12 : 11,
                          minHeight: isMobile ? 36 : "auto",
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
  );

  // ─── MOBILE: list-detail pattern ───
  if (isMobile) {
    if (!selected) {
      return (
        <div>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
            letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: T.s3,
          }}>Pick an item to inspect</div>
          {treeMarkup}
        </div>
      );
    }
    return (
      <div>
        <button
          type="button"
          onClick={backToTree}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: T.s3,
            background: "transparent", border: "none", padding: `${T.s2}px 0`,
            color: T.textSec, fontFamily: T.fontSans, fontSize: 13,
            cursor: "pointer", minHeight: 44,
          }}>
          <span style={{ fontSize: 16 }}>←</span> Back to tree
        </button>
        <TreeDetail category={category} data={data} selected={selected} raw={raw} />
      </div>
    );
  }

  // ─── DESKTOP: split view ───
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: T.s4, alignItems: "start" }}>
      {treeMarkup}
      <div>
        <TreeDetail category={category} data={data} selected={selected} raw={raw} />
      </div>
    </div>
  );
}

function TreeDetail({ category, data, selected, raw }) {
  const isMobile = useIsMobile();
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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {values.map((v, i) => (
        <span key={`${v}-${i}`} style={{
          padding: `5px 10px`,
          background: T.bgSurface,
          border: `1px solid ${T.borderHi}`,
          borderRadius: T.r_sm,
          color: T.text,
          fontSize: 12,
          fontFamily: T.fontMono,
          lineHeight: 1.3,
        }}>{v}</span>
      ))}
    </div>
  );

  // Visible lineage ribbon: Main ─→ Sub ─→ [current leaf]
  // `activeIndex` marks the terminal node that gets the accent treatment.
  const LineagePath = ({ parts, activeIndex }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      fontFamily: T.fontMono, fontSize: 12, marginBottom: T.s3,
    }}>
      {parts.map((p, i) => {
        const isActive = i === activeIndex;
        return (
          <Fragment key={`${p}-${i}`}>
            {i > 0 && (
              <span style={{ color: T.textDim, letterSpacing: "0.05em" }}>─→</span>
            )}
            <span style={{
              padding: isActive ? "3px 10px" : "3px 8px",
              border: `1px solid ${isActive ? T.accent : T.border}`,
              background: isActive ? `${T.accent}18` : "transparent",
              color: isActive ? T.text : T.textSec,
              borderRadius: T.r_sm,
              fontWeight: isActive ? 600 : 400,
            }}>{p}</span>
          </Fragment>
        );
      })}
    </div>
  );

  // Section header shared by PAIRINGS and CROSS-REFERENCES blocks.
  // Large eyebrow label + count, with a rule beneath that carries the
  // accent the user already associates with active selections.
  const SectionHeader = ({ label, count, countLabel }) => (
    <div style={{ margin: `${T.s6}px 0 ${T.s4}px` }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: T.s3,
        marginBottom: T.s2,
      }}>
        <span style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
          color: T.text, letterSpacing: "0.2em", textTransform: "uppercase",
        }}>{label}</span>
        {count != null && (
          <span style={{
            fontFamily: T.fontMono, fontSize: 11,
            color: T.textMuted, letterSpacing: "0.1em",
          }}>· {count} {countLabel || (count === 1 ? "field" : "fields")}</span>
        )}
      </div>
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, ${T.accent} 0%, ${T.accent}44 50px, ${T.border} 200px)`,
      }} />
    </div>
  );

  // BPM range visualization: two end-dots on an accent bar, numeric
  // readouts above. Communicates that BPM is a range, not a single pick.
  const BpmRange = ({ lo, hi }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: T.s3, flexWrap: "wrap",
    }}>
      <div style={{ width: 260, maxWidth: "100%" }}>
        <div style={{
          position: "relative", display: "flex", justifyContent: "space-between",
          fontFamily: T.fontMono, fontSize: 13, fontWeight: 600, color: T.text,
          marginBottom: 6,
        }}>
          <span>{lo}</span>
          <span>{hi}</span>
        </div>
        <div style={{ position: "relative", height: 10 }}>
          <div style={{
            position: "absolute", left: 5, right: 5, top: 4, height: 2,
            background: T.accent, borderRadius: 1,
          }} />
          <div style={{
            position: "absolute", left: 0, top: 0, width: 10, height: 10,
            borderRadius: "50%", background: T.accent,
            boxShadow: `0 0 0 2px ${T.bg}`,
          }} />
          <div style={{
            position: "absolute", right: 0, top: 0, width: 10, height: 10,
            borderRadius: "50%", background: T.accent,
            boxShadow: `0 0 0 2px ${T.bg}`,
          }} />
        </div>
      </div>
      <span style={{
        fontFamily: T.fontMono, fontSize: 11, letterSpacing: "0.2em",
        color: T.textMuted, textTransform: "uppercase",
      }}>BPM</span>
    </div>
  );

  // Source badge: shows where the pairings were resolved from. When
  // exact (leaf/sub/main matched its own entry), the badge is a calm
  // muted "exact match". When inherited, it calls out the parent.
  const SourceBadge = ({ isExact, matchedKey, sourceLevelLabel }) => {
    if (isExact) {
      return (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "3px 10px",
          background: `${T.success}12`,
          border: `1px solid ${T.success}44`,
          borderRadius: T.r_sm,
          fontFamily: T.fontMono, fontSize: 11,
          color: T.success, letterSpacing: "0.08em",
        }}>
          <span style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: T.success,
          }} />
          EXACT MATCH
        </span>
      );
    }
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "3px 10px",
        background: `${T.info}12`,
        border: `1px solid ${T.info}55`,
        borderRadius: T.r_sm,
        fontFamily: T.fontMono, fontSize: 11,
        color: T.textSec, letterSpacing: "0.02em",
      }}>
        <span style={{
          color: T.info, fontWeight: 700, letterSpacing: "0.12em",
        }}>INHERITED FROM</span>
        <span style={{ color: T.text, fontWeight: 600 }}>"{matchedKey}"</span>
        <span style={{ color: T.textMuted }}>· {sourceLevelLabel}</span>
      </span>
    );
  };

  // ── GenrePairings component: resolves GENRE_INTUITION data via
  // inheritance (exact match → parent walk → default) and renders a
  // structured pairings block. Inheritance metadata (isExact,
  // matchedKey, sourceLevelLabel) is exposed via the optional
  // `onResolve` callback so the outer hero shell can render the
  // source badge in its meta row (rather than a loud warning inline).
  const GenrePairings = ({ main, sub, leaf, onResolve, hideHeading }) => {
    if (category.id !== "genres") return null;
    const intuition = raw.GENRE_INTUITION || {};
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
    if (!resolved) { if (onResolve) onResolve(null); return null; }

    const isExact = String(target).toLowerCase() === matchedKey.toLowerCase();
    const sourceLevelLabel =
      matchedLevel === "sub"     ? "parent sub-genre"       :
      matchedLevel === "main"    ? "parent main genre"      :
      matchedLevel === "default" ? "system default fallback" :
      "exact match";
    if (onResolve) onResolve({ isExact, matchedKey, sourceLevelLabel });

    const FIELD_ORDER = [
      { key: "moods",              label: "MOOD" },
      { key: "grooves",            label: "GROOVE" },
      { key: "energies",           label: "ENERGY" },
      { key: "harmonics",          label: "HARMONIC" },
      { key: "textures",           label: "TEXTURE" },
      { key: "mixes",              label: "MIX" },
      { key: "instrumentKeywords", label: "INSTRUMENT KEYWORDS" },
    ];
    const bpm = Array.isArray(resolved.bpmRange) && resolved.bpmRange.length === 2
      ? resolved.bpmRange
      : null;

    const dedupe = arr => {
      const seen = new Set();
      const out = [];
      for (const v of (arr || [])) {
        if (!seen.has(v)) { seen.add(v); out.push(v); }
      }
      return out;
    };

    // Count the populated fields (BPM + each FIELD_ORDER that has values).
    const populatedFields = FIELD_ORDER.filter(f => dedupe(resolved[f.key]).length > 0);
    const totalFieldCount = populatedFields.length + (bpm ? 1 : 0);

    return (
      <div>
        {!hideHeading && <SectionHeader label="Pairings" count={totalFieldCount} />}
        {bpm && (
          <div style={{ marginBottom: T.s5 }}>
            <div style={{
              fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
              letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: T.s2,
            }}>TEMPO</div>
            <BpmRange lo={bpm[0]} hi={bpm[1]} />
          </div>
        )}
        {populatedFields.map(({ key, label }) => {
          const values = dedupe(resolved[key]);
          return (
            <div key={key} style={{ marginBottom: T.s4 }}>
              <div style={{
                display: "flex", alignItems: "baseline", gap: T.s2,
                marginBottom: T.s2,
              }}>
                <span style={{
                  fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
                  letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600,
                }}>{label}</span>
                <span style={{
                  fontFamily: T.fontMono, fontSize: 10, color: T.textDim,
                }}>· {values.length}</span>
              </div>
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
    const isGenre = category.id === "genres";
    // We need the pairing resolution metadata BEFORE GenrePairings
    // renders, so we run the same resolver once here and pass
    // `hideHeading` when we embed the component below (the hero already
    // carries the source badge). This keeps the single source of truth
    // inside GenrePairings — we just peek at its output.
    let resolutionInfo = null;
    if (isGenre) {
      const intuition = raw.GENRE_INTUITION || {};
      const candidates = [leaf, selected.sub, selected.main, "default"].filter(Boolean);
      const levelNames = ["leaf", "sub", "main", "default"];
      const lowerKeys = {};
      for (const k of Object.keys(intuition)) lowerKeys[k.toLowerCase()] = k;
      for (let i = 0; i < candidates.length; i++) {
        const k = lowerKeys[String(candidates[i]).toLowerCase()];
        if (k && intuition[k]) {
          const isExact = String(leaf).toLowerCase() === k.toLowerCase();
          const matchedLevel = levelNames[i];
          const sourceLevelLabel =
            matchedLevel === "sub"     ? "parent sub-genre"       :
            matchedLevel === "main"    ? "parent main genre"      :
            matchedLevel === "default" ? "system default fallback" :
            "exact match";
          resolutionInfo = { isExact, matchedKey: k, sourceLevelLabel };
          break;
        }
      }
    }

    return (
      <div>
        {/* ═══ HERO ═══ */}
        <div style={{
          paddingBottom: T.s5,
          marginBottom: T.s2,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <LineagePath parts={[selected.main, selected.sub, leaf]} activeIndex={2} />
          <h1 style={{
            margin: 0,
            fontFamily: T.fontSans,
            fontSize: isMobile ? 28 : 40,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            lineHeight: 1.08,
            color: T.text,
          }}>{leaf}</h1>
          <div style={{
            display: "flex", alignItems: "center", gap: T.s3,
            marginTop: T.s3, flexWrap: "wrap",
          }}>
            <span style={{
              padding: "3px 10px",
              border: `1px solid ${T.border}`,
              borderRadius: T.r_sm,
              fontFamily: T.fontMono, fontSize: 11,
              color: T.textSec, letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}>
              {isInstruments ? "Articulation" : "Micro-style"}
            </span>
            {resolutionInfo && (
              <SourceBadge
                isExact={resolutionInfo.isExact}
                matchedKey={resolutionInfo.matchedKey}
                sourceLevelLabel={resolutionInfo.sourceLevelLabel}
              />
            )}
          </div>
        </div>

        {/* ═══ PAIRINGS ═══ */}
        {isGenre && (
          <GenrePairings main={selected.main} sub={selected.sub} leaf={leaf} />
        )}

        {/* ═══ CROSS-REFERENCES ═══ */}
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
      <div>
        <div style={{ margin: `${T.s6}px 0 ${T.s4}px` }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: T.s3,
            marginBottom: T.s2,
          }}>
            <span style={{
              fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
              color: T.text, letterSpacing: "0.2em", textTransform: "uppercase",
            }}>Cross-references</span>
            <span style={{
              fontFamily: T.fontMono, fontSize: 11,
              color: T.textMuted, letterSpacing: "0.1em",
            }}>· 0 tables</span>
          </div>
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, ${T.accent} 0%, ${T.accent}44 50px, ${T.border} 200px)`,
          }} />
        </div>
        <div style={{
          padding: T.s4,
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_md,
          color: T.textMuted, fontSize: 12, fontFamily: T.fontSans,
        }}>
          No other catalogs reference <span style={{ color: T.textSec, fontFamily: T.fontMono }}>"{value}"</span>.
          This is a leaf value only used in its parent tree.
        </div>
      </div>
    );
  }

  const totalHits = hits.reduce((n, h) => n + h.items.length, 0);

  return (
    <div>
      <div style={{ margin: `${T.s6}px 0 ${T.s4}px` }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: T.s3,
          marginBottom: T.s2,
        }}>
          <span style={{
            fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
            color: T.text, letterSpacing: "0.2em", textTransform: "uppercase",
          }}>Cross-references</span>
          <span style={{
            fontFamily: T.fontMono, fontSize: 11,
            color: T.textMuted, letterSpacing: "0.1em",
          }}>· {hits.length} {hits.length === 1 ? "source" : "sources"} · {totalHits} {totalHits === 1 ? "hit" : "hits"}</span>
        </div>
        <div style={{
          height: 1,
          background: `linear-gradient(90deg, ${T.accent} 0%, ${T.accent}44 50px, ${T.border} 200px)`,
        }} />
      </div>
      {hits.map(({ source, items }) => (
        <div key={source} style={{ marginBottom: T.s4 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: T.s2,
            marginBottom: T.s2,
          }}>
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, fontWeight: 600,
              color: T.info, letterSpacing: "0.18em", textTransform: "uppercase",
            }}>{source}</span>
            <span style={{
              fontFamily: T.fontMono, fontSize: 10, color: T.textDim,
            }}>· {items.length}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {items.map(item => (
              <span key={item} style={{
                padding: `5px 10px`,
                background: T.bgSurface, border: `1px solid ${T.borderHi}`,
                borderRadius: T.r_sm,
                color: T.text, fontSize: 12, fontFamily: T.fontMono,
                lineHeight: 1.3,
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
