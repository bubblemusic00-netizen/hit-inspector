import React from "react";
import { T } from "../theme.js";
import { LINGUISTIC_FAMILIES, MUSIC_CONTEXT_CLUSTERS } from "../language-families.js";
import { useIsMobile } from "../responsive.js";

export default function StatsView({ category, items, raw, derived }) {
  const isMobile = useIsMobile();
  // Tree categories: show a different stats layout — sub/micro counts per main
  if (category.shape === "tree-main") {
    return <TreeStats category={category} items={items} isMobile={isMobile} />;
  }
  if (category.shape === "tree-sub" || category.shape === "tree-micro") {
    return (
      <div style={{ color: T.textMuted, fontSize: 13, fontFamily: T.fontSans }}>
        Statistics for {category.label.toLowerCase()} are visualized on the
        Genres page.
      </div>
    );
  }

  if (items.length === 0) {
    return <div style={{ color: T.textMuted, fontFamily: T.fontSans }}>No items.</div>;
  }

  // Languages: no complement table to measure, but we CAN show
  // distribution across the two taxonomies defined in language-families.js
  if (category.id === "languages") {
    return <LanguageStats items={items} />;
  }

  // Flat category stats
  const xrefValues = items.map(i => i.xref || 0);
  const hasEntry = items.filter(i => i.hasOwnEntry).length;
  const maxXref = Math.max(...xrefValues);
  const avgXref = xrefValues.reduce((a, b) => a + b, 0) / items.length;

  // Sort desc by xref
  const sorted = [...items].sort((a, b) => (b.xref || 0) - (a.xref || 0) || a.label.localeCompare(b.label));

  return (
    <div>
      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: T.s3, marginBottom: T.s5,
      }}>
        <StatCard label="Total items"    value={items.length} />
        {category.complementTable && (
          <StatCard label="With own entry" value={`${hasEntry} / ${items.length}`}
                    tint={hasEntry === items.length ? T.success : T.warning} />
        )}
        {category.complementTable && <StatCard label="Most referenced" value={maxXref} />}
        {category.complementTable && <StatCard label="Avg references"  value={avgXref.toFixed(1)} />}
      </div>

      {/* Bar chart */}
      {category.complementTable && (
        <div>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10,
            color: T.textMuted, letterSpacing: "0.2em",
            textTransform: "uppercase", marginBottom: T.s3,
          }}>Cross-reference ranking</div>
          <div style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: T.r_md,
            padding: T.s3,
          }}>
            {sorted.map((it, i) => {
              const pct = maxXref > 0 ? (it.xref / maxXref) * 100 : 0;
              const color = T.palette[i % T.palette.length];
              return (
                <div key={it.id} style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "130px 1fr 40px" : "200px 1fr 50px",
                  alignItems: "center", gap: T.s3,
                  padding: `${T.s1}px 0`,
                }}>
                  <div style={{ color: T.text, fontSize: 12, fontFamily: T.fontSans,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.label}
                  </div>
                  <div style={{
                    position: "relative", height: 18, background: T.bg,
                    borderRadius: T.r_sm, overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: color, opacity: 0.6,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <div style={{
                    textAlign: "right", color: T.textSec,
                    fontFamily: T.fontMono, fontSize: 12,
                  }}>{it.xref}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tint }) {
  return (
    <div style={{
      padding: T.s4,
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: T.r_md,
    }}>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10,
        color: T.textMuted, letterSpacing: "0.2em",
        textTransform: "uppercase", marginBottom: T.s2,
      }}>{label}</div>
      <div style={{
        fontFamily: T.fontSans, fontSize: 22, fontWeight: 600,
        color: tint || T.text,
      }}>{value}</div>
    </div>
  );
}

function TreeStats({ category, items, isMobile }) {
  const total = items.length;
  const totalSubs = items.reduce((a, it) => a + (it.meta?.subCount || 0), 0);
  const totalMicros = items.reduce((a, it) => a + (it.meta?.microCount || 0), 0);
  const maxMicros = Math.max(...items.map(it => it.meta?.microCount || 0));
  const sorted = [...items].sort((a, b) => (b.meta?.microCount || 0) - (a.meta?.microCount || 0));

  return (
    <div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: T.s3, marginBottom: T.s5,
      }}>
        <StatCard label={`Top-level ${category.label.toLowerCase()}`} value={total} />
        <StatCard label="Total sub-entries"   value={totalSubs} />
        <StatCard label="Total micro-entries" value={totalMicros} />
        <StatCard label="Avg per top-level"   value={totalSubs === 0 ? "—" : (totalSubs / total).toFixed(1)} />
      </div>

      <div>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: "0.2em",
          textTransform: "uppercase", marginBottom: T.s3,
        }}>Micro-entry distribution</div>
        <div style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: T.r_md,
          padding: T.s3,
        }}>
          {sorted.map((it, i) => {
            const val = it.meta?.microCount || 0;
            const pct = maxMicros > 0 ? (val / maxMicros) * 100 : 0;
            const color = T.palette[i % T.palette.length];
            return (
              <div key={it.id} style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "130px 1fr 40px" : "200px 1fr 50px",
                alignItems: "center", gap: T.s3,
                padding: `${T.s1}px 0`,
              }}>
                <div style={{ color: T.text, fontSize: 12, fontFamily: T.fontSans,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.label}
                </div>
                <div style={{
                  position: "relative", height: 18, background: T.bg,
                  borderRadius: T.r_sm, overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: `${pct}%`, background: color, opacity: 0.6,
                  }} />
                </div>
                <div style={{
                  textAlign: "right", color: T.textSec,
                  fontFamily: T.fontMono, fontSize: 12,
                }}>{val}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Languages stats — distribution across both taxonomies. No cross-ref
// data (languages don't have complement tables), so show group sizes
// instead as the primary signal.
// ═══════════════════════════════════════════════════════════════════════
function LanguageStats({ items }) {
  // Count languages per group in each taxonomy
  const countGroup = (groups) => {
    const codes = new Set(items.map(it => it.id));
    const result = [];
    let placed = 0;
    for (const [name, groupCodes] of Object.entries(groups)) {
      const hit = groupCodes.filter(c => codes.has(c));
      if (hit.length > 0) {
        result.push({ name, count: hit.length });
        placed += hit.length;
      }
    }
    const uncategorized = items.length - placed;
    if (uncategorized > 0) result.push({ name: "Uncategorized", count: uncategorized, isWarning: true });
    return result;
  };

  const linguistic = countGroup(LINGUISTIC_FAMILIES);
  const music = countGroup(MUSIC_CONTEXT_CLUSTERS);
  const linguisticMax = Math.max(...linguistic.map(g => g.count));
  const musicMax = Math.max(...music.map(g => g.count));

  return (
    <div>
      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: T.s3, marginBottom: T.s5,
      }}>
        <StatCard label="Total languages"   value={items.length} />
        <StatCard label="Linguistic groups" value={linguistic.filter(g => !g.isWarning).length} />
        <StatCard label="Music-context groups" value={music.filter(g => !g.isWarning).length} />
      </div>

      {/* Two side-by-side bar charts */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: T.s4,
      }}>
        <GroupChart title="Linguistic families"    groups={linguistic} max={linguisticMax} />
        <GroupChart title="Music-context clusters" groups={music}      max={musicMax} />
      </div>
    </div>
  );
}

function GroupChart({ title, groups, max }) {
  return (
    <div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 10,
        color: T.textMuted, letterSpacing: "0.2em",
        textTransform: "uppercase", marginBottom: T.s3,
      }}>{title}</div>
      <div style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: T.r_md,
        padding: T.s3,
      }}>
        {groups.map((g, i) => {
          const pct = max > 0 ? (g.count / max) * 100 : 0;
          const color = g.isWarning ? T.warning : T.palette[i % T.palette.length];
          return (
            <div key={g.name} style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 32px",
              alignItems: "center", gap: T.s3,
              padding: `${T.s1}px 0`,
            }}>
              <div style={{
                color: g.isWarning ? T.warning : T.text,
                fontSize: 12, fontFamily: T.fontSans,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{g.name}</div>
              <div style={{
                position: "relative", height: 14, background: T.bg,
                borderRadius: T.r_sm, overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${pct}%`, background: color, opacity: 0.6,
                }} />
              </div>
              <div style={{
                textAlign: "right", color: T.textSec,
                fontFamily: T.fontMono, fontSize: 12,
              }}>{g.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
