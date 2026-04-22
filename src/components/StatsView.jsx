import React from "react";
import { T } from "../theme.js";

export default function StatsView({ category, items, raw, derived }) {
  // Tree categories: show a different stats layout — sub/micro counts per main
  if (category.shape === "tree-main") {
    return <TreeStats category={category} items={items} />;
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
                  display: "grid", gridTemplateColumns: "200px 1fr 50px",
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

function TreeStats({ category, items }) {
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
                display: "grid", gridTemplateColumns: "200px 1fr 50px",
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
