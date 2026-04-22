import React, { useState } from "react";
import { T } from "../theme.js";

export default function ItemsView({ category, items }) {
  const [sort, setSort] = useState("xref-desc");
  const [filter, setFilter] = useState("");

  const filtered = items.filter(it =>
    !filter || it.label.toLowerCase().includes(filter.toLowerCase())
                  || (it.desc && it.desc.toLowerCase().includes(filter.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "alpha-asc")  return a.label.localeCompare(b.label);
    if (sort === "alpha-desc") return b.label.localeCompare(a.label);
    if (sort === "xref-desc")  return (b.xref || 0) - (a.xref || 0) || a.label.localeCompare(b.label);
    if (sort === "xref-asc")   return (a.xref || 0) - (b.xref || 0) || a.label.localeCompare(b.label);
    return 0;
  });

  // Decide which meta columns show based on category shape
  const isTree = category.shape.startsWith("tree-");
  const showXref = !isTree && !!category.complementTable;
  const showHasOwn = !isTree && !!category.complementTable;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: T.s3, marginBottom: T.s4, flexWrap: "wrap" }}>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter…"
          style={{
            flex: "1 1 200px", minWidth: 150,
            padding: `${T.s2}px ${T.s3}px`,
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_sm,
            color: T.text, fontFamily: T.fontSans, fontSize: 13,
            outline: "none",
          }}
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          style={{
            padding: `${T.s2}px ${T.s3}px`,
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.r_sm,
            color: T.text, fontFamily: T.fontSans, fontSize: 13, cursor: "pointer",
          }}
        >
          {showXref && <option value="xref-desc">Sort: Most referenced</option>}
          {showXref && <option value="xref-asc">Sort: Least referenced</option>}
          <option value="alpha-asc">Sort: A → Z</option>
          <option value="alpha-desc">Sort: Z → A</option>
        </select>
      </div>

      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: headerColumns(category, showXref, showHasOwn),
        padding: `${T.s2}px ${T.s3}px`,
        fontFamily: T.fontMono, fontSize: 10,
        color: T.textMuted, letterSpacing: "0.15em", textTransform: "uppercase",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span>Label</span>
        {isTree && category.shape === "tree-main" && (
          <>
            <span style={{ textAlign: "right" }}>Sub-genres</span>
            <span style={{ textAlign: "right" }}>Micro-styles</span>
          </>
        )}
        {isTree && category.shape === "tree-sub" && (
          <>
            <span>Parent</span>
            <span style={{ textAlign: "right" }}>Micro-styles</span>
          </>
        )}
        {isTree && category.shape === "tree-micro" && (
          <span>Path</span>
        )}
        {showXref && <span style={{ textAlign: "right" }}>Cross-refs</span>}
        {showHasOwn && <span style={{ textAlign: "right" }}>Has entry</span>}
      </div>

      {/* Rows */}
      {sorted.map(it => (
        <div key={it.id} style={{
          display: "grid",
          gridTemplateColumns: headerColumns(category, showXref, showHasOwn),
          padding: `${T.s2}px ${T.s3}px`,
          borderBottom: `1px solid ${T.border}`,
          fontFamily: T.fontSans, fontSize: 13,
          alignItems: "center",
        }}>
          <div>
            <div style={{ color: T.text, fontWeight: 500 }}>{it.label}</div>
            {it.desc && (
              <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>{it.desc}</div>
            )}
          </div>
          {isTree && category.shape === "tree-main" && (
            <>
              <span style={{ textAlign: "right", color: T.textSec, fontFamily: T.fontMono, fontSize: 12 }}>
                {it.meta?.subCount ?? 0}
              </span>
              <span style={{ textAlign: "right", color: T.textSec, fontFamily: T.fontMono, fontSize: 12 }}>
                {it.meta?.microCount ?? 0}
              </span>
            </>
          )}
          {isTree && category.shape === "tree-sub" && (
            <>
              <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 12 }}>
                {it.meta?.main ?? ""}
              </span>
              <span style={{ textAlign: "right", color: T.textSec, fontFamily: T.fontMono, fontSize: 12 }}>
                {it.meta?.microCount ?? 0}
              </span>
            </>
          )}
          {isTree && category.shape === "tree-micro" && (
            <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 11 }}>
              {it.meta?.main ?? ""} → {it.meta?.sub ?? ""}
            </span>
          )}
          {showXref && (
            <span style={{ textAlign: "right", color: T.textSec, fontFamily: T.fontMono, fontSize: 12 }}>
              {it.xref}
            </span>
          )}
          {showHasOwn && (
            <span style={{ textAlign: "right", color: it.hasOwnEntry ? T.success : T.warning, fontSize: 11, fontFamily: T.fontMono }}>
              {it.hasOwnEntry ? "✓" : "missing"}
            </span>
          )}
        </div>
      ))}

      {sorted.length === 0 && (
        <div style={{ padding: T.s5, color: T.textMuted, fontFamily: T.fontSans, fontSize: 13 }}>
          No items match "{filter}".
        </div>
      )}
    </div>
  );
}

function headerColumns(category, showXref, showHasOwn) {
  if (category.shape === "tree-main")  return "1fr 110px 130px";
  if (category.shape === "tree-sub")   return "1fr 1fr 130px";
  if (category.shape === "tree-micro") return "1fr 2fr";
  // flat categories: label + xref + hasOwn (if enabled)
  if (showXref && showHasOwn) return "1fr 120px 110px";
  if (showXref)               return "1fr 120px";
  return "1fr";
}
