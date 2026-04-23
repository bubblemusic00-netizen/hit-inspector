import React, { useEffect, useState } from "react";
import { T } from "./theme.js";
import Layout from "./components/Layout.jsx";
import CategoryMap3D from "./components/CategoryMap3D.jsx";
import CategoryList from "./components/CategoryList.jsx";
import OverviewPage from "./components/OverviewPage.jsx";
import SearchPage from "./components/SearchPage.jsx";
import { CATEGORIES, buildDerivedData } from "./categories.js";

export default function App() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState("overview");
  const [tab, setTab] = useState("items");
  const [preselect, setPreselect] = useState(null);

  // View mode persists across category navigation — user toggles once,
  // stays in that view while browsing categories.
  const [viewMode, setViewMode] = useState("map"); // "map" | "list"

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let response = await fetch("/data.json");
        if (!response.ok) response = await fetch("/api/data");
        const json = await response.json();
        if (cancelled) return;
        if (json.error) setError(json);
        else setRaw(json);
      } catch (err) {
        if (!cancelled) setError({ error: String(err.message) });
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setTab("items"); }, [selected]);

  const handleSidebarSelect = (id) => {
    setPreselect(null);
    setSelected(id);
  };

  const handleSearchResultClick = (categoryId, preselectTarget) => {
    setSelected(categoryId);
    setPreselect(preselectTarget);
  };

  if (error) return <ErrorScreen error={error} />;
  if (!raw) return <LoadingScreen />;

  const derived = buildDerivedData(raw.data);

  const isCategoryView = selected !== "overview" && selected !== "search";
  // map3d sidebar item renders genres like the Genres page — same component,
  // same toggle behavior.
  const catIdForCategory = selected === "map3d" ? "genres" : selected;
  const resolvedCat = CATEGORIES.find(c => c.id === catIdForCategory);

  let mainContent;
  if (selected === "overview") {
    mainContent = <OverviewPage raw={raw} derived={derived} />;
  } else if (selected === "search") {
    mainContent = <SearchPage data={raw.data} onResultClick={handleSearchResultClick} />;
  } else if (!resolvedCat) {
    mainContent = <div style={{ padding: T.s6, fontFamily: T.fontMono, color: T.textMuted }}>Unknown category.</div>;
  } else if (viewMode === "list") {
    mainContent = <CategoryList categoryId={resolvedCat.id} data={raw.data} />;
  } else {
    mainContent = <CategoryMap3D categoryId={resolvedCat.id} data={raw.data} />;
  }

  return (
    <Layout
      selected={selected}
      onSelect={handleSidebarSelect}
      sourcePath={raw.sourcePath}
      sourceModified={raw.sourceModified}
      tab={tab}
      onTab={setTab}
      showTabs={false}
    >
      {/* Content area fills the viewport minus the header; toggle sits on
          top and the actual view takes the remaining space. */}
      <div style={{ height: "calc(100vh - 80px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {isCategoryView && <ViewToggle mode={viewMode} onChange={setViewMode} label={resolvedCat ? resolvedCat.label : ""} />}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {mainContent}
        </div>
      </div>
    </Layout>
  );
}

function ViewToggle({ mode, onChange, label }) {
  const btn = (id, txt) => (
    <button onClick={() => onChange(id)} style={{
      fontSize: 11, fontFamily: T.fontMono, letterSpacing: "0.08em",
      padding: "5px 14px",
      background: mode === id ? "rgba(94,106,210,0.22)" : "transparent",
      color: mode === id ? T.text : T.textMuted,
      border: "none", cursor: "pointer",
      textTransform: "uppercase",
    }}>{txt}</button>
  );
  return (
    <div style={{
      height: 38, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: `0 ${T.s5}px`,
      borderBottom: `1px solid ${T.borderHi}`,
      background: T.bgCard,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: "0.12em", color: T.textMuted, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${T.border}`, borderRadius: T.r_sm, overflow: "hidden" }}>
        {btn("map", "3D Map")}
        <div style={{ width: 1, height: 20, background: T.border }} />
        {btn("list", "List")}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: T.fontMono, color: T.textSec, fontSize: 13,
    }}>
      Reading Hit Engine source…
    </div>
  );
}

function ErrorScreen({ error }) {
  return (
    <div style={{
      padding: T.s6, fontFamily: T.fontMono, fontSize: 13, color: T.text,
      maxWidth: 720, margin: "0 auto",
    }}>
      <h1 style={{ color: T.error, fontSize: 18, marginTop: T.s6 }}>
        Cannot read Hit Engine source
      </h1>
      <p style={{ color: T.textSec, lineHeight: 1.6 }}>
        {error.error || "Unknown error"}
      </p>
      {error.tried && (
        <>
          <p style={{ color: T.textSec, marginTop: T.s5 }}>Tried these paths:</p>
          <ul style={{ color: T.textMuted, lineHeight: 1.8 }}>
            {error.tried.map(p => <li key={p}>{p}</li>)}
          </ul>
        </>
      )}
      {error.hint && (
        <div style={{
          marginTop: T.s5, padding: T.s4,
          background: T.bgCard, border: `1px solid ${T.borderHi}`, borderRadius: T.r_md,
        }}>
          <div style={{ color: T.warning, fontSize: 11, letterSpacing: "0.1em", marginBottom: T.s2 }}>HINT</div>
          <div>{error.hint}</div>
          <div style={{ marginTop: T.s3, color: T.textMuted, fontSize: 12 }}>
            Example: <code style={{ color: T.info }}>$env:HIT_ENGINE_PATH="C:\hit-engine\src\App.jsx"; npm run dev</code>
          </div>
        </div>
      )}
      {error.stack && (
        <details style={{ marginTop: T.s5 }}>
          <summary style={{ cursor: "pointer", color: T.textMuted }}>Stack trace</summary>
          <pre style={{ background: T.bgCard, padding: T.s4, borderRadius: T.r_sm, overflow: "auto", color: T.textMuted, fontSize: 11 }}>{error.stack}</pre>
        </details>
      )}
    </div>
  );
}
