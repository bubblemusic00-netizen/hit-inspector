import React, { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../theme.js";
import {
  getGenreSeries,
  getSubgenreSeries,
  getMicrostyleSeries,
  getAllGenres,
  findPeak,
  currentValue,
  ERAS,
  TIME_RANGE,
} from "../popularityData.js";

/* ═══════════════════════════════════════════════════════════════════
 * PopularityGraphs — 18 genres as a multi-overlay spectral chart
 *
 * Design brief: "alien-civilization-advanced-philosophical".
 * Interpretation: this reads as if a deep-time observatory were
 * plotting the cultural signal of Earth's music — not a Spotify
 * dashboard. Matrix green accents, instrument serif headers, sparse
 * monospace annotations, a dot-grid backdrop with breathing
 * scan-lines. Every chart line is a filtered resonance, not a bar.
 *
 * Data: deterministic synthetic from popularityData.js. Each genre
 * gets a 684-month series 1970-01 → 2026-12, hand-tuned per genre's
 * real historical trajectory.
 * ═══════════════════════════════════════════════════════════════════ */

// Genre colors — copied from CategoryMap3D's BIG_COLORS so the page
// reads as the same visual universe.
const GENRE_COLORS = {
  "Hip-Hop":                "#A78BFA",
  "R&B / Soul":             "#FB7185",
  "Pop":                    "#F472B6",
  "Disco / Dance":          "#22D3EE",
  "Electronic":             "#60A5FA",
  "Latin":                  "#FB923C",
  "Rock":                   "#EF4444",
  "Metal":                  "#818CF8",
  "World / Global":         "#2DD4BF",
  "Blues":                  "#3B82F6",
  "Country / Americana":    "#F59E0B",
  "Folk / Acoustic":        "#84CC16",
  "Jazz":                   "#FBBF24",
  "Ambient / New Age":      "#C4B5FD",
  "Soundtrack / Score":     "#A8A29E",
  "Classical / Orchestral": "#F3E8D2",
  "Gospel / Spiritual":     "#FCD34D",
  "Experimental":           "#E879F9",
};

const MATRIX = "#39ff41";
const MAX_OVERLAY = 5;

// Serif font loaded from Google. We use it for headers only — gives
// the page a "printed publication from another civilization" tone
// that the system monospace can't achieve.
const SERIF_FONT = "'Instrument Serif', 'EB Garamond', Georgia, serif";

/* ═══════════════════════════════════════════════════════════════════
 * Main component
 *
 * Selection model: each item is a string key.
 *   "Pop"                     → genre
 *   "Hip-Hop§Trap"            → sub-genre ("genre§sub")
 *   "Hip-Hop§Trap§dark trap"  → micro    ("genre§sub§micro")
 *
 * Separator is "§" (section sign) — verified not to appear anywhere
 * in the catalog's 18+294+1180 names. Using "/" would clash with
 * real names like "World / Global", "R&B / Soul", "Bassline / UK Bass".
 * ═══════════════════════════════════════════════════════════════════ */

const KEY_SEP = "§";
const keyGenre = (g) => g;
const keySub   = (g, s) => `${g}${KEY_SEP}${s}`;
const keyMicro = (g, s, m) => `${g}${KEY_SEP}${s}${KEY_SEP}${m}`;

function parseKey(key) {
  const parts = key.split(KEY_SEP);
  if (parts.length === 1) return { kind: "genre", grand: null, parent: null, name: parts[0] };
  if (parts.length === 2) return { kind: "sub", grand: null, parent: parts[0], name: parts[1] };
  return { kind: "micro", grand: parts[0], parent: parts[1], name: parts.slice(2).join(KEY_SEP) };
}

function getSeriesByKey(key) {
  const p = parseKey(key);
  if (p.kind === "genre") return getGenreSeries(p.name);
  if (p.kind === "sub") return getSubgenreSeries(p.parent, p.name);
  return getMicrostyleSeries(p.grand, p.parent, p.name);
}

function getColorByKey(key) {
  const p = parseKey(key);
  const genreName = p.kind === "genre" ? p.name
                  : p.kind === "sub"   ? p.parent
                  :                      p.grand;
  return GENRE_COLORS[genreName] || "#888";
}

export default function PopularityGraphs({ data }) {
  const allGenres = useMemo(() => getAllGenres(), []);

  // 3-level tree from real data. Shape:
  //   {
  //     "Hip-Hop": {
  //       "Trap": ["Atlanta trap", "futuristic trap", ...],
  //       "Phonk": ["drift phonk", ...],
  //     }, ...
  //   }
  // Source is raw GENRE_TREE from data.json. Micros can be encoded
  // as either an array or an object with names as keys — we handle
  // both.
  const subTree = useMemo(() => {
    const tree = {};
    const gt = data?.GENRE_TREE || {};
    for (const genreName of allGenres) {
      tree[genreName] = {};
      const subs = gt[genreName];
      if (subs && typeof subs === "object") {
        for (const [subName, micros] of Object.entries(subs)) {
          let microNames = [];
          if (Array.isArray(micros)) microNames = micros;
          else if (micros && typeof micros === "object") microNames = Object.keys(micros);
          tree[genreName][subName] = microNames;
        }
      }
    }
    return tree;
  }, [data, allGenres]);

  // Selected keys (strings). Default shows 3 diverse genres out of the
  // box so the user lands on something meaningful.
  const [selected, setSelected] = useState(["Pop", "Hip-Hop", "Disco / Dance"]);

  // Expanded state for genre rows (shows sub-genres) and sub-genre
  // rows (shows micro-styles). Kept as two Sets — each genre/sub can
  // independently open/close. Keys for sub-expansion use "Genre§Sub"
  // format, same as the selection keys.
  const [expandedGenres, setExpandedGenres] = useState(() => new Set());
  const [expandedSubs, setExpandedSubs] = useState(() => new Set());

  const [timeRange, setTimeRange] = useState({
    start: TIME_RANGE.startYear,
    end: TIME_RANGE.endYear + TIME_RANGE.endMonth / 12,
  });

  const [hoverT, setHoverT] = useState(null);

  // Fetch series for every selected key.
  const serieses = useMemo(() => {
    return selected
      .map(key => {
        const s = getSeriesByKey(key);
        if (!s) return null;
        const p = parseKey(key);
        return {
          key,
          name: s.name,
          displayName: s.name,
          parent: p.parent,
          grand: p.grand,
          kind: p.kind,
          color: getColorByKey(key),
          series: s.series,
        };
      })
      .filter(Boolean);
  }, [selected]);

  const toggleKey = (key) => {
    setSelected(curr => {
      if (curr.includes(key)) return curr.filter(k => k !== key);
      if (curr.length >= MAX_OVERLAY) return [...curr.slice(1), key];
      return [...curr, key];
    });
  };

  const toggleGenreExpanded = (genreName) => {
    setExpandedGenres(curr => {
      const next = new Set(curr);
      if (next.has(genreName)) next.delete(genreName);
      else next.add(genreName);
      return next;
    });
  };

  const toggleSubExpanded = (subKey) => {
    setExpandedSubs(curr => {
      const next = new Set(curr);
      if (next.has(subKey)) next.delete(subKey);
      else next.add(subKey);
      return next;
    });
  };

  return (
    <div style={{
      position: "relative",
      width: "100%",
      minHeight: "100vh",
      background: T.bg,
      color: T.text,
      fontFamily: T.fontMono,
      overflow: "hidden",
    }}>
      <FontLoader />
      <Scanlines />
      <DotGrid />

      <Header />

      <div style={{
        display: "flex",
        gap: 0,
        padding: `${T.s5}px ${T.s6}px ${T.s6}px ${T.s6}px`,
        position: "relative",
        zIndex: 2,
      }}>
        <GenreSelector
          genres={allGenres}
          subTree={subTree}
          selected={selected}
          expandedGenres={expandedGenres}
          expandedSubs={expandedSubs}
          onToggle={toggleKey}
          onToggleGenreExpanded={toggleGenreExpanded}
          onToggleSubExpanded={toggleSubExpanded}
        />

        <div style={{ flex: 1, minWidth: 0, paddingLeft: T.s6 }}>
          <ChartPanel
            serieses={serieses}
            timeRange={timeRange}
            hoverT={hoverT}
            onHoverT={setHoverT}
          />
          <TimelineScrubber
            timeRange={timeRange}
            onRangeChange={setTimeRange}
          />
          <EraStrip />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * FontLoader — inject Instrument Serif via Google Fonts
 * ═══════════════════════════════════════════════════════════════════ */

function FontLoader() {
  useEffect(() => {
    const id = "ig-instrument-serif-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
    document.head.appendChild(link);
  }, []);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
 * Scanlines — subtle horizontal CRT lines across the whole page.
 * Pure CSS layered gradient pinned to the viewport; breathes at a
 * slow tempo to feel alive but not distracting.
 * ═══════════════════════════════════════════════════════════════════ */

function Scanlines() {
  return (
    <>
      <style>{`
        @keyframes ig-scan-breathe {
          0%,100% { opacity: 0.28; }
          50%     { opacity: 0.42; }
        }
      `}</style>
      <div style={{
        position: "fixed", inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        backgroundImage: `repeating-linear-gradient(
          to bottom,
          rgba(57,255,65,0) 0px,
          rgba(57,255,65,0) 2px,
          rgba(57,255,65,0.018) 3px,
          rgba(57,255,65,0) 4px
        )`,
        mixBlendMode: "screen",
        animation: "ig-scan-breathe 7s ease-in-out infinite",
      }} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * DotGrid — a very faint dotted grid, gives the page a "star-map"
 * quality. Matches the galaxy aesthetic of the 3D Map page.
 * ═══════════════════════════════════════════════════════════════════ */

function DotGrid() {
  return (
    <div style={{
      position: "fixed", inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      backgroundImage: `radial-gradient(
        circle at center,
        rgba(94,106,210,0.045) 0.8px,
        transparent 1.2px
      )`,
      backgroundSize: "32px 32px",
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Header — title + subhead. Instrument Serif for the title. The
 * subhead is a single line of mono context so readers orient fast.
 * ═══════════════════════════════════════════════════════════════════ */

function Header() {
  return (
    <header style={{
      padding: `${T.s8}px ${T.s6}px ${T.s4}px`,
      position: "relative", zIndex: 3,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10,
        letterSpacing: "0.3em",
        color: MATRIX, opacity: 0.7,
        marginBottom: T.s3,
      }}>
        ◎ SPECTRAL CATALOGUE · VOL. I
      </div>
      <h1 style={{
        fontFamily: SERIF_FONT,
        fontSize: 56,
        lineHeight: 1.02,
        margin: 0,
        color: T.text,
        fontWeight: 400,
        letterSpacing: "-0.02em",
      }}>
        The shape of{" "}
        <em style={{ color: MATRIX, fontStyle: "italic" }}>listening</em>
        , measured.
      </h1>
      <div style={{
        fontFamily: T.fontMono, fontSize: 11,
        color: T.textSec, marginTop: T.s3,
        maxWidth: 640, lineHeight: 1.6,
      }}>
        Six and a half decades of relative popularity across eighteen
        principal genres. Each line is the long signal of a form —
        emergence, crest, rebound, quiet afterlife — plotted against
        its contemporaries. Select up to five to compare.
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * GenreSelector — 18 genres as stacked nodes. Each node shows:
 *   - color dot
 *   - genre name
 *   - tiny sparkline of that genre's full arc
 *   - current-level badge
 *   - active indicator (bracket) when selected
 * ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
 * GenreSelector — 3-level hierarchy:
 *   Genre (18)  → ▸ expand shows
 *     Sub-genre (294) → ▸ expand shows
 *       Micro-style (1180)
 *
 * Click on chevron: expand/collapse
 * Click anywhere else on the row: toggle selection (add to overlay)
 * ═══════════════════════════════════════════════════════════════════ */

function GenreSelector({
  genres, subTree, selected,
  expandedGenres, expandedSubs,
  onToggle, onToggleGenreExpanded, onToggleSubExpanded,
}) {
  // Totals for the header badge — gives the user a sense of scope
  let totalSubs = 0, totalMicros = 0;
  for (const g of genres) {
    const subs = subTree[g] || {};
    for (const [_, micros] of Object.entries(subs)) {
      totalSubs++;
      totalMicros += micros.length;
    }
  }

  return (
    <aside style={{
      width: 310, flexShrink: 0,
      borderRight: `1px solid ${T.border}`,
      paddingRight: T.s4,
      position: "relative",
      zIndex: 2,
      maxHeight: "calc(100vh - 220px)",
      overflowY: "auto",
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10,
        letterSpacing: "0.25em",
        color: T.textMuted,
        marginBottom: T.s4,
        display: "flex", justifyContent: "space-between",
        position: "sticky", top: 0,
        background: T.bg,
        paddingBottom: T.s2,
        zIndex: 3,
      }}>
        <span>░ SPECIMENS · {genres.length}</span>
        <span style={{ color: T.textMuted, opacity: 0.7 }}>
          +{totalSubs} · +{totalMicros}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {genres.map(name => (
          <GenreBlock
            key={name}
            name={name}
            subs={subTree[name] || {}}
            selectedSet={new Set(selected)}
            expandedGenre={expandedGenres.has(name)}
            expandedSubs={expandedSubs}
            onToggle={onToggle}
            onToggleGenreExpanded={() => onToggleGenreExpanded(name)}
            onToggleSubExpanded={onToggleSubExpanded}
          />
        ))}
      </div>
      <div style={{
        marginTop: T.s5, paddingTop: T.s4,
        borderTop: `1px dashed ${T.border}`,
        fontFamily: T.fontMono, fontSize: 10,
        color: T.textMuted, lineHeight: 1.6,
      }}>
        Maximum overlay: {MAX_OVERLAY} items.<br/>
        ▸ reveal strains · ▸▸ reveal variants.
      </div>
    </aside>
  );
}

function GenreBlock({
  name, subs, selectedSet, expandedGenre, expandedSubs,
  onToggle, onToggleGenreExpanded, onToggleSubExpanded,
}) {
  const color = GENRE_COLORS[name] || "#888";
  const s = useMemo(() => getGenreSeries(name), [name]);
  const current = s ? currentValue(s.series) : 0;
  const peak = s ? findPeak(s.series) : null;
  const active = selectedSet.has(name);
  const [hover, setHover] = useState(false);
  const subNames = Object.keys(subs);

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center",
          background: active ? "rgba(57,255,65,0.05)" : (hover ? "rgba(255,255,255,0.02)" : "transparent"),
          borderLeft: `2px solid ${active ? color : "transparent"}`,
          transition: "background 120ms, border-color 120ms",
        }}
      >
        <button
          onClick={onToggleGenreExpanded}
          disabled={subNames.length === 0}
          aria-label={expandedGenre ? "collapse" : "expand"}
          style={{
            width: 22, height: 30,
            padding: 0, background: "transparent", border: "none",
            color: subNames.length ? T.textSec : T.textDim,
            cursor: subNames.length ? "pointer" : "default",
            fontFamily: T.fontMono, fontSize: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {subNames.length > 0 ? (expandedGenre ? "▾" : "▸") : "·"}
        </button>

        <button
          onClick={() => onToggle(name)}
          style={{
            flex: 1, minWidth: 0,
            display: "flex", alignItems: "center", gap: T.s3,
            padding: `${T.s2}px ${T.s3}px ${T.s2}px 0`,
            background: "transparent", border: "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: color,
            boxShadow: active ? `0 0 10px ${color}` : "none",
            flexShrink: 0,
            transition: "box-shadow 200ms",
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.fontSans, fontSize: 12,
              color: active ? T.text : T.textSec,
              fontWeight: active ? 500 : 400,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {name}
            </div>
            <div style={{
              fontFamily: T.fontMono, fontSize: 9,
              color: T.textMuted, letterSpacing: "0.08em",
              marginTop: 1,
            }}>
              peak · {peak ? peak.year : "—"} · {peak ? Math.round(peak.value) : "—"}
              {subNames.length > 0 && (
                <span style={{ color: T.textDim }}> · {subNames.length} strains</span>
              )}
            </div>
          </div>
          <NodeSparkline series={s?.series} color={color} dim={!active} />
          <span style={{
            fontFamily: T.fontMono, fontSize: 10,
            color: active ? MATRIX : T.textMuted,
            minWidth: 22, textAlign: "right",
          }}>
            {Math.round(current)}
          </span>
        </button>
      </div>

      {expandedGenre && subNames.length > 0 && (
        <div style={{
          marginLeft: 22,
          borderLeft: `1px dashed ${T.border}`,
          paddingLeft: T.s2,
          marginTop: 1,
          marginBottom: T.s2,
        }}>
          {subNames.map(subName => {
            const subKey = keySub(name, subName);
            const micros = subs[subName] || [];
            return (
              <SubRow
                key={subKey}
                grandparent={name}
                parent={subName}
                micros={micros}
                parentColor={color}
                active={selectedSet.has(subKey)}
                onToggle={() => onToggle(subKey)}
                expandedSub={expandedSubs.has(subKey)}
                onToggleExpanded={() => onToggleSubExpanded(subKey)}
                selectedSet={selectedSet}
                onToggleKey={onToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubRow({
  grandparent, parent, micros, parentColor,
  active, onToggle,
  expandedSub, onToggleExpanded,
  selectedSet, onToggleKey,
}) {
  const s = useMemo(() => getSubgenreSeries(grandparent, parent), [grandparent, parent]);
  const current = s ? currentValue(s.series) : 0;
  const [hover, setHover] = useState(false);

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center",
          background: active ? "rgba(57,255,65,0.06)" : (hover ? "rgba(255,255,255,0.02)" : "transparent"),
          borderLeft: `2px solid ${active ? parentColor : "transparent"}`,
          transition: "background 120ms",
        }}
      >
        <button
          onClick={onToggleExpanded}
          disabled={micros.length === 0}
          aria-label={expandedSub ? "collapse" : "expand"}
          style={{
            width: 18, height: 24,
            padding: 0, background: "transparent", border: "none",
            color: micros.length ? T.textSec : T.textDim,
            cursor: micros.length ? "pointer" : "default",
            fontFamily: T.fontMono, fontSize: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {micros.length > 0 ? (expandedSub ? "▾" : "▸") : "·"}
        </button>

        <button
          onClick={onToggle}
          style={{
            flex: 1, minWidth: 0,
            display: "flex", alignItems: "center", gap: T.s2,
            padding: `3px ${T.s2}px 3px 0`,
            background: "transparent", border: "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: parentColor,
            opacity: active ? 1 : 0.55,
            boxShadow: active ? `0 0 6px ${parentColor}` : "none",
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.fontSans, fontSize: 11,
              color: active ? T.text : T.textSec,
              fontWeight: active ? 500 : 400,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {parent}
              {micros.length > 0 && (
                <span style={{ color: T.textDim, marginLeft: 4, fontSize: 9 }}>
                  · {micros.length}
                </span>
              )}
            </div>
          </div>
          <NodeSparkline series={s?.series} color={parentColor} dim={!active} />
          <span style={{
            fontFamily: T.fontMono, fontSize: 9,
            color: active ? MATRIX : T.textMuted,
            minWidth: 20, textAlign: "right",
          }}>
            {Math.round(current)}
          </span>
        </button>
      </div>

      {expandedSub && micros.length > 0 && (
        <div style={{
          marginLeft: 18,
          borderLeft: `1px dotted ${T.border}`,
          paddingLeft: 6,
          marginTop: 1,
          marginBottom: 4,
        }}>
          {micros.map(microName => {
            const microKey = keyMicro(grandparent, parent, microName);
            return (
              <MicroRow
                key={microKey}
                grandparent={grandparent}
                sub={parent}
                name={microName}
                parentColor={parentColor}
                active={selectedSet.has(microKey)}
                onToggle={() => onToggleKey(microKey)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MicroRow({ grandparent, sub, name, parentColor, active, onToggle }) {
  const s = useMemo(
    () => getMicrostyleSeries(grandparent, sub, name),
    [grandparent, sub, name],
  );
  const current = s ? currentValue(s.series) : 0;
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        width: "100%",
        padding: `2px ${T.s2}px`,
        background: active ? "rgba(57,255,65,0.07)" : (hover ? "rgba(255,255,255,0.02)" : "transparent"),
        border: "none",
        borderLeft: `2px solid ${active ? parentColor : "transparent"}`,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 120ms",
      }}
    >
      {/* Micro gets a bracket marker instead of a dot — visual
          signal that it's one level deeper than a sub. */}
      <span style={{
        width: 8,
        fontFamily: T.fontMono, fontSize: 8,
        color: parentColor,
        opacity: active ? 1 : 0.5,
        flexShrink: 0,
        textAlign: "center",
      }}>
        └
      </span>
      <div style={{
        flex: 1, minWidth: 0,
        fontFamily: T.fontSans, fontSize: 10,
        color: active ? T.text : T.textSec,
        fontWeight: active ? 500 : 400,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {name}
      </div>
      <NodeSparkline series={s?.series} color={parentColor} dim={!active} width={32} height={12} />
      <span style={{
        fontFamily: T.fontMono, fontSize: 9,
        color: active ? MATRIX : T.textMuted,
        minWidth: 18, textAlign: "right",
      }}>
        {Math.round(current)}
      </span>
    </button>
  );
}

function NodeSparkline({ series, color, dim, width = 42, height = 16 }) {
  if (!series) return <svg width={width} height={height} />;
  // Downsample to ~28 points for a clean sparkline
  const target = 28;
  const STEP = Math.ceil(series.length / target);
  const points = [];
  for (let i = 0; i < series.length; i += STEP) points.push(series[i]);
  if (points[points.length - 1] !== series[series.length - 1]) {
    points.push(series[series.length - 1]);
  }
  const W = width, H = height;
  const xs = i => (i / (points.length - 1)) * W;
  const ys = v => H - (v / 100) * H;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} style={{ flexShrink: 0, overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1}
        opacity={dim ? 0.35 : 0.85} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * ChartPanel — the central multi-line chart with hover scan-line
 * and tooltip. Canvas 2D rendering for:
 *   - full control over glow layers (stacked strokes with blur)
 *   - smooth animation on timeRange / selection changes
 *   - cheap redraws on hover (only the scan-line overlay is DOM)
 * ═══════════════════════════════════════════════════════════════════ */

const CHART_HEIGHT = 420;
const CHART_PADDING = { top: 24, right: 40, bottom: 32, left: 48 };

function ChartPanel({ serieses, timeRange, hoverT, onHoverT }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: CHART_HEIGHT });

  // Resize handling — canvas is drawn at DPR × CSS size for crisp
  // rendering on retina, and the chart reflows when the viewport
  // changes.
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: Math.max(400, rect.width), h: CHART_HEIGHT });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Render pipeline ─────────────────────────────────────────────
  // Runs whenever input data or the viewport changes. Tooltip hover
  // DOES NOT retrigger this — the hover scan-line is an overlay div.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = size.w + "px";
    canvas.style.height = size.h + "px";
    ctx.scale(dpr, dpr);

    drawChart(ctx, size.w, size.h, serieses, timeRange);
  }, [size, serieses, timeRange]);

  // ── Pointer tracking for scan-line ──────────────────────────────
  const handleMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { left, right } = {
      left: CHART_PADDING.left,
      right: size.w - CHART_PADDING.right,
    };
    if (x < left || x > right) { onHoverT(null); return; }
    const p = (x - left) / (right - left);
    const t = timeRange.start + p * (timeRange.end - timeRange.start);
    onHoverT(t);
  };
  const handleLeave = () => onHoverT(null);

  // Where to draw the scan-line overlay in pixels
  const scanX = hoverT == null ? null :
    CHART_PADDING.left +
    ((hoverT - timeRange.start) / (timeRange.end - timeRange.start)) *
    (size.w - CHART_PADDING.left - CHART_PADDING.right);

  // Values at hoverT for tooltip
  const hoverValues = useMemo(() => {
    if (hoverT == null) return [];
    return serieses.map(s => {
      // Binary search would be cleaner but linear is fine at 684
      // points; this runs only on hover events, not every frame.
      let closest = s.series[0];
      for (const pt of s.series) {
        if (Math.abs(pt.t - hoverT) < Math.abs(closest.t - hoverT)) closest = pt;
      }
      return {
        key: s.key,
        name: s.displayName || s.name,
        parent: s.parent,
        grand: s.grand,
        kind: s.kind,
        color: s.color,
        value: closest.value,
        year: closest.year,
        month: closest.month,
      };
    }).sort((a, b) => b.value - a.value);
  }, [serieses, hoverT]);

  return (
    <div ref={containerRef} style={{
      position: "relative",
      width: "100%",
      height: CHART_HEIGHT,
      background: "rgba(6,8,14,0.4)",
      border: `1px solid ${T.border}`,
      borderRadius: 2,
    }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ display: "block", cursor: "crosshair" }}
      />

      {/* ── Hover scan-line ─────────────────────────────────── */}
      {scanX != null && (
        <div style={{
          position: "absolute",
          left: scanX, top: CHART_PADDING.top,
          width: 1, height: size.h - CHART_PADDING.top - CHART_PADDING.bottom,
          background: `linear-gradient(to bottom,
            rgba(57,255,65,0),
            rgba(57,255,65,0.5),
            rgba(57,255,65,0))`,
          pointerEvents: "none",
        }} />
      )}

      {/* ── Hover tooltip ───────────────────────────────────── */}
      {hoverT != null && hoverValues.length > 0 && (
        <HoverTooltip
          values={hoverValues}
          hoverT={hoverT}
          scanX={scanX}
          chartW={size.w}
        />
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {serieses.length === 0 && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: T.fontMono, fontSize: 11,
          color: T.textMuted, letterSpacing: "0.2em",
          textAlign: "center", padding: T.s5,
        }}>
          ░ SELECT A SPECIMEN TO BEGIN OBSERVATION ░
        </div>
      )}
    </div>
  );
}

function HoverTooltip({ values, hoverT, scanX, chartW }) {
  // Month name lookup
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year = values[0].year;
  const monthName = MONTHS[values[0].month - 1];
  // Place tooltip to the left of scan-line if scan is on right half,
  // otherwise to the right. Keeps tooltip inside the chart.
  const onRight = scanX > chartW / 2;
  return (
    <div style={{
      position: "absolute",
      left: onRight ? "auto" : scanX + 12,
      right: onRight ? (chartW - scanX + 12) : "auto",
      top: CHART_PADDING.top + 8,
      pointerEvents: "none",
      background: "rgba(6,8,14,0.96)",
      border: `1px solid rgba(57,255,65,0.35)`,
      borderRadius: 2,
      padding: `${T.s3}px ${T.s4}px`,
      minWidth: 180,
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
      zIndex: 4,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 9,
        color: MATRIX, letterSpacing: "0.25em",
        marginBottom: T.s2,
      }}>
        {monthName.toUpperCase()} {year}
      </div>
      {values.map(v => {
        // Breadcrumb text for sub/micro. For micros we show
        // "GENRE · SUB" on a single top line; for subs, just the
        // genre. Keeps the lineage visible so "Atlanta trap" isn't
        // ambiguous about which parent it belongs to.
        const crumb = v.kind === "micro" ? `${v.grand} · ${v.parent}`
                    : v.kind === "sub"   ? v.parent
                    :                      null;
        return (
          <div key={v.key} style={{
            display: "flex", alignItems: "center", gap: T.s2,
            padding: "2px 0",
            fontFamily: T.fontMono, fontSize: 11,
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: v.kind === "genre" ? "50%"
                          : v.kind === "sub"   ? 0
                          :                      "50%",
              background: v.kind === "micro" ? "transparent" : v.color,
              border: v.kind === "micro" ? `1.5px solid ${v.color}` : "none",
              flexShrink: 0,
            }} />
            <span style={{
              flex: 1, color: T.textSec, minWidth: 0,
              display: "flex", flexDirection: "column",
            }}>
              {crumb && (
                <span style={{
                  fontSize: 8, color: T.textMuted, letterSpacing: "0.12em",
                  lineHeight: 1, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {crumb.toUpperCase()}
                </span>
              )}
              <span style={{
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {v.name}
              </span>
            </span>
            <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {v.value.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Chart drawing — pure Canvas 2D.
 * Layers (bottom → top):
 *   1. Grid lines + Y/X ticks
 *   2. Line underglow (area fill, very faint gradient)
 *   3. Line outer glow (wide blurred stroke)
 *   4. Line inner stroke (crisp)
 *   5. Latest-value endpoint dots
 * ═══════════════════════════════════════════════════════════════════ */

function drawChart(ctx, W, H, serieses, timeRange) {
  ctx.clearRect(0, 0, W, H);

  const plotX = CHART_PADDING.left;
  const plotY = CHART_PADDING.top;
  const plotW = W - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = H - CHART_PADDING.top - CHART_PADDING.bottom;

  // ── Grid ────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let v = 0; v <= 100; v += 20) {
    const y = plotY + plotH * (1 - v / 100);
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();
  }
  // Year ticks — every 5 years
  const startY = Math.ceil(timeRange.start / 5) * 5;
  const endY = Math.floor(timeRange.end);
  for (let y = startY; y <= endY; y += 5) {
    const x = plotX + ((y - timeRange.start) / (timeRange.end - timeRange.start)) * plotW;
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.beginPath();
    ctx.moveTo(x, plotY);
    ctx.lineTo(x, plotY + plotH);
    ctx.stroke();
  }

  // ── Y axis labels ───────────────────────────────────────────────
  ctx.fillStyle = "rgba(160,160,170,0.6)";
  ctx.font = "10px ui-monospace, 'Geist Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = 0; v <= 100; v += 20) {
    const y = plotY + plotH * (1 - v / 100);
    ctx.fillText(String(v), plotX - 8, y);
  }
  // X axis labels — every 10 years
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let y = Math.ceil(timeRange.start / 10) * 10; y <= endY; y += 10) {
    const x = plotX + ((y - timeRange.start) / (timeRange.end - timeRange.start)) * plotW;
    ctx.fillText(String(y), x, plotY + plotH + 8);
  }

  // ── Axis labels (subtle) ────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "rgba(130,130,140,0.5)";
  ctx.font = "9px ui-monospace, 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("RELATIVE · 0–100", plotX - 8, plotY - 8);
  ctx.textAlign = "right";
  ctx.fillText("TIME · YEARS", plotX + plotW, plotY + plotH + 24);
  ctx.restore();

  // ── Lines ───────────────────────────────────────────────────────
  for (const s of serieses) {
    drawSeries(ctx, s.series, timeRange, plotX, plotY, plotW, plotH, s.color, s.kind);
  }

  // ── Endpoint labels on rightmost points ─────────────────────────
  // Small genre-name labels at each line's end so reader identifies
  // them without tooltip.
  const endpointPoints = serieses.map(s => {
    const pts = s.series.filter(p => p.t >= timeRange.start && p.t <= timeRange.end);
    if (!pts.length) return null;
    const last = pts[pts.length - 1];
    return {
      name: s.displayName || s.name,
      color: s.color,
      x: plotX + ((last.t - timeRange.start) / (timeRange.end - timeRange.start)) * plotW,
      y: plotY + plotH * (1 - last.value / 100),
      value: last.value,
    };
  }).filter(Boolean);

  // Sort by y position and offset overlapping labels
  endpointPoints.sort((a, b) => a.y - b.y);
  const MIN_GAP = 14;
  for (let i = 1; i < endpointPoints.length; i++) {
    if (endpointPoints[i].y - endpointPoints[i - 1].y < MIN_GAP) {
      endpointPoints[i].y = endpointPoints[i - 1].y + MIN_GAP;
    }
  }

  ctx.font = "10px ui-monospace, 'Geist Mono', monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const ep of endpointPoints) {
    ctx.fillStyle = ep.color;
    ctx.globalAlpha = 0.92;
    // Trim long genre names for the endpoint label
    const label = ep.name.length > 16 ? ep.name.slice(0, 15) + "…" : ep.name;
    ctx.fillText(label, ep.x + 8, ep.y);
  }
  ctx.globalAlpha = 1;
}

// Draw a single series with glow layers. Stroke style encodes the
// kind hierarchy:
//   genre: solid, widest, strongest glow
//   sub:   dashed, medium
//   micro: dotted, thinnest, subtle glow
// This is a visual hierarchy that mirrors the data hierarchy — a
// user can scan the chart and immediately know whether they're
// looking at a top-level genre trend or a fine-grained micro variant.
function drawSeries(ctx, series, timeRange, plotX, plotY, plotW, plotH, color, kind) {
  const pts = series.filter(p => p.t >= timeRange.start && p.t <= timeRange.end);
  if (pts.length < 2) return;

  const projected = pts.map(p => ({
    x: plotX + ((p.t - timeRange.start) / (timeRange.end - timeRange.start)) * plotW,
    y: plotY + plotH * (1 - p.value / 100),
    value: p.value,
  }));

  const path = new Path2D();
  path.moveTo(projected[0].x, projected[0].y);
  for (let i = 0; i < projected.length - 1; i++) {
    const p0 = projected[i];
    const p1 = projected[i + 1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    path.quadraticCurveTo(p0.x, p0.y, midX, midY);
  }
  const last = projected[projected.length - 1];
  path.lineTo(last.x, last.y);

  const isSub = kind === "sub";
  const isMicro = kind === "micro";

  // ── Layer 1: area fill ───────────────────────────────────────
  const areaPath = new Path2D();
  areaPath.addPath(path);
  areaPath.lineTo(last.x, plotY + plotH);
  areaPath.lineTo(projected[0].x, plotY + plotH);
  areaPath.closePath();
  const grad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
  const fillAlpha = isMicro ? "08" : isSub ? "10" : "18";
  grad.addColorStop(0, color + fillAlpha);
  grad.addColorStop(1, color + "00");
  ctx.fillStyle = grad;
  ctx.fill(areaPath);

  // ── Layer 2: outer glow ──────────────────────────────────────
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = isMicro ? 7 : isSub ? 10 : 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = isMicro ? 0.9 : isSub ? 1.1 : 1.4;
  ctx.globalAlpha = isMicro ? 0.28 : isSub ? 0.35 : 0.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(path);
  ctx.restore();

  // ── Layer 3: crisp inner stroke ──────────────────────────────
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = isMicro ? 1.0 : isSub ? 1.3 : 1.8;
  ctx.globalAlpha = isMicro ? 0.75 : isSub ? 0.85 : 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (isMicro) ctx.setLineDash([2, 3]);
  else if (isSub) ctx.setLineDash([4, 3]);
  ctx.stroke(path);
  ctx.restore();

  // ── Layer 4: endpoint dot ────────────────────────────────────
  const dotR = isMicro ? 1.8 : isSub ? 2.2 : 3;
  ctx.beginPath();
  ctx.arc(last.x, last.y, dotR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = isMicro ? 5 : isSub ? 7 : 10;
  ctx.beginPath();
  ctx.arc(last.x, last.y, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════════
 * TimelineScrubber — drag-to-narrow the time range. Both ends are
 * independently draggable; clicking outside the handles resets to
 * full range.
 * ═══════════════════════════════════════════════════════════════════ */

function TimelineScrubber({ timeRange, onRangeChange }) {
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(null); // { handle: "start" | "end", startX, orig: {start,end} }

  const fullStart = TIME_RANGE.startYear;
  const fullEnd = TIME_RANGE.endYear + TIME_RANGE.endMonth / 12;
  const fullSpan = fullEnd - fullStart;

  const startP = (timeRange.start - fullStart) / fullSpan;
  const endP = (timeRange.end - fullStart) / fullSpan;

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const p = px / rect.width;
      const t = fullStart + p * fullSpan;
      if (drag.handle === "start") {
        const newStart = Math.min(timeRange.end - 2, Math.max(fullStart, t));
        onRangeChange({ ...timeRange, start: newStart });
      } else {
        const newEnd = Math.max(timeRange.start + 2, Math.min(fullEnd, t));
        onRangeChange({ ...timeRange, end: newEnd });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, timeRange, onRangeChange, fullStart, fullSpan]);

  const reset = () => onRangeChange({ start: fullStart, end: fullEnd });

  return (
    <div style={{ marginTop: T.s5 }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: T.s2,
      }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: "0.22em",
        }}>
          ░ TEMPORAL WINDOW
        </div>
        <button onClick={reset} style={{
          background: "transparent", border: "none",
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textSec, letterSpacing: "0.15em",
          cursor: "pointer", padding: 0,
        }}>
          ↻ FULL RANGE
        </button>
      </div>

      <div
        ref={trackRef}
        style={{
          position: "relative",
          height: 32,
          background: "rgba(6,8,14,0.5)",
          border: `1px solid ${T.border}`,
          borderRadius: 2,
          userSelect: "none",
        }}
      >
        {/* Selected window */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0,
          left: `${startP * 100}%`,
          width: `${(endP - startP) * 100}%`,
          background: "rgba(57,255,65,0.07)",
          borderLeft: `1px solid ${MATRIX}`,
          borderRight: `1px solid ${MATRIX}`,
        }} />

        {/* Start handle */}
        <ScrubberHandle
          leftPercent={startP * 100}
          active={drag?.handle === "start"}
          onDown={(e) => setDrag({ handle: "start", startX: e.clientX, orig: timeRange })}
          label={formatT(timeRange.start)}
        />
        {/* End handle */}
        <ScrubberHandle
          leftPercent={endP * 100}
          active={drag?.handle === "end"}
          onDown={(e) => setDrag({ handle: "end", startX: e.clientX, orig: timeRange })}
          label={formatT(timeRange.end)}
        />
      </div>
    </div>
  );
}

function ScrubberHandle({ leftPercent, active, onDown, label }) {
  return (
    <div
      onPointerDown={onDown}
      style={{
        position: "absolute",
        top: -2, bottom: -2,
        left: `${leftPercent}%`,
        width: 2,
        background: MATRIX,
        cursor: "ew-resize",
        transform: "translateX(-50%)",
        boxShadow: active ? `0 0 12px ${MATRIX}` : `0 0 6px ${MATRIX}80`,
      }}
    >
      <div style={{
        position: "absolute",
        left: "50%", top: "100%",
        transform: "translate(-50%, 4px)",
        fontFamily: T.fontMono, fontSize: 9,
        color: MATRIX, letterSpacing: "0.1em",
        whiteSpace: "nowrap", pointerEvents: "none",
      }}>
        {label}
      </div>
    </div>
  );
}

function formatT(t) {
  const year = Math.floor(t);
  const m = Math.round((t - year) * 12) + 1;
  const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const mm = MONTHS[Math.min(11, Math.max(0, m - 1))];
  return `${year}·${mm}`;
}

/* ═══════════════════════════════════════════════════════════════════
 * EraStrip — below the scrubber, labels for cultural eras aligned
 * to the full range. Read-only — for orientation only.
 * ═══════════════════════════════════════════════════════════════════ */

function EraStrip() {
  const fullStart = TIME_RANGE.startYear;
  const fullEnd = TIME_RANGE.endYear + TIME_RANGE.endMonth / 12;
  const fullSpan = fullEnd - fullStart;

  return (
    <div style={{
      marginTop: T.s5,
      position: "relative",
      height: 14,
    }}>
      {ERAS.map(era => {
        const midT = (era.start + era.end) / 2;
        const leftP = (midT - fullStart) / fullSpan;
        return (
          <div key={era.label} style={{
            position: "absolute",
            left: `${leftP * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
            fontFamily: T.fontMono, fontSize: 8.5,
            color: T.textMuted, letterSpacing: "0.2em",
            whiteSpace: "nowrap",
          }}>
            {era.label}
          </div>
        );
      })}
    </div>
  );
}
