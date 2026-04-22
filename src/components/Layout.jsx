import React from "react";
import { T } from "../theme.js";
import { CATEGORIES } from "../categories.js";

export default function Layout({
  selected, onSelect,
  sourcePath, sourceModified,
  tab, onTab, showTabs,
  children,
}) {
  // Group categories for sidebar. Overview is a standalone entry on top.
  const groups = {};
  for (const c of CATEGORIES) {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: T.bgSurface, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        <div style={{ padding: `${T.s5}px ${T.s4}px ${T.s4}px` }}>
          <div style={{
            fontFamily: T.fontMono, fontSize: 10,
            color: T.textMuted, letterSpacing: "0.2em", marginBottom: T.s1,
          }}>HIT INSPECTOR</div>
          <div style={{
            fontFamily: T.fontSans, fontSize: 14, color: T.text, fontWeight: 600,
          }}>Catalog browser</div>
        </div>

        <NavItem
          label="Overview"
          active={selected === "overview"}
          onClick={() => onSelect("overview")}
        />

        {Object.keys(groups).map(groupName => (
          <div key={groupName} style={{ marginTop: T.s4 }}>
            <div style={{
              padding: `${T.s2}px ${T.s4}px`,
              fontFamily: T.fontMono, fontSize: 10,
              color: T.textMuted, letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}>{groupName}</div>
            {groups[groupName].map(cat => (
              <NavItem
                key={cat.id}
                label={cat.label}
                active={selected === cat.id}
                onClick={() => onSelect(cat.id)}
              />
            ))}
          </div>
        ))}

        <div style={{
          marginTop: "auto", padding: T.s4,
          borderTop: `1px solid ${T.border}`,
          fontFamily: T.fontMono, fontSize: 10, color: T.textMuted,
          lineHeight: 1.6, wordBreak: "break-all",
        }}>
          <div style={{ color: T.textSec, marginBottom: 2 }}>SOURCE</div>
          <div>{sourcePath}</div>
          <div style={{ marginTop: T.s2, color: T.textDim }}>
            {new Date(sourceModified).toLocaleString()}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {showTabs && (
          <div style={{
            display: "flex", gap: T.s1,
            padding: `${T.s3}px ${T.s5}px 0`,
            borderBottom: `1px solid ${T.border}`,
            background: T.bgSurface,
          }}>
            {[
              { id: "items",  label: "Items" },
              { id: "family", label: "Family" },
              { id: "stats",  label: "Statistics" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                style={{
                  padding: `${T.s2}px ${T.s4}px`,
                  background: "transparent",
                  border: "none",
                  borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
                  color: tab === t.id ? T.text : T.textSec,
                  fontFamily: T.fontSans, fontSize: 13, fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >{t.label}</button>
            ))}
          </div>
        )}
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: `${T.s2}px ${T.s4}px`,
        background: active ? T.bgHover : "transparent",
        border: "none", borderLeft: active ? `2px solid ${T.accent}` : "2px solid transparent",
        color: active ? T.text : T.textSec,
        fontFamily: T.fontSans, fontSize: 13,
        cursor: "pointer",
      }}
    >{label}</button>
  );
}
