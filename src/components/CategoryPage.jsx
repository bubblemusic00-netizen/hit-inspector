import React, { useMemo } from "react";
import { T } from "../theme.js";
import { flattenCategoryItems } from "../categories.js";
import ItemsView from "./ItemsView.jsx";
import FamilyView from "./FamilyView.jsx";
import StatsView from "./StatsView.jsx";

export default function CategoryPage({ category, raw, derived, tab, onTab }) {
  const items = useMemo(
    () => flattenCategoryItems(category, raw, derived),
    [category, raw, derived]
  );

  return (
    <div style={{ padding: T.s5 }}>
      <header style={{ marginBottom: T.s5 }}>
        <div style={{
          fontFamily: T.fontMono, fontSize: 10,
          color: T.textMuted, letterSpacing: "0.2em",
          textTransform: "uppercase", marginBottom: T.s1,
        }}>{category.group}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: T.s3 }}>
          <h1 style={{
            margin: 0, fontFamily: T.fontSans,
            fontSize: 24, fontWeight: 600, color: T.text,
          }}>{category.label}</h1>
          <span style={{
            fontFamily: T.fontMono, fontSize: 13, color: T.textMuted,
          }}>{items.length} {items.length === 1 ? "item" : "items"}</span>
        </div>
      </header>

      {tab === "items"  && <ItemsView category={category} items={items} />}
      {tab === "family" && <FamilyView category={category} items={items} raw={raw} derived={derived} />}
      {tab === "stats"  && <StatsView category={category} items={items} raw={raw} derived={derived} />}
    </div>
  );
}
