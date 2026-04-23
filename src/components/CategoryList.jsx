import React, { useMemo, useState } from "react";
import { T } from "../theme.js";
import { CATEGORIES } from "../categories.js";

/* ═══════════════════════════════════════════════════════════════════
 * CategoryList — regular data browsing view
 *
 * Clean list rendering for any category, with a top-bar "Copy all"
 * button (especially useful for main genres, which is the quickest way
 * to grab the 18-name vocabulary). Flat categories render as a single
 * list; tree categories group by parent so you can see structure and
 * copy either a slice or the whole thing.
 *
 * Copy formats:
 *   Plain    — one name per line
 *   With parent  — "Genre / Subgenre" form (tree-sub/micro only)
 *   CSV      — comma-separated
 *   JSON     — ["name","name",...]
 * ═══════════════════════════════════════════════════════════════════ */

function copyToClipboard(text) {
  // Prefer the async API; fall back to a textarea select for older browsers.
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
    resolve();
  });
}

function CopyButton({ label, text, small }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={onClick} style={{
      fontSize: small ? 10 : 11,
      padding: small ? "3px 8px" : "6px 12px",
      background: copied ? "rgba(110,231,183,0.15)" : "rgba(94,106,210,0.14)",
      border: `1px solid ${copied ? "#6EE7B7" : T.borderHi}`,
      color: copied ? "#6EE7B7" : T.text,
      fontFamily: T.fontMono,
      letterSpacing: "0.04em",
      borderRadius: T.r_sm,
      cursor: "pointer",
      transition: "background 0.12s, border-color 0.12s, color 0.12s",
      userSelect: "none",
    }}>
      {copied ? "COPIED ✓" : label}
    </button>
  );
}

// ── Tree traversal helpers ──────────────────────────────────────────
function collectTreeMain(data) {
  const tree = data.GENRE_TREE || {};
  return Object.keys(tree).map(g => {
    const subs = tree[g] || {};
    let microCount = 0;
    for (const v of Object.values(subs)) if (Array.isArray(v)) microCount += v.length;
    return { label: g, subCount: Object.keys(subs).length, microCount };
  });
}
function collectInstrumentsMain(data) {
  const tree = data.SPECIFIC_INSTRUMENTS || {};
  return Object.keys(tree).map(f => {
    const inst = tree[f] || {};
    let artCount = 0;
    for (const v of Object.values(inst)) if (Array.isArray(v)) artCount += v.length;
    return { label: f, subCount: Object.keys(inst).length, microCount: artCount };
  });
}
function collectTreeSubs(treeObj) {
  const out = [];
  for (const [parent, subs] of Object.entries(treeObj || {})) {
    for (const sub of Object.keys(subs || {})) {
      const micros = subs[sub];
      out.push({ label: sub, parent, microCount: Array.isArray(micros) ? micros.length : 0 });
    }
  }
  return out;
}
function collectTreeMicros(treeObj) {
  const out = [];
  for (const [parent, subs] of Object.entries(treeObj || {})) {
    for (const [sub, micros] of Object.entries(subs || {})) {
      if (!Array.isArray(micros)) continue;
      for (const m of micros) out.push({ label: m, parent: sub, grandparent: parent });
    }
  }
  return out;
}

// ── Row components ──────────────────────────────────────────────────
function Row({ children, meta, onCopy }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: `${T.s2}px ${T.s4}px`,
      borderBottom: `1px solid ${T.border}`,
      fontFamily: T.fontMono, fontSize: 12, color: T.text,
    }}>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</div>
      {meta && (
        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.04em", marginLeft: T.s3, flexShrink: 0 }}>{meta}</div>
      )}
      {onCopy && (
        <div style={{ marginLeft: T.s3, flexShrink: 0 }}>
          <CopyButton small label="COPY" text={onCopy} />
        </div>
      )}
    </div>
  );
}

function GroupHeader({ label, count }) {
  return (
    <div style={{
      padding: `${T.s3}px ${T.s4}px ${T.s2}px`,
      fontFamily: T.fontMono, fontSize: 10, letterSpacing: "0.14em",
      color: T.textMuted, textTransform: "uppercase",
      background: "rgba(94,106,210,0.06)",
      borderTop: `1px solid ${T.border}`,
      borderBottom: `1px solid ${T.border}`,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <span>{label}</span>
      <span style={{ color: T.textSec, letterSpacing: "0.04em" }}>{count}</span>
    </div>
  );
}

// ── Body renderers per category shape ───────────────────────────────
function renderTreeMain(items) {
  return items.map(i => (
    <Row key={i.label} meta={`${i.subCount} sub · ${i.microCount} micro`}>{i.label}</Row>
  ));
}

function renderTreeGroupedSubs(treeObj, microCountLabel) {
  const elems = [];
  for (const [parent, subs] of Object.entries(treeObj || {})) {
    const subKeys = Object.keys(subs || {});
    elems.push(<GroupHeader key={"g-" + parent} label={parent} count={`${subKeys.length} ${microCountLabel}`} />);
    for (const sub of subKeys) {
      const micros = subs[sub];
      const microCount = Array.isArray(micros) ? micros.length : 0;
      elems.push(<Row key={parent + "/" + sub} meta={microCount ? `${microCount} micro` : null}>{sub}</Row>);
    }
  }
  return elems;
}

function renderTreeGroupedMicros(treeObj) {
  const elems = [];
  for (const [parent, subs] of Object.entries(treeObj || {})) {
    for (const [sub, micros] of Object.entries(subs || {})) {
      if (!Array.isArray(micros) || micros.length === 0) continue;
      elems.push(<GroupHeader key={"gs-" + parent + "/" + sub} label={`${parent} · ${sub}`} count={`${micros.length} micro`} />);
      for (const m of micros) elems.push(<Row key={parent + "/" + sub + "/" + m}>{m}</Row>);
    }
  }
  return elems;
}

function renderFlatStrings(items) {
  return items.map(s => <Row key={s}>{s}</Row>);
}
function renderFlatObjects(items, cat) {
  return items.map(o => (
    <Row key={o[cat.itemKey]} meta={cat.itemDesc && o[cat.itemDesc] ? o[cat.itemDesc] : null}>
      {o[cat.itemLabel] || o[cat.itemKey]}
    </Row>
  ));
}

// ── Main component ──────────────────────────────────────────────────
export default function CategoryList({ categoryId, data }) {
  const cat = CATEGORIES.find(c => c.id === categoryId);

  const [format, setFormat] = useState("plain"); // plain | withParent | csv | json

  const { items, listForCopy, totalLabel, body } = useMemo(() => {
    if (!cat) return { items: [], listForCopy: [], totalLabel: "", body: null };

    if (cat.id === "genres") {
      const arr = collectTreeMain(data);
      return {
        items: arr,
        listForCopy: arr.map(x => x.label),
        totalLabel: `${arr.length} main genres`,
        body: renderTreeMain(arr),
      };
    }
    if (cat.id === "instruments") {
      const arr = collectInstrumentsMain(data);
      return {
        items: arr,
        listForCopy: arr.map(x => x.label),
        totalLabel: `${arr.length} instrument families`,
        body: renderTreeMain(arr),
      };
    }
    if (cat.id === "subgenres") {
      const arr = collectTreeSubs(data.GENRE_TREE);
      return {
        items: arr,
        listForCopy: arr.map(x => x.label),
        listWithParent: arr.map(x => `${x.parent} / ${x.label}`),
        totalLabel: `${arr.length} subgenres across ${Object.keys(data.GENRE_TREE || {}).length} genres`,
        body: renderTreeGroupedSubs(data.GENRE_TREE, "subgenres"),
      };
    }
    if (cat.id === "microstyles") {
      const arr = collectTreeMicros(data.GENRE_TREE);
      return {
        items: arr,
        listForCopy: arr.map(x => x.label),
        listWithParent: arr.map(x => `${x.grandparent} / ${x.parent} / ${x.label}`),
        totalLabel: `${arr.length} microstyles`,
        body: renderTreeGroupedMicros(data.GENRE_TREE),
      };
    }
    // Flat
    const fetched = cat.fetcher(data) || [];
    if (cat.shape === "flat-strings") {
      return {
        items: fetched,
        listForCopy: fetched,
        totalLabel: `${fetched.length} ${cat.label.toLowerCase()}`,
        body: renderFlatStrings(fetched),
      };
    }
    if (cat.shape === "flat-objects") {
      return {
        items: fetched,
        listForCopy: fetched.map(o => o[cat.itemLabel] || o[cat.itemKey]),
        totalLabel: `${fetched.length} ${cat.label.toLowerCase()}`,
        body: renderFlatObjects(fetched, cat),
      };
    }
    return { items: [], listForCopy: [], totalLabel: "", body: null };
  }, [cat, data, categoryId]);

  if (!cat) return <div style={{ padding: T.s6, fontFamily: T.fontMono, color: T.textMuted }}>Unknown category.</div>;

  // Build copy text based on format
  const withParentList = (() => {
    if (cat.id === "subgenres") return collectTreeSubs(data.GENRE_TREE).map(x => `${x.parent} / ${x.label}`);
    if (cat.id === "microstyles") return collectTreeMicros(data.GENRE_TREE).map(x => `${x.grandparent} / ${x.parent} / ${x.label}`);
    return listForCopy;
  })();

  const copyText = (() => {
    if (format === "plain") return listForCopy.join("\n");
    if (format === "withParent") return withParentList.join("\n");
    if (format === "csv") return listForCopy.join(", ");
    if (format === "json") return JSON.stringify(listForCopy);
    return listForCopy.join("\n");
  })();

  const hasParentFormat = cat.id === "subgenres" || cat.id === "microstyles";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg, overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{
        padding: `${T.s3}px ${T.s5}px`,
        borderBottom: `1px solid ${T.borderHi}`,
        background: T.bgCard,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: T.s4, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 15, color: T.text, fontWeight: 500, fontFamily: T.fontSerif, marginBottom: 2 }}>
            {cat.label}
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontMono, letterSpacing: "0.04em" }}>
            {totalLabel}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: T.s2 }}>
          <FormatSelector format={format} onChange={setFormat} hasParentFormat={hasParentFormat} />
          <CopyButton label={`COPY ALL (${listForCopy.length})`} text={copyText} />
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {body}
      </div>
    </div>
  );
}

function FormatSelector({ format, onChange, hasParentFormat }) {
  const opts = [
    { id: "plain", label: "list" },
    ...(hasParentFormat ? [{ id: "withParent", label: "with parent" }] : []),
    { id: "csv", label: "csv" },
    { id: "json", label: "json" },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r_sm,
      overflow: "hidden",
    }}>
      {opts.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{
          fontSize: 10, fontFamily: T.fontMono, letterSpacing: "0.06em",
          padding: "4px 9px",
          background: format === o.id ? "rgba(94,106,210,0.22)" : "transparent",
          color: format === o.id ? T.text : T.textMuted,
          border: "none", cursor: "pointer",
          borderRight: `1px solid ${T.border}`,
        }}>{o.label}</button>
      ))}
    </div>
  );
}
