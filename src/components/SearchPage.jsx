import React, { useMemo, useState } from "react";
import { T } from "../theme.js";
import { useIsMobile } from "../responsive.js";

// Global search across the whole catalog. Substring, case-insensitive,
// grouped by category. Results click-through to the target category
// with the matched item preselected.

const MIN_QUERY_LEN = 2;

// Section config: order + display labels + target categoryId for navigation.
// Some sections (artists, lineage) point to "genres" since that's where
// GENRE_LINEAGE data is browsed.
const SECTIONS = [
  { id: "genres",       categoryId: "genres",      label: "Genres" },
  { id: "instruments",  categoryId: "instruments", label: "Instruments" },
  { id: "moods",        categoryId: "moods",       label: "Moods" },
  { id: "energies",     categoryId: "energies",    label: "Energy arcs" },
  { id: "grooves",      categoryId: "grooves",     label: "Grooves" },
  { id: "vocalists",    categoryId: "vocalists",   label: "Vocalists" },
  { id: "lyrical",      categoryId: "lyrical",     label: "Lyrical vibes" },
  { id: "harmonics",    categoryId: "harmonics",   label: "Harmonic styles" },
  { id: "textures",     categoryId: "textures",    label: "Textures" },
  { id: "mix",          categoryId: "mix",         label: "Mix characters" },
  { id: "languages",    categoryId: "languages",   label: "Languages" },
  { id: "artists",      categoryId: "genres",      label: "Artists (in genre lineage)" },
];

export default function SearchPage({ data, onResultClick }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LEN;
  const showResults = trimmed.length >= MIN_QUERY_LEN;

  const results = useMemo(() => {
    if (!showResults) return null;
    return buildSearchResults(data, trimmed);
  }, [data, trimmed, showResults]);

  const totalCount = results
    ? Object.values(results).reduce((n, arr) => n + arr.length, 0)
    : 0;

  return (
    <div style={{ padding: isMobile ? T.s4 : T.s5, maxWidth: 960 }}>
      <header style={{ marginBottom: isMobile ? T.s4 : T.s5 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: "0.2em",
          textTransform: "uppercase", marginBottom: T.s1,
        }}>Tools</div>
        <h1 style={{
          margin: 0, fontFamily: T.fontSans,
          fontSize: isMobile ? 22 : 26, fontWeight: 600, color: T.text,
        }}>Search catalog</h1>
        <div style={{
          marginTop: T.s2, color: T.textSec,
          fontFamily: T.fontSans, fontSize: 13, lineHeight: 1.5,
        }}>
          Search across every catalog — genres, moods, grooves, instruments,
          artist names, and more. Click a result to jump to its home.
        </div>
      </header>

      <div style={{ position: "relative", marginBottom: T.s5 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          placeholder="Type a value, artist, genre…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: isMobile ? `${T.s3}px ${T.s4}px` : `${T.s3}px ${T.s4}px`,
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_md,
            color: T.text, fontFamily: T.fontSans,
            fontSize: isMobile ? 16 : 15,
            outline: "none",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = T.accent; }}
          onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
        />
        {trimmed && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            style={{
              position: "absolute", right: 8, top: "50%",
              transform: "translateY(-50%)",
              width: 28, height: 28, padding: 0,
              background: "transparent", border: "none",
              color: T.textMuted, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: T.fontMono, fontSize: 14,
            }}>×</button>
        )}
      </div>

      {trimmed.length === 0 && <EmptyHint />}
      {tooShort && (
        <div style={{
          color: T.textMuted, fontSize: 13, fontFamily: T.fontSans,
        }}>Keep typing — at least {MIN_QUERY_LEN} characters.</div>
      )}

      {showResults && (
        <div>
          <div style={{
            fontFamily: T.fontMono, fontSize: 11,
            color: T.textMuted, letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: T.s4,
          }}>
            {totalCount === 0 && <>No matches for "<span style={{ color: T.textSec }}>{trimmed}</span>".</>}
            {totalCount > 0 && <>{totalCount} {totalCount === 1 ? "match" : "matches"}</>}
          </div>
          {SECTIONS.map(section => {
            const items = results[section.id];
            if (!items || items.length === 0) return null;
            return (
              <ResultSection
                key={section.id}
                section={section}
                items={items}
                onResultClick={onResultClick}
                isMobile={isMobile}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyHint() {
  return (
    <div style={{
      padding: T.s5,
      background: T.bgCard, border: `1px dashed ${T.border}`, borderRadius: T.r_md,
      color: T.textMuted, fontFamily: T.fontSans, fontSize: 13, lineHeight: 1.6,
    }}>
      <div style={{ marginBottom: T.s2, color: T.textSec }}>Try searching for:</div>
      <ul style={{ margin: 0, paddingLeft: T.s4, color: T.textMuted }}>
        <li>A mood like <code style={{ color: T.info, fontFamily: T.fontMono }}>Euphoric</code> or <code style={{ color: T.info, fontFamily: T.fontMono }}>Smoldering</code></li>
        <li>A genre like <code style={{ color: T.info, fontFamily: T.fontMono }}>Trap</code> or <code style={{ color: T.info, fontFamily: T.fontMono }}>Shoegaze</code></li>
        <li>An artist like <code style={{ color: T.info, fontFamily: T.fontMono }}>Drake</code> or <code style={{ color: T.info, fontFamily: T.fontMono }}>Björk</code></li>
        <li>An instrument like <code style={{ color: T.info, fontFamily: T.fontMono }}>808</code> or <code style={{ color: T.info, fontFamily: T.fontMono }}>Rhodes</code></li>
      </ul>
    </div>
  );
}

function ResultSection({ section, items, onResultClick, isMobile }) {
  return (
    <div style={{ marginBottom: T.s5 }}>
      <div style={{
        display: "flex", alignItems: "baseline", gap: T.s2,
        marginBottom: T.s2,
        paddingBottom: T.s2,
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{
          fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
          color: T.text, letterSpacing: "0.18em", textTransform: "uppercase",
        }}>{section.label}</span>
        <span style={{
          fontFamily: T.fontMono, fontSize: 11,
          color: T.textMuted,
        }}>· {items.length}</span>
      </div>
      <div>
        {items.map((it, i) => (
          <button
            key={`${section.id}-${i}`}
            onClick={() => onResultClick(section.categoryId, it.preselect, it.tab || "family")}
            style={{
              display: "flex",
              width: "100%",
              textAlign: "left",
              alignItems: "center",
              justifyContent: "space-between",
              gap: T.s3,
              padding: `${T.s3}px ${T.s3}px`,
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${T.border}`,
              color: T.text,
              fontFamily: T.fontSans,
              fontSize: 13,
              cursor: "pointer",
              minHeight: 44,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                color: T.text, fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{it.label}</div>
              {it.path && (
                <div style={{
                  color: T.textMuted, fontFamily: T.fontMono, fontSize: 11,
                  marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{it.path}</div>
              )}
            </div>
            <span style={{
              color: T.textDim, fontFamily: T.fontMono, fontSize: 14,
              flexShrink: 0,
            }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Search engine — pure function. Walks every catalog in the raw data
// snapshot and returns matches grouped by section id.
// ═══════════════════════════════════════════════════════════════════
export function buildSearchResults(data, query) {
  const q = query.toLowerCase();
  const match = (s) => typeof s === "string" && s.toLowerCase().includes(q);

  const groups = {
    genres: [], instruments: [],
    moods: [], energies: [], grooves: [], vocalists: [],
    lyrical: [], languages: [], harmonics: [], textures: [], mix: [],
    artists: [],
  };

  // ── Genres tree ──
  for (const [main, subs] of Object.entries(data.GENRE_TREE || {})) {
    if (match(main)) {
      groups.genres.push({
        label: main,
        path: "main genre",
        preselect: { level: "main", main },
      });
    }
    for (const [sub, leaves] of Object.entries(subs || {})) {
      if (match(sub)) {
        groups.genres.push({
          label: sub,
          path: `${main} · sub-genre`,
          preselect: { level: "sub", main, sub },
        });
      }
      if (Array.isArray(leaves)) {
        for (const leaf of leaves) {
          if (match(leaf)) {
            groups.genres.push({
              label: leaf,
              path: `${main} → ${sub} · micro-style`,
              preselect: { level: "leaf", main, sub, leaf },
            });
          }
        }
      }
    }
  }

  // ── Instruments tree ──
  for (const [family, instruments] of Object.entries(data.SPECIFIC_INSTRUMENTS || {})) {
    if (match(family)) {
      groups.instruments.push({
        label: family,
        path: "instrument family",
        preselect: { level: "main", main: family },
      });
    }
    for (const [inst, arts] of Object.entries(instruments || {})) {
      if (match(inst)) {
        groups.instruments.push({
          label: inst,
          path: `${family} · instrument`,
          preselect: { level: "sub", main: family, sub: inst },
        });
      }
      if (Array.isArray(arts)) {
        for (const art of arts) {
          if (match(art)) {
            groups.instruments.push({
              label: art,
              path: `${family} → ${inst} · articulation`,
              preselect: { level: "leaf", main: family, sub: inst, leaf: art },
            });
          }
        }
      }
    }
  }

  // ── Flat string catalogs ──
  const flatCatalogs = [
    ["moods",     data.MOODS],
    ["energies",  data.ENERGIES],
    ["vocalists", data.VOCALISTS],
    ["lyrical",   data.LYRICAL_VIBES],
    ["harmonics", data.HARMONIC_STYLES],
    ["textures",  data.SOUND_TEXTURES],
    ["mix",       data.MIX_CHARS],
  ];
  for (const [catId, arr] of flatCatalogs) {
    if (!Array.isArray(arr)) continue;
    for (const s of arr) {
      if (match(s)) {
        groups[catId].push({ label: s, preselect: { id: s } });
      }
    }
  }

  // ── Grooves (objects) ──
  for (const g of (data.GROOVES || [])) {
    if (match(g.id) || match(g.label) || match(g.desc)) {
      groups.grooves.push({
        label: g.label || g.id,
        path: g.desc || null,
        preselect: { id: g.id },
      });
    }
  }

  // ── Languages (objects) ──
  for (const l of (data.LANGUAGES || [])) {
    if (match(l.code) || match(l.label)) {
      groups.languages.push({
        label: l.label || l.code,
        path: l.code,
        preselect: { id: l.code },
      });
    }
  }

  // ── Artists from GENRE_LINEAGE ──
  // Group by artist name so if "Drake" appears in 4 lineage entries we
  // show 4 results with different paths — each navigates to the right
  // main genre.
  if (data.GENRE_LINEAGE) {
    for (const [genre, entry] of Object.entries(data.GENRE_LINEAGE)) {
      if (!entry || typeof entry !== "object") continue;
      if (!Array.isArray(entry.artists)) continue;
      for (const artist of entry.artists) {
        if (match(artist)) {
          groups.artists.push({
            label: artist,
            path: `listed in ${genre}`,
            preselect: { level: "main", main: genre },
          });
        }
      }
    }
  }

  return groups;
}
