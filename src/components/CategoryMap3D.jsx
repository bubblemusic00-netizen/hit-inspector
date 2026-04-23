import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instances, Instance, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { T } from "../theme.js";
import { CATEGORIES } from "../categories.js";

/* ═══════════════════════════════════════════════════════════════════
 * CategoryMap3D — generic Big / Mid / Small galaxy
 *
 * Single component that renders every category with the same visual
 * model the Genres tab pioneered:
 *   • BIG   — top-level group (sun, ~1.3r)
 *   • MID   — items orbiting the sun (planet, ~0.34r)
 *   • SMALL — sub-items orbiting each mid (moon, ~0.11r)   [optional]
 *
 * Surrounded by an attribute cloud when the category has pairings to
 * other categories (moods, grooves, energies, etc.).
 *
 * Category → structure mapping:
 *   Genres / Subgenres / Microstyles — BIG=18 genres, MID=294 subs,
 *     SMALL=1180 micros. Attributes from GENRE_INTUITION.
 *   Instruments — BIG=17 families, MID=instruments, SMALL=articulations.
 *     No attr cloud (no pairings in data).
 *   Moods — BIG=5 MOOD_CATEGORIES groups, MID=40 moods. No SMALL.
 *     Attrs = the other 7 categories (shows complement pairings).
 *   Energies / Grooves / Vocalists / Lyrical / Harmonic / Textures / Mix —
 *     BIG=single hub sphere, MID=items, no SMALL. Attrs = the other 7.
 *   Languages — BIG=single hub, MID=22 languages, no SMALL. No attrs.
 *
 * All positions are data-driven:
 *   • BIG nodes run through a 3D force layout (with attribute cloud if
 *     present) so groups that share attributes settle near each other.
 *   • MID nodes sit on a sphere of radius MID_ORBIT around their BIG
 *     parent; their direction on that sphere blends Fibonacci (40%)
 *     with the centroid of their attribute pairings (60%).
 *   • SMALL nodes are Fibonacci satellites of their MID parent.
 *
 * Props:
 *   categoryId — which category to render (from categories.js)
 *   data       — the full raw.data
 * ═══════════════════════════════════════════════════════════════════ */

// ── Palette ────────────────────────────────────────────────────────
const GENRE_COLORS = {
  "Hip-Hop":                "#A78BFA",  // purple
  "R&B / Soul":             "#FB7185",  // coral
  "Pop":                    "#F472B6",  // pink
  "Disco / Dance":          "#22D3EE",  // cyan
  "Electronic":             "#60A5FA",  // blue
  "Latin":                  "#FB923C",  // orange
  "Rock":                   "#EF4444",  // red
  "Metal":                  "#818CF8",  // indigo (was near-black red — hard to see)
  "World / Global":         "#2DD4BF",  // teal
  "Blues":                  "#3B82F6",  // deep blue
  "Country / Americana":    "#F59E0B",  // amber
  "Folk / Acoustic":        "#84CC16",  // lime
  "Jazz":                   "#FBBF24",  // gold
  "Ambient / New Age":      "#C4B5FD",  // lavender
  "Soundtrack / Score":     "#A8A29E",  // warm grey (was cold slate)
  "Classical / Orchestral": "#F3E8D2",  // ivory
  "Gospel / Spiritual":     "#FCD34D",  // yellow
  "Experimental":           "#E879F9",  // magenta
};

const INSTRUMENT_COLORS = {
  "Keys":        "#FBBF24",
  "Synths":      "#A78BFA",
  "Strings":     "#F472B6",
  "Guitars":     "#EF4444",
  "Bass":        "#3B82F6",
  "Drums":       "#FB923C",
  "Percussion":  "#F59E0B",
  "Brass":       "#FCD34D",
  "Woodwinds":   "#84CC16",
  "Vocals":      "#FB7185",
  "World":       "#2DD4BF",
  "Electronic":  "#60A5FA",
  "Orchestral":  "#E5E7EB",
  "Ethnic":      "#22D3EE",
  "Effects":     "#C4B5FD",
  "Ambient":     "#6EE7B7",
  "Experimental":"#E879F9",
};

const FLAT_HUB_COLORS = {
  moods:     "#F9A8D4",
  energies:  "#FCD34D",
  grooves:   "#60A5FA",
  vocalists: "#A78BFA",
  lyrical:   "#6EE7B7",
  harmonics: "#FB923C",
  textures:  "#E879F9",
  mix:       "#2DD4BF",
  languages: "#F472B6",
};

const DEFAULT_COLOR = "#94A3B8";

// ── Attribute category config (used for attrs cloud) ──────────────
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
const COMP_FIELD_TO_CAT = {
  mood: "moods", energy: "energies", groove: "grooves", vocalist: "vocalists",
  lyricalVibe: "lyrical", harmonic: "harmonics", texture: "textures", mix: "mix",
};
// reverse: given attr category id → the complement field name
const CAT_TO_COMP_FIELD = Object.fromEntries(
  Object.entries(COMP_FIELD_TO_CAT).map(([f, c]) => [c, f])
);

// ── Visual / geometric constants ───────────────────────────────────
const BIG_R      = 1.3;
const MID_R      = 0.34;
const SMALL_R    = 0.11;
const ATTR_R     = 0.24;
const MID_ORBIT  = 5.0;
const SMALL_ORBIT= 1.0;

// ── Math helpers ─────────────────────────────────────────────────────
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
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Force-directed 3D layout (numerically stable) ──────────────────
function runForceLayout(nodes, edges, iterations = 200, fixedHubIdx = null) {
  const n = nodes.length;
  if (n === 0) return;
  const rand = mulberry32(1337);

  const degree = new Float32Array(n);
  for (const e of edges) { degree[e.from]++; degree[e.to]++; }

  for (let i = 0; i < n; i++) {
    if (i === fixedHubIdx) { nodes[i].pos = [0, 0, 0]; continue; }
    const th = rand() * Math.PI * 2;
    const ph = Math.acos(2 * rand() - 1);
    const r  = 12 + rand() * 10;
    nodes[i].pos = [
      r * Math.sin(ph) * Math.cos(th),
      r * Math.sin(ph) * Math.sin(th),
      r * Math.cos(ph),
    ];
  }

  const IDEAL       = 6.0;
  const SPRING_K    = 0.1;
  const REPULSION_K = 30.0;
  const GRAVITY_K   = 0.012;
  const MAX_STEP    = 1.5;

  const fx = new Float32Array(n), fy = new Float32Array(n), fz = new Float32Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) { fx[i] = 0; fy[i] = 0; fz[i] = 0; }
    const temp = 1.0 * Math.pow(0.985, iter);

    for (const e of edges) {
      const a = nodes[e.from], b = nodes[e.to];
      const dx = b.pos[0] - a.pos[0];
      const dy = b.pos[1] - a.pos[1];
      const dz = b.pos[2] - a.pos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const ideal = e.ideal !== undefined ? e.ideal : IDEAL;
      const delta = Math.max(-12, Math.min(dist - ideal, 18));
      const degNorm = 1 / Math.sqrt(degree[e.from] * degree[e.to] + 1);
      const f = delta * SPRING_K * e.strength * degNorm;
      const ux = dx / dist, uy = dy / dist, uz = dz / dist;
      fx[e.from] += ux * f; fy[e.from] += uy * f; fz[e.from] += uz * f;
      fx[e.to]   -= ux * f; fy[e.to]   -= uy * f; fz[e.to]   -= uz * f;
    }

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

    for (let i = 0; i < n; i++) {
      if (i === fixedHubIdx) continue;  // hub stays at origin
      const p = nodes[i].pos;
      fx[i] -= p[0] * GRAVITY_K;
      fy[i] -= p[1] * GRAVITY_K;
      fz[i] -= p[2] * GRAVITY_K;
      const m = nodes[i].mass;
      let dx = (fx[i] / m) * temp;
      let dy = (fy[i] / m) * temp;
      let dz = (fz[i] / m) * temp;
      const step = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (step > MAX_STEP) {
        const s = MAX_STEP / step;
        dx *= s; dy *= s; dz *= s;
      }
      p[0] += dx; p[1] += dy; p[2] += dz;
    }
  }

  for (let i = 0; i < n; i++) {
    const p = nodes[i].pos;
    if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) {
      p[0] = (rand() - 0.5) * 30; p[1] = (rand() - 0.5) * 30; p[2] = (rand() - 0.5) * 30;
    }
  }
}

// ── Shared: build attribute cloud (nodes + complement edges) ───────
function buildAttributeCloud(data, excludeCategoryIds = []) {
  const nodes = [];
  const byKey = {};
  const idToIdx = {};
  ATTR_CATS.forEach(cat => {
    if (excludeCategoryIds.includes(cat.id)) return;
    const items = (data[cat.dataKey] || []).map(item =>
      cat.isObjects ? { name: item[cat.nameKey], label: item[cat.labelKey] } : { name: item, label: item }
    );
    items.forEach(item => {
      const key = "a:" + cat.id + ":" + item.name;
      idToIdx[key] = nodes.length;
      const node = {
        id: key, kind: "attribute",
        name: item.name, label: item.label,
        categoryId: cat.id, color: cat.color, mass: 1.0,
      };
      byKey[cat.id + ":" + item.name] = node;
      nodes.push(node);
    });
  });
  return { nodes, byKey, idToIdx };
}

function buildAttrComplementEdges(attrNodes, attrIdToIdx, data, excludeCategoryIds = []) {
  const edges = [];
  ATTR_CATS.forEach(cat => {
    if (!cat.complTable || excludeCategoryIds.includes(cat.id)) return;
    const table = data[cat.complTable] || {};
    Object.entries(table).forEach(([attrName, entry]) => {
      const fi = attrIdToIdx["a:" + cat.id + ":" + attrName];
      if (fi === undefined || !entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([field, values]) => {
        const targetCatId = COMP_FIELD_TO_CAT[field];
        if (!targetCatId || excludeCategoryIds.includes(targetCatId) || !Array.isArray(values)) return;
        values.forEach(val => {
          const ti = attrIdToIdx["a:" + targetCatId + ":" + val];
          if (ti !== undefined && ti !== fi)
            edges.push({ from: fi, to: ti, kind: "compl", strength: 0.35 });
        });
      });
    });
  });
  return edges;
}

// ── Shared: place MIDs on orbit spheres around their BIG parent ────
// mids come in raw (no pos); they're mutated with pos + color + dir.
function placeMidsOrbital(midsRaw, bigByName, attrByKey, attrLookup, midOrbitOverride) {
  const orbit = midOrbitOverride ?? MID_ORBIT;
  const mids = [];
  const midsByKey = {};

  const byParent = {};
  for (const m of midsRaw) {
    if (!byParent[m.parent]) byParent[m.parent] = [];
    byParent[m.parent].push(m);
  }

  Object.entries(byParent).forEach(([parentName, subs]) => {
    const parent = bigByName[parentName];
    if (!parent) return;
    const seed = hash01(parentName);
    const qRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(seed * 2 * Math.PI), Math.sin(seed * 2 * Math.PI), Math.cos(seed * 4 * Math.PI)).normalize(),
      seed * 2 * Math.PI
    );
    const fibPts = fibSphere(subs.length);

    subs.forEach((s, si) => {
      let attrDir = null;
      if (attrLookup) {
        const attrs = attrLookup(s);
        if (attrs && attrs.length > 0) {
          let adx = 0, ady = 0, adz = 0;
          for (const a of attrs) {
            adx += a.pos[0] - parent.pos[0];
            ady += a.pos[1] - parent.pos[1];
            adz += a.pos[2] - parent.pos[2];
          }
          const alen = Math.sqrt(adx * adx + ady * ady + adz * adz) || 1;
          attrDir = [adx / alen, ady / alen, adz / alen];
        }
      }

      const fib = new THREE.Vector3(...fibPts[si]).applyQuaternion(qRot);
      const fibDir = [fib.x, fib.y, fib.z];

      let dir;
      if (attrDir) {
        dir = [
          fibDir[0] * 0.4 + attrDir[0] * 0.6,
          fibDir[1] * 0.4 + attrDir[1] * 0.6,
          fibDir[2] * 0.4 + attrDir[2] * 0.6,
        ];
        const dlen = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2) || 1;
        dir[0] /= dlen; dir[1] /= dlen; dir[2] /= dlen;
      } else {
        dir = fibDir;
      }

      s.pos = [
        parent.pos[0] + dir[0] * orbit,
        parent.pos[1] + dir[1] * orbit,
        parent.pos[2] + dir[2] * orbit,
      ];
      s.dir = dir;
      s.color = parent.color;
      mids.push(s);
      midsByKey[s.name + "/" + s.parent] = s;
    });

    // Sibling repulsion on the orbit sphere
    if (subs.length >= 2) {
      for (let pass = 0; pass < 25; pass++) {
        subs.forEach(s => { s._push = [0, 0, 0]; });
        for (let i = 0; i < subs.length; i++) {
          for (let j = i + 1; j < subs.length; j++) {
            const dx = subs[j].dir[0] - subs[i].dir[0];
            const dy = subs[j].dir[1] - subs[i].dir[1];
            const dz = subs[j].dir[2] - subs[i].dir[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.02;
            const f = 0.03 / (dist * dist);
            subs[i]._push[0] -= (dx / dist) * f;
            subs[i]._push[1] -= (dy / dist) * f;
            subs[i]._push[2] -= (dz / dist) * f;
            subs[j]._push[0] += (dx / dist) * f;
            subs[j]._push[1] += (dy / dist) * f;
            subs[j]._push[2] += (dz / dist) * f;
          }
        }
        subs.forEach(s => {
          s.dir[0] += s._push[0]; s.dir[1] += s._push[1]; s.dir[2] += s._push[2];
          const dlen = Math.sqrt(s.dir[0] ** 2 + s.dir[1] ** 2 + s.dir[2] ** 2) || 1;
          s.dir[0] /= dlen; s.dir[1] /= dlen; s.dir[2] /= dlen;
          s.pos[0] = parent.pos[0] + s.dir[0] * orbit;
          s.pos[1] = parent.pos[1] + s.dir[1] * orbit;
          s.pos[2] = parent.pos[2] + s.dir[2] * orbit;
          delete s._push;
        });
      }
    }
  });

  return { mids, midsByKey };
}

// ── Shared: place SMALLs (Fibonacci around their MID parent) ───────
function placeSmallsOrbital(mids, smallsRaw) {
  const smalls = [];
  const byParent = {};
  for (const s of smallsRaw) {
    const k = s.parent + "/" + s.grandparent;
    if (!byParent[k]) byParent[k] = [];
    byParent[k].push(s);
  }
  mids.forEach(mid => {
    const k = mid.name + "/" + mid.parent;
    const items = byParent[k] || [];
    if (!items.length) return;
    const seed = hash01(mid.parent + "/" + mid.name);
    const qRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.sin(seed * 2 * Math.PI), Math.cos(seed * 2 * Math.PI), Math.sin(seed * 3.7 * Math.PI)).normalize(),
      seed * 2 * Math.PI
    );
    fibSphere(items.length).forEach((p, i) => {
      const d = new THREE.Vector3(...p).applyQuaternion(qRot).multiplyScalar(SMALL_ORBIT);
      const sm = items[i];
      sm.pos = [mid.pos[0] + d.x, mid.pos[1] + d.y, mid.pos[2] + d.z];
      sm.color = mid.color;
      smalls.push(sm);
    });
  });
  return smalls;
}

// ── Layout: Genres (and Subgenres / Microstyles) ───────────────────
function buildGenreLayout(data) {
  const tree = data.GENRE_TREE || {};
  const gi = data.GENRE_INTUITION || {};
  const gNames = Object.keys(tree);

  // ── 1. Build graph with genres + SUBS + attributes ──────────────
  // Subs now participate in the force layout so their final position
  // comes from their pairings (attrs they use + parent gravity), not
  // from a rigid orbital snap.
  const bigsNodes = gNames.map(g => ({
    id: "b:" + g, kind: "big", name: g,
    color: GENRE_COLORS[g] || DEFAULT_COLOR, mass: 5.0,
  }));

  // Subs — keyed by "Parent/Sub" so name collisions across genres don't clash
  const midsNodesRaw = [];
  gNames.forEach(gName => {
    Object.keys(tree[gName]).forEach(sName => {
      midsNodesRaw.push({
        id: "m:" + gName + "/" + sName, kind: "mid",
        name: sName, parent: gName,
        color: GENRE_COLORS[gName] || DEFAULT_COLOR,
        mass: 1.8,
      });
    });
  });

  const { nodes: attrNodes, byKey: attrByKey, idToIdx: attrLocalIdx } = buildAttributeCloud(data, []);

  const forceNodes = [...bigsNodes, ...midsNodesRaw, ...attrNodes];
  const idToIdx = {};
  forceNodes.forEach((n, i) => { idToIdx[n.id] = i; });

  // ── 2. Edges (all with per-edge ideal distance) ─────────────────
  const edges = [];

  // Genre → Subgenre: strong spring, short ideal — keeps hierarchy visible.
  // Not so strong that subs get locked on a shell.
  gNames.forEach(gName => {
    const gi_ = idToIdx["b:" + gName];
    Object.keys(tree[gName]).forEach(sName => {
      const si = idToIdx["m:" + gName + "/" + sName];
      edges.push({ from: gi_, to: si, kind: "tree", strength: 2.6, ideal: 5.0 });
    });
  });

  // Sub → Attr: top-2 per attr category per sub (capped to avoid edge explosion).
  // This is where the "strategic by pairings" positioning comes from —
  // subs are pulled toward the attributes they use.
  midsNodesRaw.forEach(sub => {
    const entry = gi[sub.name] || gi[sub.name.toLowerCase()];
    if (!entry) return;
    const si = idToIdx[sub.id];
    ATTR_CATS.forEach(cat => {
      if (!cat.giField) return;
      const vals = entry[cat.giField] || [];
      // Count frequency (duplicates in the arr boost weight), then top-2 unique
      const counts = {};
      for (const v of vals) counts[v] = (counts[v] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2);
      for (const [val, c] of top) {
        const node = attrByKey[cat.id + ":" + val];
        if (!node) continue;
        const ai = idToIdx[node.id];
        edges.push({ from: si, to: ai, kind: "s-a", strength: 0.7 + Math.min(c, 3) * 0.1, ideal: 8.0 });
      }
    });
  });

  // Attr ↔ Attr complement edges: weak spring, clusters related attrs.
  buildAttrComplementEdges(attrNodes, attrLocalIdx, data, []).forEach(e => {
    const fromAttrIdx = idToIdx[attrNodes[e.from].id];
    const toAttrIdx = idToIdx[attrNodes[e.to].id];
    if (fromAttrIdx !== undefined && toAttrIdx !== undefined)
      edges.push({ from: fromAttrIdx, to: toAttrIdx, kind: "compl", strength: 0.3, ideal: 6.0 });
  });

  runForceLayout(forceNodes, edges, 180);

  const bigs = forceNodes.filter(n => n.kind === "big");
  const mids = forceNodes.filter(n => n.kind === "mid");
  const attributes = forceNodes.filter(n => n.kind === "attribute");
  const bigByName = {}; bigs.forEach(b => { bigByName[b.name] = b; });
  const midsByKey = {}; mids.forEach(m => { midsByKey[m.name + "/" + m.parent] = m; });

  // ── 3. Microstyles — still Fibonacci around their subgenre ──────
  const smallsRaw = [];
  gNames.forEach(gName => {
    Object.entries(tree[gName]).forEach(([sName, micros]) => {
      if (!Array.isArray(micros)) return;
      micros.forEach(mName => {
        smallsRaw.push({ kind: "small", name: mName, parent: sName, grandparent: gName });
      });
    });
  });
  const smalls = placeSmallsOrbital(mids, smallsRaw);

  // ── 4. Aggregated genre→attr table — used for `bigAttrEdges` only,
  //     not for layout edges (those come from sub→attr directly).
  const bigAttrCount = {};
  gNames.forEach(g => { bigAttrCount[g] = {}; });
  gNames.forEach(gName => {
    Object.keys(tree[gName]).forEach(sName => {
      const entry = gi[sName] || gi[sName.toLowerCase()];
      if (!entry) return;
      ATTR_CATS.forEach(cat => {
        if (!cat.giField) return;
        (entry[cat.giField] || []).forEach(val => {
          const k = cat.id + ":" + val;
          bigAttrCount[gName][k] = (bigAttrCount[gName][k] || 0) + 1;
        });
      });
    });
  });

  const subAttrs = s => {
    const entry = gi[s.name] || gi[s.name.toLowerCase()];
    if (!entry) return [];
    const res = [];
    ATTR_CATS.forEach(cat => {
      if (!cat.giField) return;
      (entry[cat.giField] || []).forEach(val => {
        const node = attrByKey[cat.id + ":" + val];
        if (node) res.push(node);
      });
    });
    return res;
  };

  return {
    kind: "genres",
    bigs, mids, smalls, attributes,
    bigByName, midsByKey, data,
    bigLabel: "Genre", midLabel: "Subgenre", smallLabel: "Microstyle",
    hasSmalls: true, hasAttrs: true,
    // All explicit tree edges — used when user turns "show lines" to ON.
    allTreeEdges: (() => {
      const out = [];
      for (const m of mids) {
        const parent = bigByName[m.parent];
        if (parent) out.push({ from: parent.pos, to: m.pos, color: m.color, kind: "tree" });
      }
      return out;
    })(),
    midToAttrs: mid => subAttrs(mid).map(n => ({ node: n, cat: ATTR_CAT_BY_ID[n.categoryId] })),
    attrToMids: (attr, cap = 15) => {
      const cat = ATTR_CAT_BY_ID[attr.categoryId];
      if (!cat?.giField) return [];
      const res = [];
      for (const s of mids) {
        if (res.length >= cap) break;
        const entry = gi[s.name] || gi[s.name.toLowerCase()];
        if (entry && (entry[cat.giField] || []).includes(attr.name)) res.push(s);
      }
      return res;
    },
    bigAttrEdges: (big) => {
      const out = [];
      const counts = bigAttrCount[big.name] || {};
      ATTR_CATS.forEach(cat => {
        if (!cat.giField) return;
        const same = [];
        Object.entries(counts).forEach(([k, c]) => { if (k.startsWith(cat.id + ":")) same.push({ k, c }); });
        same.sort((a, b) => b.c - a.c);
        same.slice(0, 6).forEach(({ k }) => {
          const name = k.substring(cat.id.length + 1);
          const node = attrByKey[cat.id + ":" + name];
          if (node) out.push({ node, cat });
        });
      });
      return out;
    },
  };
}

// ── Layout: Instruments ────────────────────────────────────────────
function buildInstrumentsLayout(data) {
  const tree = data.SPECIFIC_INSTRUMENTS || {};
  const fNames = Object.keys(tree);

  const bigsNodes = fNames.map(f => ({
    id: "b:" + f, kind: "big", name: f,
    color: INSTRUMENT_COLORS[f] || DEFAULT_COLOR, mass: 4.0,
  }));

  // No attribute data for instruments → just repel to spread evenly
  runForceLayout(bigsNodes, [], 120);

  const bigs = bigsNodes;
  const bigByName = {}; bigs.forEach(b => { bigByName[b.name] = b; });

  const midsRaw = [];
  fNames.forEach(fName => {
    Object.keys(tree[fName]).forEach(iName => {
      midsRaw.push({ kind: "mid", name: iName, parent: fName });
    });
  });
  const { mids, midsByKey } = placeMidsOrbital(midsRaw, bigByName, null, null);

  const smallsRaw = [];
  fNames.forEach(fName => {
    Object.entries(tree[fName]).forEach(([iName, arts]) => {
      if (!Array.isArray(arts)) return;
      arts.forEach(aName => {
        smallsRaw.push({ kind: "small", name: aName, parent: iName, grandparent: fName });
      });
    });
  });
  const smalls = placeSmallsOrbital(mids, smallsRaw);

  return {
    kind: "instruments",
    bigs, mids, smalls, attributes: [],
    bigByName, midsByKey, data,
    bigLabel: "Family", midLabel: "Instrument", smallLabel: "Articulation",
    hasSmalls: true, hasAttrs: false,
    midToAttrs: () => [], attrToMids: () => [], bigAttrEdges: () => [],
  };
}

// ── Layout: Moods (BIG = MOOD_CATEGORIES, MID = moods) ─────────────
function buildMoodsLayout(data) {
  const moodCats = data.MOOD_CATEGORIES || [];
  const moodTable = data.MOOD_COMPLEMENTS || {};

  // Reverse lookup: mood → mood_category
  const moodToCat = {};
  moodCats.forEach(mc => {
    (mc.items || []).forEach(m => { moodToCat[m] = mc.name; });
  });

  const bigsNodes = moodCats.map(mc => ({
    id: "b:" + mc.name, kind: "big", name: mc.name,
    color: mc.tint || "#A78BFA", mass: 4.0,
  }));

  const { nodes: attrNodes, byKey: attrByKey, idToIdx: attrLocalIdx } = buildAttributeCloud(data, ["moods"]);

  const forceNodes = [...bigsNodes, ...attrNodes];
  const idToIdx = {};
  forceNodes.forEach((n, i) => { idToIdx[n.id] = i; });

  const edges = [];
  const bigAttrCount = {};
  bigsNodes.forEach(b => { bigAttrCount[b.name] = {}; });

  moodCats.forEach(mc => {
    (mc.items || []).forEach(moodName => {
      const entry = moodTable[moodName];
      if (!entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([field, values]) => {
        const tgt = COMP_FIELD_TO_CAT[field];
        if (!tgt || tgt === "moods" || !Array.isArray(values)) return;
        values.forEach(v => {
          const k = tgt + ":" + v;
          bigAttrCount[mc.name][k] = (bigAttrCount[mc.name][k] || 0) + 1;
        });
      });
    });
  });

  moodCats.forEach(mc => {
    const fi = idToIdx["b:" + mc.name];
    ATTR_CATS.forEach(cat => {
      if (cat.id === "moods") return;
      const same = [];
      Object.entries(bigAttrCount[mc.name]).forEach(([k, c]) => {
        if (k.startsWith(cat.id + ":")) same.push({ k, c });
      });
      same.sort((a, b) => b.c - a.c);
      same.slice(0, 10).forEach(({ k, c }) => {
        const ti = idToIdx["a:" + k];
        if (ti !== undefined)
          edges.push({ from: fi, to: ti, kind: "b-a", strength: 0.5 + Math.min(c, 8) * 0.12 });
      });
    });
  });

  buildAttrComplementEdges(attrNodes, attrLocalIdx, data, ["moods"]).forEach(e => {
    edges.push({ from: e.from + bigsNodes.length, to: e.to + bigsNodes.length, kind: "compl", strength: e.strength });
  });

  runForceLayout(forceNodes, edges, 200);

  const bigs = forceNodes.filter(n => n.kind === "big");
  const attributes = forceNodes.filter(n => n.kind === "attribute");
  const bigByName = {}; bigs.forEach(b => { bigByName[b.name] = b; });

  const midsRaw = [];
  moodCats.forEach(mc => {
    (mc.items || []).forEach(moodName => {
      midsRaw.push({ kind: "mid", name: moodName, parent: mc.name });
    });
  });

  const attrLookup = s => {
    const entry = moodTable[s.name];
    if (!entry || typeof entry !== "object") return [];
    const res = [];
    Object.entries(entry).forEach(([field, values]) => {
      const tgt = COMP_FIELD_TO_CAT[field];
      if (!tgt || tgt === "moods" || !Array.isArray(values)) return;
      values.forEach(v => {
        const node = attrByKey[tgt + ":" + v];
        if (node) res.push(node);
      });
    });
    return res;
  };

  const { mids, midsByKey } = placeMidsOrbital(midsRaw, bigByName, attrByKey, attrLookup);

  return {
    kind: "moods",
    bigs, mids, smalls: [], attributes,
    bigByName, midsByKey, data,
    bigLabel: "Mood category", midLabel: "Mood", smallLabel: null,
    hasSmalls: false, hasAttrs: true,
    midToAttrs: mid => attrLookup(mid).map(n => ({ node: n, cat: ATTR_CAT_BY_ID[n.categoryId] })),
    attrToMids: (attr, cap = 15) => {
      const field = CAT_TO_COMP_FIELD[attr.categoryId];
      if (!field) return [];
      const res = [];
      for (const s of mids) {
        if (res.length >= cap) break;
        const entry = moodTable[s.name];
        if (entry && Array.isArray(entry[field]) && entry[field].includes(attr.name)) res.push(s);
      }
      return res;
    },
    bigAttrEdges: (big) => {
      const out = [];
      const counts = bigAttrCount[big.name] || {};
      ATTR_CATS.forEach(cat => {
        if (cat.id === "moods") return;
        const same = [];
        Object.entries(counts).forEach(([k, c]) => { if (k.startsWith(cat.id + ":")) same.push({ k, c }); });
        same.sort((a, b) => b.c - a.c);
        same.slice(0, 6).forEach(({ k }) => {
          const name = k.substring(cat.id.length + 1);
          const node = attrByKey[cat.id + ":" + name];
          if (node) out.push({ node, cat });
        });
      });
      return out;
    },
  };
}

// ── Layout: Flat categories (single hub + items) ───────────────────
function buildFlatLayout(data, categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return { kind: "empty", bigs: [], mids: [], smalls: [], attributes: [] };

  const fetched = cat.fetcher(data) || [];
  const items = (Array.isArray(fetched) ? fetched : []).map(it =>
    cat.shape === "flat-objects"
      ? { name: it[cat.itemKey], label: it[cat.itemLabel] || it[cat.itemKey] }
      : { name: it, label: it }
  );

  const hasComplements = !!cat.complementTable;
  const compTable = cat.complementTable ? (data[cat.complementTable] || {}) : {};

  // Hub = single BIG node at origin (fixed)
  const hub = {
    id: "b:hub", kind: "big", name: cat.label,
    color: FLAT_HUB_COLORS[categoryId] || "#A78BFA",
    mass: 1000, pos: [0, 0, 0],
  };

  let attrNodes = [], attrByKey = {}, attributes = [];
  if (hasComplements) {
    const built = buildAttributeCloud(data, [categoryId]);
    attrNodes = built.nodes; attrByKey = built.byKey;
    const attrLocalIdx = built.idToIdx;

    const forceNodes = [hub, ...attrNodes];
    const idToIdx = {};
    forceNodes.forEach((n, i) => { idToIdx[n.id] = i; });

    const edges = [];

    // Hub → attrs: aggregate complement counts from all items
    const hubAttrCount = {};
    items.forEach(it => {
      const entry = compTable[it.name];
      if (!entry || typeof entry !== "object") return;
      Object.entries(entry).forEach(([field, values]) => {
        const tgt = COMP_FIELD_TO_CAT[field];
        if (!tgt || tgt === categoryId || !Array.isArray(values)) return;
        values.forEach(v => {
          const k = tgt + ":" + v;
          hubAttrCount[k] = (hubAttrCount[k] || 0) + 1;
        });
      });
    });

    // Top-10 per target category from the hub
    ATTR_CATS.forEach(acat => {
      if (acat.id === categoryId) return;
      const same = [];
      Object.entries(hubAttrCount).forEach(([k, c]) => {
        if (k.startsWith(acat.id + ":")) same.push({ k, c });
      });
      same.sort((a, b) => b.c - a.c);
      same.slice(0, 10).forEach(({ k, c }) => {
        const ti = idToIdx["a:" + k];
        if (ti !== undefined) edges.push({ from: 0, to: ti, kind: "b-a", strength: 0.4 + Math.min(c, 8) * 0.08 });
      });
    });

    buildAttrComplementEdges(attrNodes, attrLocalIdx, data, [categoryId]).forEach(e => {
      edges.push({ from: e.from + 1, to: e.to + 1, kind: "compl", strength: e.strength });
    });

    runForceLayout(forceNodes, edges, 200, 0); // hub fixed at origin
    attributes = forceNodes.filter(n => n.kind === "attribute");
  }

  const bigs = [hub];
  const bigByName = { [hub.name]: hub };

  // MIDs: items orbiting the hub
  const midsRaw = items.map(it => ({ kind: "mid", name: it.name, label: it.label, parent: hub.name }));

  const attrLookup = hasComplements
    ? (s) => {
        const entry = compTable[s.name];
        if (!entry || typeof entry !== "object") return [];
        const res = [];
        Object.entries(entry).forEach(([field, values]) => {
          const tgt = COMP_FIELD_TO_CAT[field];
          if (!tgt || tgt === categoryId || !Array.isArray(values)) return;
          values.forEach(v => {
            const node = attrByKey[tgt + ":" + v];
            if (node) res.push(node);
          });
        });
        return res;
      }
    : null;

  // Larger orbit radius for flat layouts since many items share one hub
  const orbit = items.length > 30 ? 9 : items.length > 15 ? 7 : 5;
  const { mids, midsByKey } = placeMidsOrbital(midsRaw, bigByName, attrByKey, attrLookup, orbit);

  // Singular label
  const singular = cat.label.endsWith("s") ? cat.label.slice(0, -1) : cat.label;

  return {
    kind: "flat",
    bigs, mids, smalls: [], attributes,
    bigByName, midsByKey, data,
    bigLabel: cat.label + " (hub)", midLabel: singular, smallLabel: null,
    hasSmalls: false, hasAttrs: hasComplements,
    categoryId,
    midToAttrs: hasComplements
      ? (mid) => attrLookup(mid).map(n => ({ node: n, cat: ATTR_CAT_BY_ID[n.categoryId] }))
      : () => [],
    attrToMids: hasComplements
      ? (attr, cap = 15) => {
          const field = CAT_TO_COMP_FIELD[attr.categoryId];
          if (!field) return [];
          const res = [];
          for (const s of mids) {
            if (res.length >= cap) break;
            const entry = compTable[s.name];
            if (entry && Array.isArray(entry[field]) && entry[field].includes(attr.name)) res.push(s);
          }
          return res;
        }
      : () => [],
    bigAttrEdges: () => [],
  };
}

// ── Dispatcher ─────────────────────────────────────────────────────
function buildLayout(categoryId, data) {
  if (["genres", "subgenres", "microstyles"].includes(categoryId)) return buildGenreLayout(data);
  if (categoryId === "instruments") return buildInstrumentsLayout(data);
  if (categoryId === "moods")       return buildMoodsLayout(data);
  return buildFlatLayout(data, categoryId);
}

// ── Focus edge computation ─────────────────────────────────────────
function focusLines(focused, layout) {
  if (!focused) return [];
  const lines = [];

  if (focused.kind === "big") {
    // tree edges to MIDs of this BIG
    layout.mids.filter(s => s.parent === focused.name).forEach(s => {
      lines.push({ from: focused.pos, to: s.pos, color: s.color, kind: "tree" });
    });
    // attribute edges (aggregated top attrs)
    if (layout.hasAttrs) {
      (layout.bigAttrEdges(focused) || []).forEach(({ node, cat }) => {
        lines.push({ from: focused.pos, to: node.pos, color: cat.color, kind: "attr" });
      });
    }
  } else if (focused.kind === "mid") {
    const parent = layout.bigByName[focused.parent];
    if (parent) lines.push({ from: parent.pos, to: focused.pos, color: focused.color, kind: "tree" });
    if (layout.hasSmalls) {
      layout.smalls.filter(m => m.parent === focused.name && m.grandparent === focused.parent).forEach(m => {
        lines.push({ from: focused.pos, to: m.pos, color: m.color, kind: "tree" });
      });
    }
    if (layout.hasAttrs) {
      (layout.midToAttrs(focused) || []).forEach(({ node, cat }) => {
        lines.push({ from: focused.pos, to: node.pos, color: cat.color, kind: "attr" });
      });
    }
  } else if (focused.kind === "small") {
    const parent = layout.midsByKey[focused.parent + "/" + focused.grandparent];
    if (parent) lines.push({ from: parent.pos, to: focused.pos, color: focused.color, kind: "tree" });
    if (layout.hasAttrs && parent) {
      (layout.midToAttrs(parent) || []).slice(0, 3).forEach(({ node, cat }) => {
        lines.push({ from: focused.pos, to: node.pos, color: cat.color, kind: "attr" });
      });
    }
  } else if (focused.kind === "attribute") {
    const cat = ATTR_CAT_BY_ID[focused.categoryId];
    if (cat && cat.complTable && layout.data) {
      const table = layout.data[cat.complTable] || {};
      const entry = table[focused.name];
      if (entry && typeof entry === "object") {
        Object.entries(entry).forEach(([field, values]) => {
          const tgt = COMP_FIELD_TO_CAT[field];
          if (!tgt || !Array.isArray(values)) return;
          values.forEach(val => {
            const node = layout.attributes.find(a => a.categoryId === tgt && a.name === val);
            if (node) lines.push({ from: focused.pos, to: node.pos, color: node.color, kind: "compl" });
          });
        });
      }
    }
    (layout.attrToMids(focused, 15) || []).forEach(s => {
      lines.push({ from: focused.pos, to: s.pos, color: s.color, kind: "attr" });
    });
  }
  return lines;
}

// Relatedness helpers for dim/highlight
function isMidRelated(mid, focused, layout) {
  if (!focused) return true;
  if (focused.kind === "big") return mid.parent === focused.name;
  if (focused.kind === "mid") return mid.name === focused.name && mid.parent === focused.parent;
  if (focused.kind === "small") return mid.name === focused.parent && mid.parent === focused.grandparent;
  if (focused.kind === "attribute") {
    const related = layout.attrToMids(focused, 999) || [];
    return related.some(s => s.name === mid.name && s.parent === mid.parent);
  }
  return false;
}

function isAttrRelated(attr, focused, layout) {
  if (!focused) return true;
  if (focused.kind === "attribute") return focused.name === attr.name && focused.categoryId === attr.categoryId;
  if (focused.kind === "mid") {
    const related = layout.midToAttrs(focused) || [];
    return related.some(r => r.node.categoryId === attr.categoryId && r.node.name === attr.name);
  }
  if (focused.kind === "big" && layout.bigAttrEdges) {
    const related = layout.bigAttrEdges(focused) || [];
    return related.some(r => r.node.categoryId === attr.categoryId && r.node.name === attr.name);
  }
  return false;
}

// ── 3D Components ──────────────────────────────────────────────────

function BigNodes({ bigs, focused, layout, onSelect, onHover }) {
  return (
    <>
      {bigs.map(b => {
        const isF = focused?.kind === "big" && focused.name === b.name;
        const related =
          (focused?.kind === "mid"   && focused.parent === b.name) ||
          (focused?.kind === "small" && focused.grandparent === b.name);
        const dim = focused && !isF && !related;
        return (
          <group key={b.name} position={b.pos}>
            <mesh
              onClick={e => { e.stopPropagation(); onSelect(b); }}
              onPointerOver={e => { e.stopPropagation(); onHover(b); }}
              onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            >
              <sphereGeometry args={[BIG_R, 32, 32]} />
              <meshStandardMaterial
                color={b.color} emissive={b.color}
                emissiveIntensity={isF ? 2.6 : (dim ? 0.3 : 1.2)}
                toneMapped={false} opacity={dim ? 0.45 : 1} transparent={dim}
              />
            </mesh>
            <Html center distanceFactor={34} style={{ pointerEvents: "none" }}>
              <div style={{
                color: "#fff", fontSize: isF ? 13 : 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: isF ? 700 : 500, letterSpacing: "0.02em",
                background: isF ? "rgba(94,106,210,0.96)" : "rgba(10,10,15,0.78)",
                padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
                transform: "translate(-50%, 24px)", position: "absolute",
                opacity: dim ? 0.4 : 1, userSelect: "none",
              }}>{b.name}</div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function MidNodes({ mids, focused, layout, onSelect, onHover }) {
  if (!mids.length) return null;
  return (
    <Instances limit={Math.max(mids.length, 1)} range={mids.length}>
      <sphereGeometry args={[MID_R, 14, 14]} />
      <meshStandardMaterial emissiveIntensity={0.9} toneMapped={false} />
      {mids.map(s => {
        const isF = focused?.kind === "mid" && focused.name === s.name && focused.parent === s.parent;
        const rel = isMidRelated(s, focused, layout);
        const dim = focused && !rel;
        const scl = isF ? 1.75 : (rel && focused ? 1.25 : (dim ? 0.35 : 1));
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

function SmallNodes({ smalls, focused, onSelect, onHover }) {
  if (!smalls.length) return null;
  return (
    <Instances limit={Math.max(smalls.length, 1)} range={smalls.length}>
      <sphereGeometry args={[SMALL_R, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.7} toneMapped={false} />
      {smalls.map(m => {
        const isF = focused?.kind === "small" && focused.name === m.name && focused.parent === m.parent && focused.grandparent === m.grandparent;
        const inMid = focused?.kind === "mid" && focused.name === m.parent && focused.parent === m.grandparent;
        const inBig = focused?.kind === "big" && focused.name === m.grandparent;
        const dim = focused && !(isF || inMid || inBig);
        const scl = isF ? 2.4 : (inMid ? 1.35 : (dim ? 0.3 : 1));
        return (
          <Instance key={m.grandparent + "/" + m.parent + "/" + m.name}
            position={m.pos} color={m.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(m); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(m); }} />
        );
      })}
    </Instances>
  );
}

function AttributeNodes({ attributes, focused, layout, onSelect, onHover }) {
  if (!attributes.length) return null;
  return (
    <Instances limit={Math.max(attributes.length, 1)} range={attributes.length}>
      <sphereGeometry args={[ATTR_R, 12, 12]} />
      <meshStandardMaterial emissiveIntensity={0.9} toneMapped={false} />
      {attributes.map(a => {
        const isF = focused?.kind === "attribute" && focused.name === a.name && focused.categoryId === a.categoryId;
        const rel = isAttrRelated(a, focused, layout);
        const dim = focused && !isF && !rel;
        const scl = isF ? 2.2 : (rel && focused ? 1.4 : (dim ? 0.4 : 1));
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

// Batched renderer — one geometry for all edges. Uses LineSegments so a
// few thousand lines render at 60fps.
function AllTreeLines({ edges, opacity = 0.22 }) {
  const geom = useMemo(() => {
    if (!edges.length) return null;
    const positions = new Float32Array(edges.length * 6);
    const colors = new Float32Array(edges.length * 6);
    const c = new THREE.Color();
    edges.forEach((e, i) => {
      positions[i * 6 + 0] = e.from[0];
      positions[i * 6 + 1] = e.from[1];
      positions[i * 6 + 2] = e.from[2];
      positions[i * 6 + 3] = e.to[0];
      positions[i * 6 + 4] = e.to[1];
      positions[i * 6 + 5] = e.to[2];
      c.set(e.color || "#ffffff");
      colors[i * 6 + 0] = c.r; colors[i * 6 + 1] = c.g; colors[i * 6 + 2] = c.b;
      colors[i * 6 + 3] = c.r; colors[i * 6 + 4] = c.g; colors[i * 6 + 5] = c.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [edges]);
  if (!geom) return null;
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial vertexColors transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

function HoverTooltip({ hovered }) {
  if (!hovered) return null;
  const pos = hovered.pos;
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

function CameraRig({ focusTarget, resetCount, controlsRef }) {
  const { camera } = useThree();
  const animating = useRef(false);
  const destPos = useRef(new THREE.Vector3(0, 15, 130));
  const destTgt = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!focusTarget) { animating.current = false; return; }
    const p = focusTarget.pos;
    if (!p) return;
    const t = new THREE.Vector3(...p);
    destTgt.current.copy(t);
    const dist = focusTarget.kind === "big" ? 12 : focusTarget.kind === "mid" ? 5 : focusTarget.kind === "small" ? 2.5 : 5;
    const dir = t.length() > 0.01 ? t.clone().normalize() : new THREE.Vector3(0, 0, 1);
    destPos.current.copy(t.clone().add(dir.multiplyScalar(dist)));
    animating.current = true;
  }, [focusTarget]);

  // Reset: fly back to the default viewing position.
  useEffect(() => {
    if (!resetCount) return;
    destPos.current.set(0, 15, 130);
    destTgt.current.set(0, 0, 0);
    animating.current = true;
  }, [resetCount]);

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

// ── UI overlays ────────────────────────────────────────────────────

function Toggle({ on, onChange, label, color, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{
      display: "flex", alignItems: "center", gap: 9, padding: "5px 10px",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1, userSelect: "none", borderRadius: 4,
    }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: on ? color : "transparent", border: `1.5px solid ${color}` }} />
      <span style={{ fontSize: 12, fontFamily: T.fontMono, color: T.text }}>{label}</span>
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div style={{
      display: "flex", margin: "4px 10px 6px", borderRadius: 4,
      border: `1px solid ${T.borderHi}`, overflow: "hidden",
    }}>
      {options.map(opt => (
        <div key={opt.value} onClick={() => onChange(opt.value)} style={{
          flex: 1, textAlign: "center", padding: "4px 0",
          fontSize: 10, fontFamily: T.fontMono, letterSpacing: ".06em",
          cursor: "pointer", userSelect: "none",
          background: value === opt.value ? T.borderHi : "transparent",
          color: value === opt.value ? T.text : T.textMuted,
          textTransform: "uppercase",
        }}>{opt.label}</div>
      ))}
    </div>
  );
}

function SectionLabel({ children, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 10px 4px", borderTop: `1px solid ${T.borderHi}`, marginTop: 4,
    }}>
      <span style={{
        fontSize: 9, letterSpacing: ".14em", color: T.textMuted,
        textTransform: "uppercase", fontFamily: T.fontMono,
      }}>{children}</span>
      {action}
    </div>
  );
}

// Styled dropdown that matches the dark theme. Native <select> is used for
// accessibility (keyboard nav, screen readers) but visually restyled.
function Dropdown({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ""}
      onChange={e => onChange(e.target.value || null)}
      style={{
        width: "calc(100% - 20px)", margin: "2px 10px 4px",
        padding: "5px 8px", background: "rgba(20,20,28,0.85)",
        border: `1px solid ${T.borderHi}`, borderRadius: 4,
        color: T.text, fontSize: 12, fontFamily: T.fontMono,
        outline: "none", cursor: "pointer",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: "#16161e" }}>{o.label}</option>
      ))}
    </select>
  );
}

function SearchBox({ value, onChange, results, onResultClick }) {
  return (
    <div style={{ padding: "2px 10px 6px" }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && results.length > 0) {
            e.preventDefault();
            onResultClick(results[0]);
          }
        }}
        placeholder="Search in map… (Enter to pick top match)"
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "6px 10px", background: "rgba(20,20,28,0.85)",
          border: `1px solid ${T.borderHi}`, borderRadius: 4,
          color: T.text, fontSize: 12, fontFamily: T.fontMono,
          outline: "none",
        }}
      />
      {results.length > 0 && (
        <div style={{
          marginTop: 4, maxHeight: 180, overflowY: "auto",
          background: "rgba(14,14,22,0.95)",
          border: `1px solid ${T.borderHi}`, borderRadius: 4,
        }}>
          {results.map((r, i) => {
            const kindBadge =
              r.kind === "big"  ? "G" :
              r.kind === "mid"  ? "S" :
              r.kind === "small" ? "M" : "A";
            const kindColor =
              r.kind === "big"   ? "#A78BFA" :
              r.kind === "mid"   ? "#60A5FA" :
              r.kind === "small" ? "#F472B6" : "#2DD4BF";
            return (
              <div
                key={`${r.kind}:${r.name}:${i}`}
                onClick={() => onResultClick(r)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", cursor: "pointer",
                  borderBottom: i < results.length - 1 ? `1px solid ${T.border}` : "none",
                  fontSize: 11, fontFamily: T.fontMono, color: T.text,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(94,106,210,0.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{
                  display: "inline-block", width: 14, height: 14, lineHeight: "14px",
                  textAlign: "center", fontSize: 9, fontWeight: 700,
                  color: kindColor, border: `1px solid ${kindColor}`, borderRadius: 2,
                  flexShrink: 0,
                }}>{kindBadge}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                {r.parent && (
                  <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: ".05em" }}>
                    {r.grandparent ? `${r.grandparent} › ${r.parent}` : r.parent}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttrCategoryChips({ layout, filters, setFilters }) {
  const allIds = ATTR_CATS.map(c => c.id);
  const active = filters.attrCats;
  const isOn = (id) => !active || active.has(id);

  const toggle = (id) => {
    // First click on a category with "all on" state → select ONLY that one.
    // Subsequent clicks on other categories → add them to the set.
    // Clicking the only active category → back to "all on".
    setFilters(f => {
      let next;
      if (!f.attrCats) {
        next = new Set([id]);
      } else {
        next = new Set(f.attrCats);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (next.size === 0 || next.size === allIds.length) next = null;
      }
      return { ...f, attrCats: next };
    });
  };
  const reset = () => setFilters(f => ({ ...f, attrCats: null }));

  return (
    <div style={{ padding: "2px 10px 8px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {ATTR_CATS.map(cat => {
          const on = isOn(cat.id);
          return (
            <div
              key={cat.id}
              onClick={() => toggle(cat.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 7px",
                background: on ? `${cat.color}22` : "transparent",
                border: `1px solid ${on ? cat.color : T.border}`,
                borderRadius: 3, cursor: "pointer", userSelect: "none",
                fontSize: 10, fontFamily: T.fontMono,
                color: on ? T.text : T.textMuted,
                transition: "background 120ms, border-color 120ms, color 120ms",
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: on ? cat.color : "transparent",
                border: `1px solid ${cat.color}`,
              }} />
              {cat.label}
            </div>
          );
        })}
      </div>
      {active && (
        <div
          onClick={reset}
          style={{
            marginTop: 4, fontSize: 9, letterSpacing: ".1em", color: T.textMuted,
            cursor: "pointer", fontFamily: T.fontMono, textTransform: "uppercase",
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.text}
          onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
        >
          ↺ show all categories
        </div>
      )}
    </div>
  );
}

function LayerPanel({
  layers, setLayers, layout,
  linesMode, setLinesMode,
  autoRotate, setAutoRotate,
  filters, setFilters,
  search, setSearch,
  searchResults, onSearchResultClick,
}) {
  // Big options — always all bigs.
  const bigOptions = layout.bigs.map(b => ({ value: b.name, label: b.name }));

  // Mid options depend on selected big (scope the list to subs under it).
  const midOptions = useMemo(() => {
    let src = layout.mids;
    if (filters.bigName) src = src.filter(m => m.parent === filters.bigName);
    return src
      .map(m => ({ value: m.name, label: m.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [layout.mids, filters.bigName]);

  const handleBigChange = (v) => {
    setFilters(f => {
      // Changing the big invalidates the mid selection unless the mid
      // still exists under the new big.
      if (v && f.midName) {
        const stillValid = layout.mids.some(m => m.parent === v && m.name === f.midName);
        if (!stillValid) return { ...f, bigName: v, midName: null };
      }
      return { ...f, bigName: v };
    });
  };

  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      width: 260,
      maxHeight: "calc(100vh - 160px)",
      overflowY: "auto",
      background: "rgba(10,10,15,0.94)",
      border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md,
      padding: "6px 0",
      zIndex: 10,
      boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    }}>
      <div style={{
        padding: "4px 10px 4px", fontSize: 9, letterSpacing: ".14em",
        color: T.textMuted, textTransform: "uppercase",
        borderBottom: `1px solid ${T.borderHi}`, marginBottom: 2,
        fontFamily: T.fontMono,
      }}>show</div>
      <Toggle on label={`${layout.bigLabel} (big)`} color="#A78BFA" disabled />
      <Toggle on={layers.mids} label={`${layout.midLabel} (mid)`} color="#60A5FA"
        onChange={v => setLayers(l => ({ ...l, mids: v, smalls: !v ? false : l.smalls }))} />
      {layout.hasSmalls && (
        <Toggle on={layers.smalls} label={`${layout.smallLabel} (small)`} color="#F472B6"
          disabled={!layers.mids} onChange={v => setLayers(l => ({ ...l, smalls: v }))} />
      )}
      {layout.hasAttrs && (
        <Toggle on={layers.attributes} label="Attributes cloud" color="#2DD4BF"
          onChange={v => setLayers(l => ({ ...l, attributes: v }))} />
      )}

      <SectionLabel>search</SectionLabel>
      <SearchBox
        value={search}
        onChange={setSearch}
        results={searchResults}
        onResultClick={onSearchResultClick}
      />

      <SectionLabel action={
        (filters.bigName || filters.midName) ? (
          <span
            onClick={() => setFilters(f => ({ ...f, bigName: null, midName: null }))}
            style={{
              fontSize: 9, color: T.textMuted, cursor: "pointer",
              fontFamily: T.fontMono, letterSpacing: ".1em",
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
          >clear</span>
        ) : null
      }>isolate</SectionLabel>
      <Dropdown
        value={filters.bigName}
        onChange={handleBigChange}
        options={bigOptions}
        placeholder={`All ${layout.bigLabel.toLowerCase()}s`}
      />
      {layers.mids && (
        <Dropdown
          value={filters.midName}
          onChange={v => setFilters(f => ({ ...f, midName: v }))}
          options={midOptions}
          placeholder={`All ${layout.midLabel.toLowerCase()}s`}
        />
      )}

      {layout.hasAttrs && (
        <>
          <SectionLabel>attributes</SectionLabel>
          <AttrCategoryChips layout={layout} filters={filters} setFilters={setFilters} />
        </>
      )}

      <SectionLabel>connections</SectionLabel>
      <SegmentedControl value={linesMode} onChange={setLinesMode} options={[
        { value: "off",  label: "off" },
        { value: "auto", label: "auto" },
        { value: "on",   label: "on" },
      ]} />

      <SectionLabel>motion</SectionLabel>
      <Toggle on={autoRotate} label="Auto-rotate" color="#FACC15"
        onChange={setAutoRotate} />
    </div>
  );
}

function FocusHUD({ focused, onClear, layout }) {
  if (!focused) return (
    <div style={{
      position: "absolute", bottom: 16, left: 16, fontSize: 10,
      color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.65)", padding: "6px 10px",
      borderRadius: T.r_sm, userSelect: "none", zIndex: 10,
    }}>drag · scroll · click a node to see its pairings</div>
  );

  let kindLabel, crumbs;
  if (focused.kind === "big")        { kindLabel = layout.bigLabel;   crumbs = [focused.name]; }
  else if (focused.kind === "mid")   { kindLabel = layout.midLabel;   crumbs = [focused.parent, focused.name]; }
  else if (focused.kind === "small") { kindLabel = layout.smallLabel; crumbs = [focused.grandparent, focused.parent, focused.name]; }
  else                                { const c = ATTR_CAT_BY_ID[focused.categoryId]; kindLabel = c ? c.label : focused.categoryId; crumbs = [focused.label || focused.name]; }

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
      <button onClick={onClear} style={{
        fontSize: 10, color: T.textMuted, background: "transparent",
        border: `1px solid ${T.borderHi}`, borderRadius: T.r_sm,
        padding: "3px 8px", cursor: "pointer", fontFamily: T.fontMono, letterSpacing: ".05em",
      }}>CLEAR ×</button>
    </div>
  );
}

function ResetViewButton({ onReset, hasFocus }) {
  // Only show when there's something worth resetting from.
  // (No focus AND no camera drift means the button is noise.)
  return (
    <div
      onClick={onReset}
      title="Reset view (Esc)"
      style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        background: "rgba(10,10,15,0.92)", border: `1px solid ${T.borderHi}`,
        borderRadius: T.r_sm, padding: "6px 14px", cursor: "pointer",
        color: T.textSec, fontSize: 10, fontFamily: T.fontMono,
        letterSpacing: ".14em", textTransform: "uppercase", userSelect: "none",
        zIndex: 10, transition: "color 120ms, border-color 120ms",
      }}
      onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.color = T.textSec; e.currentTarget.style.borderColor = T.borderHi; }}
    >
      ⟲ reset view
    </div>
  );
}

function StatsBadge({ layout, focused }) {
  // When focused on a big node, show child counts for that node only.
  // When focused on a mid, show micro count and attr count for that sub.
  // When focused on an attr, show how many subs use it.
  // Otherwise, show global totals.
  let primary, secondary;

  if (focused?.kind === "big") {
    const subs = layout.mids.filter(m => m.parent === focused.name);
    const micros = layout.smalls.filter(s => s.grandparent === focused.name);
    const attrs = layout.bigAttrEdges ? layout.bigAttrEdges({ name: focused.name }) : [];
    primary = `${subs.length} ${layout.midLabel.toLowerCase()}${layout.hasSmalls ? ` · ${micros.length} ${layout.smallLabel.toLowerCase()}` : ""}`;
    secondary = attrs.length ? `${attrs.length} top attributes` : null;
  } else if (focused?.kind === "mid") {
    const micros = layout.smalls.filter(s => s.parent === focused.name && (!focused.parent || s.grandparent === focused.parent));
    const attrs = layout.midToAttrs ? layout.midToAttrs({ name: focused.name, parent: focused.parent }) : [];
    primary = layout.hasSmalls ? `${micros.length} ${layout.smallLabel.toLowerCase()}` : null;
    secondary = attrs.length ? `${attrs.length} attribute pairings` : null;
  } else if (focused?.kind === "attribute") {
    const users = layout.attrToMids ? layout.attrToMids({ name: focused.name, categoryId: focused.categoryId }, 999) : [];
    primary = `used by ${users.length} ${layout.midLabel.toLowerCase()}`;
    secondary = null;
  } else {
    primary = `${layout.bigs.length} ${layout.bigLabel.toLowerCase()} · ${layout.mids.length} ${layout.midLabel.toLowerCase()}${layout.hasSmalls ? ` · ${layout.smalls.length} ${layout.smallLabel.toLowerCase()}` : ""}`;
    secondary = layout.hasAttrs ? `${layout.attributes.length} attributes` : null;
  }

  return (
    <div style={{
      position: "absolute", top: 16, right: 16, fontSize: 10,
      color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.65)", padding: "6px 10px",
      borderRadius: T.r_sm, userSelect: "none", lineHeight: 1.8,
      letterSpacing: ".04em", zIndex: 10,
    }}>
      {primary && <div>{primary}</div>}
      {secondary && <div>{secondary}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export default function CategoryMap3D({ categoryId = "genres", data }) {
  const layout = useMemo(() => buildLayout(categoryId, data || {}), [categoryId, data]);

  const [layers, setLayers] = useState({
    mids: true,
    smalls: layout.hasSmalls && categoryId === "microstyles",
    attributes: layout.hasAttrs,
  });
  const [focused, setFocused] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [linesMode, setLinesMode] = useState("auto");   // "off" | "auto" | "on"
  const [autoRotate, setAutoRotate] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  // Filtering panel — lets the user isolate a specific big/mid and restrict
  // attrs to specific categories. `null` means "no filter" for that slot.
  //   bigName:   show only this big + its descendants
  //   midName:   show only this mid + its children
  //   attrCats:  null = all categories; Set of ids = only those
  const [filters, setFilters] = useState({ bigName: null, midName: null, attrCats: null });
  // Live text search. When non-empty, a dropdown of top matches is shown;
  // clicking a match focuses the corresponding node.
  const [search, setSearch] = useState("");

  const controlsRef = useRef();
  const interactionTimer = useRef(null);

  // Reset when switching categories
  useEffect(() => {
    setFocused(null);
    setHovered(null);
    setLayers({
      mids: true,
      smalls: layout.hasSmalls && categoryId === "microstyles",
      attributes: layout.hasAttrs,
    });
    setLinesMode("auto");
    setAutoRotate(false);
    setFilters({ bigName: null, midName: null, attrCats: null });
    setSearch("");
  }, [categoryId, layout.hasSmalls, layout.hasAttrs]);

  // Escape key: clear search → clear focus → reset view (cascading)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        if (search) setSearch("");
        else if (focused) setFocused(null);
        else setResetCount(c => c + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focused, search]);

  // ── Visible lists (filters applied) ──────────────────────────────
  const visibleBigs = useMemo(() => {
    if (!filters.bigName) return layout.bigs;
    return layout.bigs.filter(b => b.name === filters.bigName);
  }, [layout.bigs, filters.bigName]);

  const visibleMids = useMemo(() => {
    let mids = layout.mids;
    if (filters.bigName) mids = mids.filter(m => m.parent === filters.bigName);
    if (filters.midName) mids = mids.filter(m => m.name === filters.midName);
    return mids;
  }, [layout.mids, filters.bigName, filters.midName]);

  const visibleSmalls = useMemo(() => {
    let smalls = layout.smalls;
    if (filters.bigName) smalls = smalls.filter(s => s.grandparent === filters.bigName);
    if (filters.midName) smalls = smalls.filter(s => s.parent === filters.midName);
    return smalls;
  }, [layout.smalls, filters.bigName, filters.midName]);

  const visibleAttributes = useMemo(() => {
    if (!filters.attrCats) return layout.attributes;
    return layout.attributes.filter(a => filters.attrCats.has(a.categoryId));
  }, [layout.attributes, filters.attrCats]);

  // ── Search index ──────────────────────────────────────────────────
  const searchIndex = useMemo(() => {
    const out = [];
    for (const b of layout.bigs) out.push({ kind: "big", name: b.name, node: b });
    for (const m of layout.mids) out.push({ kind: "mid", name: m.name, parent: m.parent, node: m });
    for (const s of layout.smalls) out.push({ kind: "small", name: s.name, parent: s.parent, grandparent: s.grandparent, node: s });
    for (const a of layout.attributes) out.push({ kind: "attribute", name: a.label || a.name, categoryId: a.categoryId, node: a });
    return out;
  }, [layout]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    // Prefer prefix matches first, then substring matches.
    const prefix = [], sub = [];
    for (const item of searchIndex) {
      const n = item.name.toLowerCase();
      if (n === q) prefix.unshift(item);          // exact match goes to top
      else if (n.startsWith(q)) prefix.push(item);
      else if (n.includes(q)) sub.push(item);
    }
    return [...prefix, ...sub].slice(0, 12);
  }, [search, searchIndex]);

  const lines = useMemo(() => focusLines(focused, layout), [focused, layout]);

  // All tree edges — used when linesMode === "on". Computed from positions
  // so it works for every category shape (genres, instruments, moods, flat).
  const allEdges = useMemo(() => {
    const out = [];
    for (const m of visibleMids) {
      const parent = layout.bigByName?.[m.parent];
      if (parent?.pos && m.pos && (!filters.bigName || parent.name === filters.bigName)) {
        out.push({ from: parent.pos, to: m.pos, color: m.color || parent.color });
      }
    }
    if (layout.hasSmalls && layers.smalls && layers.mids) {
      const midLookup = (sName, gName) =>
        layout.midsByKey?.[sName + "/" + gName] ||
        layout.midsByKey?.[sName] ||
        layout.mids.find(x => x.name === sName && (!gName || x.parent === gName));
      for (const s of visibleSmalls) {
        const parent = midLookup(s.parent, s.grandparent);
        if (parent?.pos && s.pos) out.push({ from: parent.pos, to: s.pos, color: s.color || parent.color });
      }
    }
    return out;
  }, [visibleMids, visibleSmalls, layout, layers.smalls, layers.mids, filters.bigName]);

  const selectBig   = b => setFocused({ kind: "big",       name: b.name, pos: b.pos });
  const selectMid   = s => setFocused({ kind: "mid",       name: s.name, parent: s.parent, pos: s.pos });
  const selectSmall = m => setFocused({ kind: "small",     name: m.name, parent: m.parent, grandparent: m.grandparent, pos: m.pos });
  const selectAttr  = a => setFocused({ kind: "attribute", name: a.name, label: a.label, categoryId: a.categoryId, pos: a.pos });

  const handleReset = () => {
    setFocused(null);
    setFilters({ bigName: null, midName: null, attrCats: null });
    setSearch("");
    setResetCount(c => c + 1);
  };

  const handleSearchResultClick = (item) => {
    setSearch("");
    if (item.kind === "big") selectBig(item.node);
    else if (item.kind === "mid") selectMid(item.node);
    else if (item.kind === "small") selectSmall(item.node);
    else selectAttr(item.node);
  };

  // Pause auto-rotate for ~2.5s after each interaction. This prevents the
  // "wait… where did it go?" feeling when you drag and the camera keeps
  // spinning afterwards.
  const onControlsStart = () => {
    setInteracting(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
  };
  const onControlsEnd = () => {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setInteracting(false), 2500);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 80px)", minHeight: 500, background: "radial-gradient(ellipse at center, #0A0A14 0%, #04040B 70%)", overflow: "hidden" }}>
      <Canvas camera={{ position: [0, 15, 130], fov: 50, near: 0.1, far: 800 }} dpr={[1, 2]} onPointerMissed={() => setFocused(null)}>
        <color attach="background" args={["#04040B"]} />
        <ambientLight intensity={0.36} />
        <pointLight position={[0, 0, 0]} intensity={0.7} distance={260} color="#9aa8ff" />
        <pointLight position={[80, 40, 40]} intensity={0.35} distance={200} color="#ffd6a8" />

        <Suspense fallback={null}>
          <Stars radius={300} depth={90} count={2000} factor={4} saturation={0} fade speed={0.2} />

          <BigNodes bigs={visibleBigs} focused={focused} layout={layout} onSelect={selectBig} onHover={setHovered} />

          {layers.mids && (
            <MidNodes mids={visibleMids} focused={focused} layout={layout} onSelect={selectMid} onHover={setHovered} />
          )}

          {layout.hasSmalls && layers.mids && layers.smalls && (
            <SmallNodes smalls={visibleSmalls} focused={focused} onSelect={selectSmall} onHover={setHovered} />
          )}

          {layout.hasAttrs && layers.attributes && (
            <AttributeNodes attributes={visibleAttributes} focused={focused} layout={layout} onSelect={selectAttr} onHover={setHovered} />
          )}

          {linesMode === "on" && <AllTreeLines edges={allEdges} opacity={0.22} />}
          {linesMode !== "off" && <FocusEdges lines={lines} visible={!!focused} />}

          <HoverTooltip hovered={hovered} />
        </Suspense>

        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.07} minDistance={2} maxDistance={260} rotateSpeed={0.55} zoomSpeed={0.9} panSpeed={0.6}
          autoRotate={autoRotate && !interacting} autoRotateSpeed={0.6}
          onStart={onControlsStart} onEnd={onControlsEnd} />
        <CameraRig focusTarget={focused} resetCount={resetCount} controlsRef={controlsRef} />
      </Canvas>

      <LayerPanel
        layers={layers} setLayers={setLayers} layout={layout}
        linesMode={linesMode} setLinesMode={setLinesMode}
        autoRotate={autoRotate} setAutoRotate={setAutoRotate}
        filters={filters} setFilters={setFilters}
        search={search} setSearch={setSearch}
        searchResults={searchResults}
        onSearchResultClick={handleSearchResultClick}
      />
      <StatsBadge layout={layout} focused={focused} />
      <ResetViewButton onReset={handleReset} hasFocus={!!focused || !!filters.bigName || !!filters.midName || !!filters.attrCats} />
      <FocusHUD focused={focused} onClear={() => setFocused(null)} layout={layout} />
    </div>
  );
}
