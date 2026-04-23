import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instances, Instance, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { T } from "../theme.js";

/* ═══════════════════════════════════════════════════════════════════
 * GenreMap3D — v5  (graph-native rewrite)
 *
 * No more orbital structure. No more similarity percentages.
 * The map is a pure graph of explicit pairings that already exist
 * in the data. Positions emerge from those pairings via a standard
 * force-directed 3D layout.
 *
 * Node types:
 *   • genre      (18 — G node)
 *   • subgenre   (294 — S node)
 *   • attribute  (224 — A node, one per mood/energy/groove/etc.)
 *   • microstyle (1180 — satellite nodes attached after layout)
 *
 * Edge types (every edge is a direct, explicit pairing — no derived
 * similarities):
 *   • tree    — Genre ↔ its Subgenres
 *   • attr    — Subgenre ↔ Attributes it uses (from GENRE_INTUITION)
 *   • compl   — Attribute ↔ Attribute (from MOOD_COMPLEMENTS etc.)
 *
 * Visual contract:
 *   • Default view: just the constellation of nodes. Positions alone
 *     tell the story. Connected things are close, disconnected things
 *     are far. No edge spaghetti.
 *   • On focus: show only the focused node's direct edges.
 *   • Layer toggles to show/hide each node type.
 *
 * Props: data — raw.data from data.json
 * ═══════════════════════════════════════════════════════════════════ */

// ── Decorative palette ──────────────────────────────────────────────
const GENRE_COLORS = {
  "Hip-Hop":                "#A78BFA",
  "R&B / Soul":             "#FB7185",
  "Pop":                    "#F472B6",
  "Disco / Dance":          "#22D3EE",
  "Electronic":             "#60A5FA",
  "Latin":                  "#FB923C",
  "Rock":                   "#EF4444",
  "Metal":                  "#991B1B",
  "World / Global":         "#2DD4BF",
  "Blues":                  "#3B82F6",
  "Country / Americana":    "#F59E0B",
  "Folk / Acoustic":        "#84CC16",
  "Jazz":                   "#FBBF24",
  "Ambient / New Age":      "#C4B5FD",
  "Soundtrack / Score":     "#64748B",
  "Classical / Orchestral": "#E5E7EB",
  "Gospel / Spiritual":     "#FCD34D",
  "Experimental":           "#E879F9",
};
const DEFAULT_COLOR = "#94A3B8";

// Each attribute category — includes which field of GENRE_INTUITION
// contains its values, and which complement table lives in data.
const ATTR_CATS = [
  { id: "moods",     label: "Moods",        color: "#F9A8D4", dataKey: "MOODS",           giField: "moods",     complTable: "MOOD_COMPLEMENTS",     isObjects: false },
  { id: "energies",  label: "Energies",      color: "#FCD34D", dataKey: "ENERGIES",        giField: "energies",  complTable: "ENERGY_COMPLEMENTS",   isObjects: false },
  { id: "harmonics", label: "Harmonics",     color: "#FB923C", dataKey: "HARMONIC_STYLES", giField: "harmonics", complTable: "HARMONIC_COMPLEMENTS", isObjects: false },
  { id: "textures",  label: "Textures",      color: "#E879F9", dataKey: "SOUND_TEXTURES",  giField: "textures",  complTable: "TEXTURE_COMPLEMENTS",  isObjects: false },
  { id: "mix",       label: "Mix chars",     color: "#2DD4BF", dataKey: "MIX_CHARS",       giField: "mixes",     complTable: "MIX_COMPLEMENTS",      isObjects: false },
  { id: "grooves",   label: "Grooves",       color: "#60A5FA", dataKey: "GROOVES",         giField: "grooves",   complTable: "GROOVE_COMPLEMENTS",   isObjects: true, nameKey: "id", labelKey: "label" },
  { id: "vocalists", label: "Vocalists",     color: "#A78BFA", dataKey: "VOCALISTS",       giField: null,        complTable: "VOCALIST_COMPLEMENTS", isObjects: false },
  { id: "lyrical",   label: "Lyrical vibes", color: "#6EE7B7", dataKey: "LYRICAL_VIBES",   giField: null,        complTable: "LYRICAL_COMPLEMENTS",  isObjects: false },
];
const ATTR_CAT_BY_ID = Object.fromEntries(ATTR_CATS.map(c => [c.id, c]));

// Inside a complement-table entry, each field points to another category
const COMP_FIELD_TO_CAT = {
  mood: "moods", energy: "energies", groove: "grooves", vocalist: "vocalists",
  lyricalVibe: "lyrical", harmonic: "harmonics", texture: "textures", mix: "mix",
};

// ── Visual constants ───────────────────────────────────────────────
const GENRE_R    = 1.2;
const SUB_R      = 0.32;
const ATTR_R     = 0.22;
const MICRO_R    = 0.10;
const MICRO_ORBIT = 0.9;

// ── Helpers ──────────────────────────────────────────────────────────
function fibSphere(n) {
  if (n <= 0) return [];
  if (n === 1) return [[0, 0, 1]];
  const pts = [], phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = phi * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return pts;
}
function hash01(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 0xFFFFFFFF;
}
// Seeded PRNG for deterministic initial positions
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Graph construction from explicit data pairings ─────────────────

function buildGraph(data) {
  const tree = data.GENRE_TREE      || {};
  const gi   = data.GENRE_INTUITION || {};

  const nodes   = [];
  const idToIdx = {};

  const addNode = (n) => { idToIdx[n.id] = nodes.length; nodes.push(n); };

  // 1. Genre nodes
  Object.keys(tree).forEach(g => addNode({
    id: "g:" + g, kind: "genre", name: g,
    color: GENRE_COLORS[g] || DEFAULT_COLOR, mass: 5.0,
  }));

  // 2. Subgenre nodes
  Object.entries(tree).forEach(([g, subs]) => {
    Object.keys(subs).forEach(s => addNode({
      id: "s:" + g + "/" + s, kind: "subgenre", name: s, parent: g,
      color: GENRE_COLORS[g] || DEFAULT_COLOR, mass: 1.5,
    }));
  });

  // 3. Attribute nodes (one per value in each category)
  ATTR_CATS.forEach(cat => {
    const items = (data[cat.dataKey] || []).map(item =>
      cat.isObjects ? { name: item[cat.nameKey], label: item[cat.labelKey] } : { name: item, label: item }
    );
    items.forEach(item => addNode({
      id: "a:" + cat.id + ":" + item.name,
      kind: "attribute", name: item.name, label: item.label,
      categoryId: cat.id, color: cat.color, mass: 1.0,
    }));
  });

  // ── Edges (explicit pairings only) ─────────────────────────────
  const edges = [];

  // Tree: Genre → its Subgenres
  Object.entries(tree).forEach(([g, subs]) => {
    Object.keys(subs).forEach(s => {
      const fi = idToIdx["g:" + g], ti = idToIdx["s:" + g + "/" + s];
      if (fi !== undefined && ti !== undefined)
        edges.push({ from: fi, to: ti, kind: "tree", strength: 2.0 });
    });
  });

  // Subgenre → Attribute (GENRE_INTUITION)
  Object.entries(tree).forEach(([g, subs]) => {
    Object.keys(subs).forEach(s => {
      const entry = gi[s] || gi[s.toLowerCase()];
      if (!entry) return;
      const fi = idToIdx["s:" + g + "/" + s];
      ATTR_CATS.forEach(cat => {
        if (!cat.giField) return;
        (entry[cat.giField] || []).forEach(val => {
          const ti = idToIdx["a:" + cat.id + ":" + val];
          if (fi !== undefined && ti !== undefined)
            edges.push({ from: fi, to: ti, kind: "attr", strength: 1.0 });
        });
      });
    });
  });

  // Attribute ↔ Attribute (complement tables)
  ATTR_CATS.forEach(cat => {
    if (!cat.complTable) return;
    const table = data[cat.complTable] || {};
    Object.entries(table).forEach(([attrName, entry]) => {
      const fi = idToIdx["a:" + cat.id + ":" + attrName];
      if (fi === undefined || !entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([field, values]) => {
        const targetCatId = COMP_FIELD_TO_CAT[field];
        if (!targetCatId || !Array.isArray(values)) return;
        values.forEach(val => {
          const ti = idToIdx["a:" + targetCatId + ":" + val];
          if (ti !== undefined && ti !== fi)
            edges.push({ from: fi, to: ti, kind: "compl", strength: 0.4 });
        });
      });
    });
  });

  return { nodes, edges, idToIdx };
}

// ── Force-directed 3D layout ───────────────────────────────────────
// Each edge pulls its endpoints toward ideal length; all nodes repel.
// Runs 200 iterations with cooling. One-time, on mount.
//
// Numerical safeguards:
//   • Spring forces are divided by sqrt(degree) of both endpoints so
//     highly-connected nodes don't get over-pulled (standard in FDL).
//   • Per-step displacement is clamped to MAX_STEP to prevent any
//     single iteration from sending a node to infinity.
//   • Final positions are sanitized against NaN.
function runForceLayout(nodes, edges, iterations = 200) {
  const n = nodes.length;
  const rand = mulberry32(1337);

  // Precompute degree for normalization
  const degree = new Float32Array(n);
  for (const e of edges) { degree[e.from]++; degree[e.to]++; }

  // Initialize with moderate spread (random points in sphere of radius 10-18)
  for (let i = 0; i < n; i++) {
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(2 * rand() - 1);
    const r  = 10 + rand() * 8;
    nodes[i].pos = [
      r * Math.sin(ph) * Math.cos(th),
      r * Math.sin(ph) * Math.sin(th),
      r * Math.cos(ph),
    ];
  }

  const IDEAL       = 4.0;   // desired edge length
  const SPRING_K    = 0.08;  // edge spring coefficient
  const REPULSION_K = 15.0;  // coulomb repulsion coefficient
  const GRAVITY_K   = 0.015; // pull toward origin (keeps graph from drifting)
  const MAX_STEP    = 1.2;   // max per-iteration displacement clamp

  const fx = new Float32Array(n), fy = new Float32Array(n), fz = new Float32Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) { fx[i] = 0; fy[i] = 0; fz[i] = 0; }
    const temp = 1.0 * Math.pow(0.988, iter);

    // Spring attraction for edges, normalized by endpoint degree
    for (const e of edges) {
      const a = nodes[e.from], b = nodes[e.to];
      const dx = b.pos[0] - a.pos[0];
      const dy = b.pos[1] - a.pos[1];
      const dz = b.pos[2] - a.pos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      // Cap (dist - IDEAL) so a very far edge doesn't yank a node
      const delta = Math.max(-10, Math.min(dist - IDEAL, 15));
      const degNorm = 1 / Math.sqrt(degree[e.from] * degree[e.to] + 1);
      const f = delta * SPRING_K * e.strength * degNorm;
      const ux = dx / dist, uy = dy / dist, uz = dz / dist;
      fx[e.from] += ux * f; fy[e.from] += uy * f; fz[e.from] += uz * f;
      fx[e.to]   -= ux * f; fy[e.to]   -= uy * f; fz[e.to]   -= uz * f;
    }

    // Coulomb repulsion (all pairs)
    for (let i = 0; i < n; i++) {
      const ax = nodes[i].pos[0], ay = nodes[i].pos[1], az = nodes[i].pos[2];
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[j].pos[0] - ax;
        const dy = nodes[j].pos[1] - ay;
        const dz = nodes[j].pos[2] - az;
        const distSq = dx * dx + dy * dy + dz * dz + 0.5;
        const dist = Math.sqrt(distSq);
        const f = -REPULSION_K / distSq;
        const ux = dx / dist, uy = dy / dist, uz = dz / dist;
        fx[i] += ux * f; fy[i] += uy * f; fz[i] += uz * f;
        fx[j] -= ux * f; fy[j] -= uy * f; fz[j] -= uz * f;
      }
    }

    // Apply forces + center gravity, with per-step displacement clamp
    for (let i = 0; i < n; i++) {
      const p = nodes[i].pos;
      fx[i] -= p[0] * GRAVITY_K;
      fy[i] -= p[1] * GRAVITY_K;
      fz[i] -= p[2] * GRAVITY_K;
      const m = nodes[i].mass;
      let dx = (fx[i] / m) * temp;
      let dy = (fy[i] / m) * temp;
      let dz = (fz[i] / m) * temp;
      // Clamp per-step displacement
      const step = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (step > MAX_STEP) {
        const s = MAX_STEP / step;
        dx *= s; dy *= s; dz *= s;
      }
      p[0] += dx; p[1] += dy; p[2] += dz;
    }
  }

  // Sanitize any NaN/Infinity (shouldn't happen with clamping, but safety net)
  for (let i = 0; i < n; i++) {
    const p = nodes[i].pos;
    if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) {
      p[0] = (rand() - 0.5) * 30;
      p[1] = (rand() - 0.5) * 30;
      p[2] = (rand() - 0.5) * 30;
    }
  }
}

// ── Main layout builder ─────────────────────────────────────────────

function buildLayout(data) {
  const { nodes, edges, idToIdx } = buildGraph(data);
  runForceLayout(nodes, edges, 200);

  // Partition nodes by kind for easier rendering
  const genres     = [];
  const subgenres  = [];
  const attributes = [];
  nodes.forEach((n, idx) => {
    n.index = idx;
    if      (n.kind === "genre")     genres.push(n);
    else if (n.kind === "subgenre")  subgenres.push(n);
    else if (n.kind === "attribute") attributes.push(n);
  });

  // Microstyles: not in the force layout. Attach as Fibonacci satellites
  // around their parent subgenre (positioned deterministically).
  const tree = data.GENRE_TREE || {};
  const microstyles = [];
  subgenres.forEach(sub => {
    const names = tree[sub.parent]?.[sub.name] || [];
    if (!names.length) return;
    const seed = hash01(sub.parent + "/" + sub.name);
    const qRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.sin(seed * 2 * Math.PI), Math.cos(seed * 2 * Math.PI), Math.sin(seed * 3.7 * Math.PI)).normalize(),
      seed * 2 * Math.PI
    );
    fibSphere(names.length).forEach((p, i) => {
      const d = new THREE.Vector3(...p).applyQuaternion(qRot).multiplyScalar(MICRO_ORBIT);
      microstyles.push({
        name: names[i], parent: sub.name, grandparent: sub.parent,
        color: sub.color,
        position: [sub.pos[0] + d.x, sub.pos[1] + d.y, sub.pos[2] + d.z],
      });
    });
  });

  // Build adjacency — quick lookup for "give me all edges from node X"
  const adj = Array.from({ length: nodes.length }, () => []);
  edges.forEach(e => {
    adj[e.from].push({ other: e.to, kind: e.kind });
    adj[e.to].push({ other: e.from, kind: e.kind });
  });

  return { nodes, edges, idToIdx, adj, genres, subgenres, attributes, microstyles };
}

// ── Look up edges from a focused node ──────────────────────────────
function edgesForFocus(focused, layout) {
  if (!focused) return [];
  let nodeIdx;
  if      (focused.kind === "genre")     nodeIdx = layout.idToIdx["g:" + focused.name];
  else if (focused.kind === "subgenre")  nodeIdx = layout.idToIdx["s:" + focused.parent + "/" + focused.name];
  else if (focused.kind === "attribute") nodeIdx = layout.idToIdx["a:" + focused.categoryId + ":" + focused.name];
  else if (focused.kind === "microstyle") {
    // Microstyles aren't in the graph — use their parent subgenre's edges
    nodeIdx = layout.idToIdx["s:" + focused.grandparent + "/" + focused.parent];
  }
  if (nodeIdx === undefined) return [];

  const out = [];
  const fromNode = layout.nodes[nodeIdx];
  layout.adj[nodeIdx].forEach(({ other, kind }) => {
    const to = layout.nodes[other];
    out.push({
      from: fromNode.pos, to: to.pos,
      color: to.color, kind,
    });
  });
  return out;
}

// ── 3D Components ─────────────────────────────────────────────────────

function GenreNodes({ genres, focused, adjHighlight, onSelect, onHover }) {
  return (
    <>
      {genres.map(g => {
        const isF     = focused?.kind === "genre" && focused.name === g.name;
        const related = adjHighlight?.has(g.index);
        const dim     = focused && !isF && !related;
        return (
          <group key={g.name} position={g.pos}>
            <mesh
              onClick={e => { e.stopPropagation(); onSelect(g); }}
              onPointerOver={e => { e.stopPropagation(); onHover(g); }}
              onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            >
              <sphereGeometry args={[GENRE_R, 32, 32]} />
              <meshStandardMaterial
                color={g.color} emissive={g.color}
                emissiveIntensity={isF ? 2.6 : (dim ? 0.25 : 1.2)}
                toneMapped={false}
                opacity={dim ? 0.4 : 1} transparent={dim}
              />
            </mesh>
            <Html center distanceFactor={32} style={{ pointerEvents: "none" }}>
              <div style={{
                color: "#fff", fontSize: isF ? 13 : 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: isF ? 700 : 500, letterSpacing: "0.02em",
                background: isF ? "rgba(94,106,210,0.96)" : "rgba(10,10,15,0.78)",
                padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
                transform: "translate(-50%, 22px)", position: "absolute",
                opacity: dim ? 0.38 : 1, userSelect: "none",
              }}>{g.name}</div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function SubgenreNodes({ subgenres, focused, adjHighlight, onSelect, onHover }) {
  return (
    <Instances limit={Math.max(subgenres.length, 1)} range={subgenres.length}>
      <sphereGeometry args={[SUB_R, 14, 14]} />
      <meshStandardMaterial emissiveIntensity={0.9} toneMapped={false} />
      {subgenres.map(s => {
        const isF     = focused?.kind === "subgenre" && focused.name === s.name && focused.parent === s.parent;
        const related = adjHighlight?.has(s.index);
        const dim     = focused && !isF && !related;
        const scl     = isF ? 1.75 : (related ? 1.3 : (dim ? 0.35 : 1));
        return (
          <Instance key={s.parent + "/" + s.name} position={s.pos} color={s.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(s); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(s); }} />
        );
      })}
    </Instances>
  );
}

function AttributeNodes({ attributes, focused, adjHighlight, onSelect, onHover }) {
  return (
    <Instances limit={Math.max(attributes.length, 1)} range={attributes.length}>
      <sphereGeometry args={[ATTR_R, 12, 12]} />
      <meshStandardMaterial emissiveIntensity={0.9} toneMapped={false} />
      {attributes.map(a => {
        const isF     = focused?.kind === "attribute" && focused.name === a.name && focused.categoryId === a.categoryId;
        const related = adjHighlight?.has(a.index);
        const dim     = focused && !isF && !related;
        const scl     = isF ? 2.2 : (related ? 1.4 : (dim ? 0.35 : 1));
        return (
          <Instance key={a.categoryId + ":" + a.name} position={a.pos} color={a.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(a); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(a); }} />
        );
      })}
    </Instances>
  );
}

function MicrostyleNodes({ microstyles, focused, onSelect, onHover }) {
  return (
    <Instances limit={Math.max(microstyles.length, 1)} range={microstyles.length}>
      <sphereGeometry args={[MICRO_R, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.7} toneMapped={false} />
      {microstyles.map(m => {
        const isF = focused?.kind === "microstyle" && focused.name === m.name && focused.parent === m.parent && focused.grandparent === m.grandparent;
        const inSub = focused?.kind === "subgenre" && focused.name === m.parent && focused.parent === m.grandparent;
        const inGenre = focused?.kind === "genre" && focused.name === m.grandparent;
        const dim = focused && !(isF || inSub || inGenre);
        const scl = isF ? 2.4 : (inSub ? 1.35 : (dim ? 0.3 : 1));
        return (
          <Instance key={m.grandparent + "/" + m.parent + "/" + m.name}
            position={m.position} color={m.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(m); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(m); }} />
        );
      })}
    </Instances>
  );
}

// Edge lines — only rendered when something is focused (the focused
// node's direct pairings in the graph). One Line per edge, colored by
// the destination node's color.
function FocusEdges({ lines, visible }) {
  if (!visible || !lines.length) return null;
  return (
    <>
      {lines.map((l, i) => (
        <Line key={i} points={[l.from, l.to]} color={l.color} lineWidth={1.6}
              transparent opacity={l.kind === "tree" ? 0.85 : l.kind === "attr" ? 0.65 : 0.5} />
      ))}
    </>
  );
}

function HoverTooltip({ hovered }) {
  if (!hovered) return null;
  const pos = hovered.pos || hovered.position;
  if (!pos) return null;
  return (
    <Html position={pos} center distanceFactor={20} style={{ pointerEvents: "none" }}>
      <div style={{
        color: "#fff", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontWeight: 600, background: "rgba(94,106,210,0.96)",
        padding: "4px 9px", borderRadius: 4, whiteSpace: "nowrap",
        transform: "translate(-50%, -30px)", position: "absolute",
        userSelect: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}>
        {hovered.label || hovered.name}
      </div>
    </Html>
  );
}

// Camera animates to focused node, then yields control to OrbitControls
function CameraRig({ focusTarget, controlsRef }) {
  const { camera } = useThree();
  const animating = useRef(false);
  const destPos   = useRef(new THREE.Vector3(0, 8, 85));
  const destTgt   = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!focusTarget) { animating.current = false; return; }
    const p = focusTarget.pos || focusTarget.position;
    if (!p) return;
    const t = new THREE.Vector3(...p);
    destTgt.current.copy(t);
    const dist = focusTarget.kind === "genre" ? 8 : focusTarget.kind === "subgenre" ? 4 : focusTarget.kind === "microstyle" ? 2.5 : 4.5;
    const dir = t.length() > 0.01 ? t.clone().normalize() : new THREE.Vector3(0, 0, 1);
    destPos.current.copy(t.clone().add(dir.multiplyScalar(dist)));
    animating.current = true;
  }, [focusTarget]);

  useFrame((_, dt) => {
    if (!animating.current) return;
    const k = Math.min(1, dt * 2.8);
    camera.position.lerp(destPos.current, k);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(destTgt.current, k);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(destPos.current) < 0.07 && controlsRef.current?.target.distanceTo(destTgt.current) < 0.07)
      animating.current = false;
  });
  return null;
}

// ── UI Overlays ───────────────────────────────────────────────────────

function Toggle({ on, onChange, label, color, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "5px 10px",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1, userSelect: "none", borderRadius: 4,
    }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: on ? color : "transparent", border: `1.5px solid ${color}` }} />
      <span style={{ fontSize: 12, fontFamily: T.fontMono, color: T.text }}>{label}</span>
    </div>
  );
}

function LayerPanel({ layers, setLayers }) {
  const sectionStyle = { padding: "4px 10px 4px", fontSize: 9, letterSpacing: ".14em", color: T.textMuted, textTransform: "uppercase", borderBottom: `1px solid ${T.borderHi}`, marginBottom: 2, fontFamily: T.fontMono };
  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      background: "rgba(10,10,15,0.92)", border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md, padding: "6px 0", minWidth: 190, zIndex: 10,
    }}>
      <div style={sectionStyle}>show</div>
      <Toggle on label="Genres" color="#A78BFA" disabled />
      <Toggle on={layers.subgenres}   label="Subgenres"   color="#60A5FA" onChange={v => setLayers(l => ({ ...l, subgenres: v, microstyles: !v ? false : l.microstyles }))} />
      <Toggle on={layers.microstyles} label="Microstyles" color="#F472B6" disabled={!layers.subgenres} onChange={v => setLayers(l => ({ ...l, microstyles: v }))} />
      <Toggle on={layers.attributes}  label="Attributes"  color="#2DD4BF" onChange={v => setLayers(l => ({ ...l, attributes: v }))} />
    </div>
  );
}

function FocusHUD({ focused, layout, onClear }) {
  if (!focused) return (
    <div style={{
      position: "absolute", bottom: 16, left: 16, fontSize: 10,
      color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.65)", padding: "6px 10px",
      borderRadius: T.r_sm, userSelect: "none", zIndex: 10,
    }}>drag · scroll · click a node to see its pairings</div>
  );

  // Kind label + breadcrumb
  let kindLabel, crumbs;
  if      (focused.kind === "genre")      { kindLabel = "Genre";      crumbs = [focused.name]; }
  else if (focused.kind === "subgenre")   { kindLabel = "Subgenre";   crumbs = [focused.parent, focused.name]; }
  else if (focused.kind === "microstyle") { kindLabel = "Microstyle"; crumbs = [focused.grandparent, focused.parent, focused.name]; }
  else                                    { const c = ATTR_CAT_BY_ID[focused.categoryId]; kindLabel = c ? c.label : focused.categoryId; crumbs = [focused.label || focused.name]; }

  // Count neighbors by kind for the HUD summary
  let nodeIdx;
  if      (focused.kind === "genre")     nodeIdx = layout.idToIdx["g:" + focused.name];
  else if (focused.kind === "subgenre")  nodeIdx = layout.idToIdx["s:" + focused.parent + "/" + focused.name];
  else if (focused.kind === "attribute") nodeIdx = layout.idToIdx["a:" + focused.categoryId + ":" + focused.name];

  const counts = { genre: 0, subgenre: 0, attribute: 0 };
  if (nodeIdx !== undefined) {
    layout.adj[nodeIdx].forEach(({ other }) => {
      const k = layout.nodes[other].kind;
      if (counts[k] !== undefined) counts[k]++;
    });
  }

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16,
      background: "rgba(10,10,15,0.93)", border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md, padding: "10px 14px", maxWidth: 320,
      fontFamily: T.fontMono, zIndex: 10,
    }}>
      <div style={{ fontSize: 9, letterSpacing: ".12em", color: T.textMuted, textTransform: "uppercase", marginBottom: 5 }}>{kindLabel}</div>
      <div style={{ fontSize: 13, color: T.text, marginBottom: 8, wordBreak: "break-word" }}>
        {crumbs.map((c, i) => (
          <span key={i}>
            <span style={{ color: i === crumbs.length - 1 ? T.text : T.textSec }}>{c}</span>
            {i < crumbs.length - 1 && <span style={{ color: T.textMuted, margin: "0 6px" }}>›</span>}
          </span>
        ))}
      </div>
      {nodeIdx !== undefined && (counts.genre + counts.subgenre + counts.attribute > 0) && (
        <div style={{ borderTop: `1px solid ${T.borderHi}`, paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: ".1em", marginBottom: 5 }}>PAIRED WITH</div>
          {counts.genre > 0     && <div style={{ fontSize: 11, color: T.textSec, marginBottom: 2 }}>{counts.genre} genre{counts.genre > 1 ? "s" : ""}</div>}
          {counts.subgenre > 0  && <div style={{ fontSize: 11, color: T.textSec, marginBottom: 2 }}>{counts.subgenre} subgenre{counts.subgenre > 1 ? "s" : ""}</div>}
          {counts.attribute > 0 && <div style={{ fontSize: 11, color: T.textSec, marginBottom: 2 }}>{counts.attribute} attribute{counts.attribute > 1 ? "s" : ""}</div>}
        </div>
      )}
      <button onClick={onClear} style={{
        fontSize: 10, color: T.textMuted, background: "transparent",
        border: `1px solid ${T.borderHi}`, borderRadius: T.r_sm,
        padding: "3px 8px", cursor: "pointer", fontFamily: T.fontMono, letterSpacing: ".05em",
      }}>CLEAR ×</button>
    </div>
  );
}

function StatsBadge({ layout }) {
  return (
    <div style={{
      position: "absolute", top: 16, right: 16, fontSize: 10,
      color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.65)", padding: "6px 10px",
      borderRadius: T.r_sm, userSelect: "none", lineHeight: 1.8,
      letterSpacing: ".04em", zIndex: 10,
    }}>
      <div>{layout.genres.length} genres · {layout.subgenres.length} sub · {layout.attributes.length} attr</div>
      <div>{layout.edges.length} explicit pairings</div>
    </div>
  );
}

// ── Top-level export ──────────────────────────────────────────────────

export default function GenreMap3D({ data }) {
  const layout = useMemo(() => buildLayout(data || {}), [data]);

  const [layers,  setLayers]  = useState({ subgenres: true, microstyles: false, attributes: true });
  const [focused, setFocused] = useState(null);
  const [hovered, setHovered] = useState(null);
  const controlsRef = useRef();

  // Edges to render (only for focused node's direct neighbors)
  const focusLines = useMemo(() => edgesForFocus(focused, layout), [focused, layout]);

  // Set of neighbor node indices for the focused node (used to highlight/dim)
  const adjHighlight = useMemo(() => {
    if (!focused) return null;
    let idx;
    if      (focused.kind === "genre")      idx = layout.idToIdx["g:" + focused.name];
    else if (focused.kind === "subgenre")   idx = layout.idToIdx["s:" + focused.parent + "/" + focused.name];
    else if (focused.kind === "attribute")  idx = layout.idToIdx["a:" + focused.categoryId + ":" + focused.name];
    else if (focused.kind === "microstyle") idx = layout.idToIdx["s:" + focused.grandparent + "/" + focused.parent];
    if (idx === undefined) return null;
    const s = new Set([idx]);
    layout.adj[idx].forEach(({ other }) => s.add(other));
    return s;
  }, [focused, layout]);

  const selectGenre     = g => setFocused({ kind: "genre",      name: g.name, pos: g.pos });
  const selectSubgenre  = s => setFocused({ kind: "subgenre",   name: s.name, parent: s.parent, pos: s.pos });
  const selectAttribute = a => setFocused({ kind: "attribute",  name: a.name, label: a.label, categoryId: a.categoryId, pos: a.pos });
  const selectMicrostyle = m => setFocused({ kind: "microstyle", name: m.name, parent: m.parent, grandparent: m.grandparent, pos: m.position });

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 80px)", minHeight: 500, background: "#04040B", overflow: "hidden" }}>
      <Canvas camera={{ position: [0, 15, 130], fov: 50, near: 0.1, far: 800 }} dpr={[1, 2]} onPointerMissed={() => setFocused(null)}>
        <color attach="background" args={["#04040B"]} />
        <ambientLight intensity={0.32} />
        <pointLight position={[0, 0, 0]} intensity={0.6} distance={220} />

        <Suspense fallback={null}>
          <Stars radius={250} depth={80} count={2000} factor={4} saturation={0} fade speed={0.2} />

          <GenreNodes genres={layout.genres} focused={focused} adjHighlight={adjHighlight} onSelect={selectGenre} onHover={setHovered} />

          {layers.subgenres && (
            <SubgenreNodes subgenres={layout.subgenres} focused={focused} adjHighlight={adjHighlight} onSelect={selectSubgenre} onHover={setHovered} />
          )}

          {layers.subgenres && layers.microstyles && (
            <MicrostyleNodes microstyles={layout.microstyles} focused={focused} onSelect={selectMicrostyle} onHover={setHovered} />
          )}

          {layers.attributes && (
            <AttributeNodes attributes={layout.attributes} focused={focused} adjHighlight={adjHighlight} onSelect={selectAttribute} onHover={setHovered} />
          )}

          <FocusEdges lines={focusLines} visible={!!focused} />
          <HoverTooltip hovered={hovered} />
        </Suspense>

        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.07} minDistance={2} maxDistance={260} rotateSpeed={0.55} zoomSpeed={0.9} panSpeed={0.6} />
        <CameraRig focusTarget={focused} controlsRef={controlsRef} />
      </Canvas>

      <LayerPanel layers={layers} setLayers={setLayers} />
      <StatsBadge layout={layout} />
      <FocusHUD focused={focused} layout={layout} onClear={() => setFocused(null)} />
    </div>
  );
}
