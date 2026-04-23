import React, { useEffect, useState } from "react";
import { T } from "./theme.js";
import Layout from "./components/Layout.jsx";
import CategoryPage from "./components/CategoryPage.jsx";
import OverviewPage from "./components/OverviewPage.jsx";
import SearchPage from "./components/SearchPage.jsx";
import GenreMap3D from "./components/GenreMap3D.jsx";
import { CATEGORIES, buildDerivedData } from "./categories.js";

// Read the URL hash (#page-id) once at startup. Supports deep-linking
// to pages that aren't yet in the sidebar (e.g. "#map3d" while the
// 3D map page is still being rolled out).
function readHashPage() {
  if (typeof window === "undefined") return null;
  const h = window.location.hash.replace(/^#/, "").trim();
  return h || null;
}

export default function App() {
  const [raw, setRaw] = useState(null);       // { sourcePath, sourceModified, data: {...} }
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => readHashPage() || "overview");
  const [tab, setTab] = useState("items");    // "items" | "family" | "stats"
  // preselect: optional target inside a category (e.g. preselect the
  // Euphoric row in Moods Family). Search sets this; sidebar clears it.
  const [preselect, setPreselect] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Try the static snapshot first (production: served from public/),
    // fall back to the live dev plugin if no snapshot exists. This lets
    // the same bundle work both during `npm run dev` and when deployed
    // to Vercel after `npm run build`.
    async function load() {
      try {
        let response = await fetch("/data.json");
        if (!response.ok) {
          response = await fetch("/api/data");
        }
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

  // Sync selected page with URL hash changes (back/forward nav, manual
  // edits). Only reacts to hash changes — not full reloads.
  useEffect(() => {
    const onHash = () => {
      const p = readHashPage();
      if (p) setSelected(p);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Reset tab when switching categories so users don't land on a tab
  // that doesn't make sense for the new category (e.g. Family for
  // Languages, which has no family data).
  useEffect(() => { setTab("items"); }, [selected]);

  // Sidebar nav → clear preselect (search-originated preselect shouldn't
  // persist across a fresh sidebar click).
  const handleSidebarSelect = (id) => {
    setPreselect(null);
    setSelected(id);
  };

  // Search result click → set category + preselect + appropriate tab.
  // Search results from genres / instruments go to the Family tab
  // (where the hierarchy is browsable). Flat catalogs also go to Family
  // (so the picker preselects the matched item). Artists also route to
  // genres → Family so you see the genre home of that artist.
  const handleSearchResultClick = (categoryId, preselectTarget, preferredTab) => {
    setSelected(categoryId);
    setPreselect(preselectTarget);
    setTab(preferredTab || "family");
  };

  if (error) return <ErrorScreen error={error} />;
  if (!raw) return <LoadingScreen />;

  const derived = buildDerivedData(raw.data);

  let mainContent;
  if (selected === "overview") {
    mainContent = <OverviewPage raw={raw} derived={derived} />;
  } else if (selected === "search") {
    mainContent = <SearchPage data={raw.data} onResultClick={handleSearchResultClick} />;
  } else if (selected === "map3d") {
    mainContent = <GenreMap3D data={raw.data} />;
  } else {
    const cat = CATEGORIES.find(c => c.id === selected);
    if (!cat) mainContent = <div style={{ padding: T.s6 }}>Unknown category.</div>;
    else mainContent = (
      <CategoryPage
        category={cat}
        raw={raw.data}
        derived={derived}
        tab={tab}
        onTab={setTab}
        preselect={preselect}
        onPreselectConsumed={() => setPreselect(null)}
      />
    );
  }

  const isChromeless = selected === "overview" || selected === "search" || selected === "map3d";

  return (
    <Layout
      selected={selected}
      onSelect={handleSidebarSelect}
      sourcePath={raw.sourcePath}
      sourceModified={raw.sourceModified}
      tab={tab}
      onTab={setTab}
      showTabs={!isChromeless}
    >
      {mainContent}
    </Layout>
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
