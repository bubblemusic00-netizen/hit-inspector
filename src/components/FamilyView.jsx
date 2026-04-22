import React, { useState } from "react";
import { T } from "../theme.js";

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

// ── Tree view for Genres / Instruments — collapsible 3-level hierarchy
function TreeFamily({ category, raw }) {
  const data = category.fetcher(raw);
  const [expandedMain, setExpandedMain] = useState({});
  const [expandedSub, setExpandedSub] = useState({});

  return (
    <div style={{ fontFamily: T.fontSans, fontSize: 13 }}>
      {Object.entries(data).map(([main, subs]) => {
        const isExpanded = !!expandedMain[main];
        const subKeys = Object.keys(subs || {});
        return (
          <div key={main} style={{ marginBottom: T.s2 }}>
            <button
              onClick={() => setExpandedMain(s => ({ ...s, [main]: !s[main] }))}
              style={{
                display: "flex", alignItems: "center", gap: T.s2,
                width: "100%", textAlign: "left",
                padding: `${T.s2}px ${T.s3}px`,
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: T.r_sm,
                color: T.text, cursor: "pointer",
                fontFamily: T.fontSans, fontSize: 13, fontWeight: 600,
              }}>
              <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 11, width: 10 }}>
                {isExpanded ? "▾" : "▸"}
              </span>
              <span style={{ flex: 1 }}>{main}</span>
              <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 11 }}>
                {subKeys.length} sub
              </span>
            </button>
            {isExpanded && subKeys.map(subKey => {
              const micros = Array.isArray(subs[subKey]) ? subs[subKey] : [];
              const subId = `${main}:${subKey}`;
              const subExpanded = !!expandedSub[subId];
              return (
                <div key={subKey} style={{ marginLeft: T.s5, marginTop: T.s1 }}>
                  <button
                    onClick={() => setExpandedSub(s => ({ ...s, [subId]: !s[subId] }))}
                    style={{
                      display: "flex", alignItems: "center", gap: T.s2,
                      width: "100%", textAlign: "left",
                      padding: `${T.s1}px ${T.s3}px`,
                      background: "transparent", border: "none",
                      color: T.textSec, cursor: "pointer",
                      fontFamily: T.fontSans, fontSize: 12,
                    }}>
                    <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 10, width: 10 }}>
                      {subExpanded ? "▾" : "▸"}
                    </span>
                    <span style={{ flex: 1 }}>{subKey}</span>
                    <span style={{ color: T.textMuted, fontFamily: T.fontMono, fontSize: 10 }}>
                      {micros.length}
                    </span>
                  </button>
                  {subExpanded && (
                    <div style={{
                      marginLeft: T.s6, padding: `${T.s2}px 0`,
                      display: "flex", flexWrap: "wrap", gap: T.s1,
                    }}>
                      {micros.map(m => (
                        <span key={m} style={{
                          padding: `${T.s1}px ${T.s2}px`,
                          background: T.bgCard,
                          border: `1px solid ${T.border}`,
                          borderRadius: T.r_sm,
                          color: T.textMuted, fontSize: 11, fontFamily: T.fontMono,
                        }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
