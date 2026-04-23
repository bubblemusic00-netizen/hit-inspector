import React, { useState, useEffect } from "react";
import { T } from "../theme.js";
import { CATEGORIES } from "../categories.js";
import { useIsMobile } from "../responsive.js";

export default function Layout({
  selected, onSelect,
  sourcePath, sourceModified,
  tab, onTab, showTabs,
  children,
}) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Group categories for sidebar. Overview is a standalone entry on top.
  const groups = {};
  for (const c of CATEGORIES) {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  }

  // Resolve the current category label for the mobile top bar.
  const currentLabel = selected === "overview"
    ? "Overview"
    : selected === "search"
      ? "Search"
      : (CATEGORIES.find(c => c.id === selected)?.label || "");

  // Lock body scroll when the drawer is open on mobile, so the main
  // content doesn't scroll behind the open drawer.
  useEffect(() => {
    if (!isMobile) return;
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [drawerOpen, isMobile]);

  // Close drawer automatically when the viewport grows past the breakpoint,
  // so switching from phone→desktop doesn't leave a closed drawer state
  // that then desynchronizes when switching back.
  useEffect(() => {
    if (!isMobile && drawerOpen) setDrawerOpen(false);
  }, [isMobile]);

  const handleSelectCategory = (id) => {
    onSelect(id);
    if (isMobile) setDrawerOpen(false);
  };

  const sidebarContent = (
    <SidebarInner
      groups={groups}
      selected={selected}
      onSelect={handleSelectCategory}
      sourcePath={sourcePath}
      sourceModified={sourceModified}
    />
  );

  // ────────────────────────────── MOBILE ─────────────────────────────
  if (isMobile) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", minHeight: "100vh",
        background: T.bg, color: T.text,
      }}>
        {/* Top bar */}
        <header style={{
          display: "flex", alignItems: "center", gap: T.s3,
          padding: `${T.s3}px ${T.s4}px`,
          background: T.bgSurface,
          borderBottom: `1px solid ${T.border}`,
          position: "sticky", top: 0, zIndex: 20,
        }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              width: 36, height: 36, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: `1px solid ${T.border}`,
              borderRadius: T.r_sm, color: T.text, cursor: "pointer",
              flexShrink: 0,
            }}>
            <HamburgerIcon />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.fontMono, fontSize: 9,
              color: T.textMuted, letterSpacing: "0.22em",
              textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>HIT INSPECTOR</div>
            <div style={{
              fontFamily: T.fontSans, fontSize: 14, color: T.text, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{currentLabel}</div>
          </div>
        </header>

        {/* Tabs (below top bar on mobile) */}
        {showTabs && (
          <div style={{
            display: "flex",
            padding: `0 ${T.s3}px`,
            borderBottom: `1px solid ${T.border}`,
            background: T.bgSurface,
            position: "sticky", top: 64, zIndex: 19,
          }}>
            {[
              { id: "items",  label: "Items" },
              { id: "family", label: "Family" },
              { id: "stats",  label: "Stats" },
              { id: "map",    label: "3D Map" },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                style={{
                  flex: 1,
                  padding: `${T.s3}px ${T.s2}px`,
                  background: "transparent",
                  border: "none",
                  borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
                  color: tab === t.id ? T.text : T.textSec,
                  fontFamily: T.fontSans, fontSize: 13, fontWeight: 500,
                  cursor: "pointer",
                  marginBottom: -1,
                  minHeight: 44,
                }}
              >{t.label}</button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>

        {/* Drawer + scrim */}
        {drawerOpen && (
          <>
            <div
              onClick={() => setDrawerOpen(false)}
              style={{
                position: "fixed", inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 50,
              }}
            />
            <aside style={{
              position: "fixed", top: 0, left: 0, bottom: 0,
              width: "min(84vw, 320px)",
              background: T.bgSurface, borderRight: `1px solid ${T.border}`,
              display: "flex", flexDirection: "column",
              overflowY: "auto",
              zIndex: 51,
              animation: "hi-drawer-slide 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}>
              <style>{`
                @keyframes hi-drawer-slide {
                  from { transform: translateX(-100%); }
                  to   { transform: translateX(0); }
                }
              `}</style>
              {sidebarContent}
            </aside>
          </>
        )}
      </div>
    );
  }

  // ───────────────────────────── DESKTOP ─────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text }}>
      <aside style={{
        width: 240, flexShrink: 0,
        background: T.bgSurface, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {sidebarContent}
      </aside>

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
              { id: "map",    label: "3D Map" },
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

// ────────────────── Sidebar inner content ──────────────────
// Extracted so both desktop (permanent sidebar) and mobile (drawer)
// render the same nav without duplicating markup.
function SidebarInner({ groups, selected, onSelect, sourcePath, sourceModified }) {
  return (
    <>
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
        label="Search"
        active={selected === "search"}
        onClick={() => onSelect("search")}
      />
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
    </>
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
        minHeight: 44,
      }}
    >{label}</button>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect y="0" width="18" height="1.5" fill="currentColor" />
      <rect y="6.25" width="18" height="1.5" fill="currentColor" />
      <rect y="12.5" width="18" height="1.5" fill="currentColor" />
    </svg>
  );
}
