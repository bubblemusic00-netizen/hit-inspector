import React from "react";
import { T } from "../theme.js";
import { CATEGORIES, flattenCategoryItems } from "../categories.js";

export default function OverviewPage({ raw, derived }) {
  const rows = CATEGORIES.map(cat => {
    const items = flattenCategoryItems(cat, raw.data, derived);
    let coverage = null;
    if (cat.complementTable) {
      const has = items.filter(i => i.hasOwnEntry).length;
      coverage = { has, total: items.length, pct: items.length ? (has / items.length) * 100 : 0 };
    }
    return { cat, count: items.length, coverage };
  });

  // Group by category group for the overview layout
  const groups = {};
  for (const r of rows) {
    if (!groups[r.cat.group]) groups[r.cat.group] = [];
    groups[r.cat.group].push(r);
  }

  return (
    <div style={{ padding: T.s5 }}>
      <header style={{ marginBottom: T.s5 }}>
        <h1 style={{
          margin: 0, fontFamily: T.fontSans,
          fontSize: 24, fontWeight: 600, color: T.text,
        }}>Catalog overview</h1>
        <div style={{
          marginTop: T.s2, color: T.textSec, fontFamily: T.fontSans, fontSize: 13,
        }}>
          Live view of Hit Engine's data catalogs. Re-reads source on every
          page load — edit <code style={{ color: T.info, fontFamily: T.fontMono }}>App.jsx</code>, refresh, see changes.
        </div>
      </header>

      {Object.keys(groups).map(groupName => (
        <section key={groupName} style={{ marginBottom: T.s5 }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10,
            color: T.textMuted, letterSpacing: "0.2em",
            textTransform: "uppercase", marginBottom: T.s3,
          }}>{groupName}</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: T.s3,
          }}>
            {groups[groupName].map(r => <Tile key={r.cat.id} row={r} />)}
          </div>
        </section>
      ))}

      {/* Meta footer */}
      <div style={{
        marginTop: T.s6, padding: T.s4,
        background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_md,
        fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, lineHeight: 1.7,
      }}>
        <strong style={{ color: T.textSec }}>Source file:</strong> {raw.sourcePath}<br />
        <strong style={{ color: T.textSec }}>Size:</strong> {(raw.sourceSize / 1024 / 1024).toFixed(2)} MB<br />
        <strong style={{ color: T.textSec }}>Last modified:</strong> {new Date(raw.sourceModified).toLocaleString()}<br />
        <strong style={{ color: T.textSec }}>Complement tables loaded:</strong> {derived.COMPLEMENT_TABLES.filter(t => Object.keys(t.data).length > 0).length} / {derived.COMPLEMENT_TABLES.length}
      </div>
    </div>
  );
}

function Tile({ row }) {
  const { cat, count, coverage } = row;
  const hasGap = coverage && coverage.pct < 100;
  return (
    <div style={{
      padding: T.s4,
      background: T.bgCard,
      border: `1px solid ${hasGap ? T.warning : T.border}`,
      borderRadius: T.r_md,
    }}>
      <div style={{
        fontFamily: T.fontSans, fontSize: 14, fontWeight: 600, color: T.text,
        marginBottom: T.s1,
      }}>{cat.label}</div>
      <div style={{
        fontFamily: T.fontMono, fontSize: 22, color: T.text,
        fontWeight: 600, marginBottom: T.s2,
      }}>{count}</div>
      {coverage && (
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: hasGap ? T.warning : T.success,
          letterSpacing: "0.05em",
        }}>
          {coverage.has}/{coverage.total} have pairing entries
          {hasGap && ` (${coverage.total - coverage.has} gap${coverage.total - coverage.has === 1 ? "" : "s"})`}
        </div>
      )}
      {!coverage && (
        <div style={{
          fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
          letterSpacing: "0.05em",
        }}>
          no pairing table
        </div>
      )}
    </div>
  );
}
