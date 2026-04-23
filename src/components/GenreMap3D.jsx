import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instances, Instance, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { T } from "../theme.js";

/* ═══════════════════════════════════════════════════════════════════
 * GenreMap3D — v4
 *
 * What's new vs v3:
 *  • Subgenre positions REFINED via force simulation — similar
 *    subgenres in different genres now face each other across the
 *    galaxy (instead of arbitrary Fibonacci placement).
 *  • Attribute links for ALL node types:
 *    - Genre focus → aggregate attribute lines (top attrs across subs)
 *    - Subgenre focus → direct attribute lines (was already there)
 *    - Microstyle focus → inherits parent subgenre's attribute lines
 *    - Attribute focus → reverse lines to subgenres using it
 *  • Complement links — when an attribute is focused, show its
 *    complement pairings (from MOOD_COMPLEMENTS etc.) as lines to
 *    related attribute nodes in other categories.
 *  • Attribute node positions nudged toward their subgenre centroid
 *    (subtle data-driven lean while keeping category clustering).
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

// ── Attribute category config ───────────────────────────────────────
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
const GI_SIM_FIELDS = ["moods", "harmonics", "textures", "energies", "grooves"];

// Map from complement-entry field name → attribute category id
const COMP_FIELD_TO_CAT = {
  mood: "moods", energy: "energies", groove: "grooves", vocalist: "vocalists",
  lyricalVibe: "lyrical", harmonic: "harmonics", texture: "textures", mix: "mix",
};

// ── Geometry constants ──────────────────────────────────────────────
const SYSTEM_R     = 32;
const SUB_ORBIT    = 3.6;
const MICRO_ORBIT  = 0.95;
const PLANET_R     = 0.30;
const MOON_R       = 0.10;
const ATTR_R       = 0.20;
const ATTR_SHELL_R = 58;
const ATTR_CL_R    = 4.5;
const SUN_R_BASE   = 0.65;
const SUN_R_MAX    = 1.35;

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

// ── Genre similarity (Jaccard from GENRE_INTUITION) ─────────────────
function computeGenreSimilarity(tree, genreIntuition) {
  const gNames = Object.keys(tree);
  const attrSets = {};
  gNames.forEach(gName => {
    const s = new Set();
    Object.keys(tree[gName]).forEach(sName => {
      const gi = genreIntuition[sName] || genreIntuition[sName.toLowerCase()];
      if (!gi) return;
      GI_SIM_FIELDS.forEach(f => (gi[f] || []).forEach(v => s.add(f + ":" + v)));
    });
    attrSets[gName] = s;
  });
  const matrix = {};
  gNames.forEach(a => {
    matrix[a] = {};
    gNames.forEach(b => {
      if (a === b) { matrix[a][b] = 1; return; }
      const A = attrSets[a], B = attrSets[b];
      let inter = 0;
      for (const v of A) if (B.has(v)) inter++;
      const union = A.size + B.size - inter;
      matrix[a][b] = union > 0 ? inter / union : 0;
    });
  });
  return matrix;
}

// ── Force-directed 3D layout for genres ────────────────────────────
function forceLayout3D(gNames, simMatrix, iterations = 180) {
  const n = gNames.length;
  const pos = fibSphere(n).map(p => ({ x: p[0] * SYSTEM_R, y: p[1] * SYSTEM_R, z: p[2] * SYSTEM_R }));
  for (let iter = 0; iter < iterations; iter++) {
    const forces = pos.map(() => ({ x: 0, y: 0, z: 0 }));
    const damping = 0.6 * Math.pow(0.975, iter);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const sim = simMatrix[gNames[i]][gNames[j]];
        const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, dz = pos[j].z - pos[i].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        const idealDist = SYSTEM_R * (1.8 - sim * 1.2);
        const f = (dist - idealDist) * 0.025 * damping;
        forces[i].x += nx * f; forces[i].y += ny * f; forces[i].z += nz * f;
        forces[j].x -= nx * f; forces[j].y -= ny * f; forces[j].z -= nz * f;
      }
    }
    for (let i = 0; i < n; i++) {
      pos[i].x += forces[i].x; pos[i].y += forces[i].y; pos[i].z += forces[i].z;
      const len = Math.sqrt(pos[i].x ** 2 + pos[i].y ** 2 + pos[i].z ** 2) || 1;
      pos[i].x = pos[i].x / len * SYSTEM_R;
      pos[i].y = pos[i].y / len * SYSTEM_R;
      pos[i].z = pos[i].z / len * SYSTEM_R;
    }
  }
  return pos.map(p => [p.x, p.y, p.z]);
}

// ── Refine subgenre positions: orient each sub toward its cross-genre matches ─
// Each subgenre lives on a sphere of radius SUB_ORBIT around its parent.
// We optimize the direction vector (localDir) so:
//  • Cross-family similar subs pull each other's directions toward each other
//  • Same-genre siblings repel to stay spread
// After N iterations, similar subs from different genres face each other.
function refineSubgenreDirections(subgenres, genrePositions, simPairs, iterations = 60) {
  const n = subgenres.length;

  // Group subs by parent genre index for fast sibling iteration
  const byGenre = {};
  subgenres.forEach((s, i) => {
    if (!byGenre[s.genreIdx]) byGenre[s.genreIdx] = [];
    byGenre[s.genreIdx].push(i);
  });

  // Precompute current world position from direction
  const worldPos = (s) => {
    const g = genrePositions[s.genreIdx];
    return [g[0] + s.localDir[0] * SUB_ORBIT, g[1] + s.localDir[1] * SUB_ORBIT, g[2] + s.localDir[2] * SUB_ORBIT];
  };

  for (let iter = 0; iter < iterations; iter++) {
    const forces = subgenres.map(() => [0, 0, 0]);
    const damping = 0.4 * Math.pow(0.97, iter);

    // Cross-family attraction
    for (const [i, j, score] of simPairs) {
      const a = subgenres[i], b = subgenres[j];
      if (a.genreIdx === b.genreIdx) continue;

      const aPos = worldPos(a), bPos = worldPos(b);
      const aParent = genrePositions[a.genreIdx], bParent = genrePositions[b.genreIdx];

      // Desired direction for A: toward B, relative to A's parent
      const dAx = bPos[0] - aParent[0], dAy = bPos[1] - aParent[1], dAz = bPos[2] - aParent[2];
      const lA = Math.sqrt(dAx * dAx + dAy * dAy + dAz * dAz) || 1;
      // Desired direction for B: toward A, relative to B's parent
      const dBx = aPos[0] - bParent[0], dBy = aPos[1] - bParent[1], dBz = aPos[2] - bParent[2];
      const lB = Math.sqrt(dBx * dBx + dBy * dBy + dBz * dBz) || 1;

      const strength = score * 0.012 * damping;
      forces[i][0] += (dAx / lA) * strength;
      forces[i][1] += (dAy / lA) * strength;
      forces[i][2] += (dAz / lA) * strength;
      forces[j][0] += (dBx / lB) * strength;
      forces[j][1] += (dBy / lB) * strength;
      forces[j][2] += (dBz / lB) * strength;
    }

    // Sibling repulsion (only within same parent)
    Object.values(byGenre).forEach(indices => {
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const i = indices[a], j = indices[b];
          const A = subgenres[i].localDir, B = subgenres[j].localDir;
          const dx = A[0] - B[0], dy = A[1] - B[1], dz = A[2] - B[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
          const f = 0.007 * damping / (dist * dist);
          forces[i][0] += (dx / dist) * f;
          forces[i][1] += (dy / dist) * f;
          forces[i][2] += (dz / dist) * f;
          forces[j][0] -= (dx / dist) * f;
          forces[j][1] -= (dy / dist) * f;
          forces[j][2] -= (dz / dist) * f;
        }
      }
    });

    // Apply forces and renormalize each localDir to unit sphere
    for (let i = 0; i < n; i++) {
      const d = subgenres[i].localDir;
      d[0] += forces[i][0]; d[1] += forces[i][1]; d[2] += forces[i][2];
      const len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1;
      d[0] /= len; d[1] /= len; d[2] /= len;
    }
  }
}

// ── Nudge attribute positions toward their subgenre centroid ───────
// Small tangent-plane nudge on the outer shell — preserves category
// clustering while making nodes lean toward the music region that uses them.
function nudgeAttributePositions(attributeNodes, attrToSubs, subsByKey, nudgeAmount = 2.2) {
  attributeNodes.forEach(node => {
    const key = node.categoryId + ":" + node.name;
    const subKeys = attrToSubs[key];
    if (!subKeys || subKeys.size === 0) return;

    // Centroid of subgenres that use this attribute
    let cx = 0, cy = 0, cz = 0, count = 0;
    for (const sKey of subKeys) {
      const sub = subsByKey[sKey];
      if (sub) { cx += sub.position[0]; cy += sub.position[1]; cz += sub.position[2]; count++; }
    }
    if (count === 0) return;
    cx /= count; cy /= count; cz /= count;

    // Tangent-plane projection: direction along the outer sphere toward centroid
    const [px, py, pz] = node.poleCenter;
    const nLen = Math.sqrt(px * px + py * py + pz * pz) || 1;
    const nx = px / nLen, ny = py / nLen, nz = pz / nLen;

    const tx = cx - px, ty = cy - py, tz = cz - pz;
    const dot = tx * nx + ty * ny + tz * nz;
    const tangX = tx - dot * nx;
    const tangY = ty - dot * ny;
    const tangZ = tz - dot * nz;
    const tLen = Math.sqrt(tangX * tangX + tangY * tangY + tangZ * tangZ);
    if (tLen < 0.01) return;

    node.position = [
      node.position[0] + (tangX / tLen) * nudgeAmount,
      node.position[1] + (tangY / tLen) * nudgeAmount,
      node.position[2] + (tangZ / tLen) * nudgeAmount,
    ];
  });
}

// ── Main layout builder ─────────────────────────────────────────────
function buildLayout(data) {
  const tree           = data.GENRE_TREE      || {};
  const genreIntuition = data.GENRE_INTUITION || {};
  const gNames = Object.keys(tree);

  // 1. Genre similarity matrix & force-directed positions
  const simMatrix      = computeGenreSimilarity(tree, genreIntuition);
  const genrePositions = forceLayout3D(gNames, simMatrix);

  // 2. Genre objects
  const maxSubs = Math.max(...gNames.map(g => Object.keys(tree[g]).length));
  const genres = gNames.map((g, i) => ({
    name: g, color: GENRE_COLORS[g] || DEFAULT_COLOR,
    position: genrePositions[i],
    subCount: Object.keys(tree[g]).length,
    sunRadius: SUN_R_BASE + (SUN_R_MAX - SUN_R_BASE) * (Object.keys(tree[g]).length / maxSubs),
    topSimilar: gNames.filter(b => b !== g).map(b => ({ name: b, score: simMatrix[g][b] }))
      .sort((a, b) => b.score - a.score).slice(0, 5),
    genreIdx: i,
  }));

  // 3. Subgenre objects with initial Fibonacci direction vectors
  const subgenres = [];
  gNames.forEach((gName, gi) => {
    const seed = hash01(gName);
    const qRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(seed * Math.PI * 2), Math.sin(seed * Math.PI * 2), Math.cos(seed * Math.PI * 4)).normalize(),
      seed * Math.PI * 2
    );
    const subs = Object.keys(tree[gName] || {});
    fibSphere(subs.length).forEach((sp, si) => {
      const d = new THREE.Vector3(...sp).applyQuaternion(qRot);
      subgenres.push({
        name: subs[si], parent: gName, genreIdx: gi,
        color: genres[gi].color,
        localDir: [d.x, d.y, d.z], // unit vector, will be refined
      });
    });
  });

  // 4. Compute subgenre similarity (used for both refinement and rendering)
  const subAttrSets = subgenres.map(sub => {
    const gi = genreIntuition[sub.name] || genreIntuition[sub.name.toLowerCase()];
    const set = new Set();
    if (gi) GI_SIM_FIELDS.forEach(f => (gi[f] || []).forEach(v => set.add(f + ":" + v)));
    return set;
  });

  // Keep full pair list for force sim + top-K per sub for rendering
  const simPairsForSim = [];
  const renderPairsBySub = Array.from({ length: subgenres.length }, () => []);
  for (let i = 0; i < subgenres.length; i++) {
    const cands = [];
    for (let j = 0; j < subgenres.length; j++) {
      if (i === j) continue;
      let shared = 0;
      for (const x of subAttrSets[i]) if (subAttrSets[j].has(x)) shared++;
      if (shared >= 3) cands.push({ j, score: shared });
    }
    cands.sort((a, b) => b.score - a.score);
    cands.slice(0, 5).forEach(({ j, score }) => {
      renderPairsBySub[i].push({ j, score });
      if (j > i) simPairsForSim.push([i, j, score]);
    });
  }

  // 5. REFINE subgenre directions via force simulation
  refineSubgenreDirections(subgenres, genrePositions, simPairsForSim, 60);

  // 6. Finalize subgenre world positions from refined directions
  subgenres.forEach(s => {
    const g = genrePositions[s.genreIdx];
    s.position = [g[0] + s.localDir[0] * SUB_ORBIT, g[1] + s.localDir[1] * SUB_ORBIT, g[2] + s.localDir[2] * SUB_ORBIT];
  });
  const subsByKey = {};
  subgenres.forEach(s => { subsByKey[s.name + "/" + s.parent] = s; });

  // 7. Microstyles (Fibonacci around refined subgenre positions)
  const microstyles = [];
  subgenres.forEach(s => {
    const sSeed = hash01(s.parent + "/" + s.name);
    const sRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.sin(sSeed * Math.PI * 2), Math.cos(sSeed * Math.PI * 2), Math.sin(sSeed * Math.PI * 3.7)).normalize(),
      sSeed * Math.PI * 2
    );
    const microNames = tree[s.parent][s.name] || [];
    const microEntries = [];
    fibSphere(microNames.length).forEach((mp, mi) => {
      const d = new THREE.Vector3(...mp).applyQuaternion(sRot);
      const mPos = [s.position[0] + d.x * MICRO_ORBIT, s.position[1] + d.y * MICRO_ORBIT, s.position[2] + d.z * MICRO_ORBIT];
      const entry = { name: microNames[mi], parent: s.name, grandparent: s.parent, color: s.color, position: mPos };
      microEntries.push(entry);
      microstyles.push(entry);
    });
    s.microstyles = microEntries;
  });

  // 8. attrToSubs reverse index
  const attrToSubs = {};
  subgenres.forEach(sub => {
    const gi = genreIntuition[sub.name] || genreIntuition[sub.name.toLowerCase()];
    if (!gi) return;
    ATTR_CATS.forEach(cat => {
      if (!cat.giField) return;
      (gi[cat.giField] || []).forEach(val => {
        const key = cat.id + ":" + val;
        if (!attrToSubs[key]) attrToSubs[key] = new Set();
        attrToSubs[key].add(sub.name + "/" + sub.parent);
      });
    });
  });

  // 9. Attribute cloud — 8 category clusters
  const clusterPoles = fibSphere(ATTR_CATS.length);
  const attributeNodes = [], attributeClusters = [];
  ATTR_CATS.forEach((cat, ci) => {
    const poleCtr = new THREE.Vector3(...clusterPoles[ci]).normalize().multiplyScalar(ATTR_SHELL_R);
    const items = (data[cat.dataKey] || []).map(item =>
      cat.isObjects ? { name: item[cat.nameKey], label: item[cat.labelKey] } : { name: item, label: item }
    );
    const catSeed = hash01(cat.id);
    const catRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(catSeed * Math.PI * 2), Math.sin(catSeed * Math.PI * 2), Math.cos(catSeed * Math.PI * 5)).normalize(),
      catSeed * Math.PI * 2
    );
    const clNodes = fibSphere(items.length).map((lp, idx) => {
      const d = new THREE.Vector3(...lp).applyQuaternion(catRot).multiplyScalar(ATTR_CL_R);
      const pos = [poleCtr.x + d.x, poleCtr.y + d.y, poleCtr.z + d.z];
      const node = {
        name: items[idx].name, label: items[idx].label,
        categoryId: cat.id, color: cat.color,
        poleCenter: [poleCtr.x, poleCtr.y, poleCtr.z],
        position: pos,
      };
      attributeNodes.push(node);
      return node;
    });
    attributeClusters.push({ id: cat.id, label: cat.label, color: cat.color, poleCenter: [poleCtr.x, poleCtr.y, poleCtr.z], nodes: clNodes });
  });

  // 10. Nudge attribute positions toward their subgenre centroid
  nudgeAttributePositions(attributeNodes, attrToSubs, subsByKey);

  // 11. Flat similarity link lists (using refined positions)
  const subSimLinks = [];
  const addedSim = new Set();
  renderPairsBySub.forEach((arr, i) => {
    arr.slice(0, 3).forEach(({ j, score }) => {
      const key = [subgenres[i].name, subgenres[j].name].sort().join("\0");
      if (!addedSim.has(key)) {
        addedSim.add(key);
        subSimLinks.push({
          from: subgenres[i].position, to: subgenres[j].position,
          score, crossFamily: subgenres[i].parent !== subgenres[j].parent,
        });
      }
    });
  });

  const genreSimLinks = [];
  for (let i = 0; i < gNames.length; i++) {
    for (let j = i + 1; j < gNames.length; j++) {
      genreSimLinks.push({
        from: genres[i].position, to: genres[j].position,
        score: simMatrix[gNames[i]][gNames[j]],
        colorA: genres[i].color, colorB: genres[j].color,
      });
    }
  }
  genreSimLinks.sort((a, b) => b.score - a.score);

  return {
    genres, subgenres, microstyles, attributeNodes, attributeClusters,
    attrToSubs, subsByKey, subSimLinks, genreSimLinks, simMatrix,
  };
}

// ── Link computation for different focus types ─────────────────────

// Aggregate attribute signature for a set of subgenres (top-N most common
// values per attribute category).
function aggregateSubsAttrs(subgenres, genreIntuition, topN = 3) {
  const counts = {};
  subgenres.forEach(sub => {
    const gi = genreIntuition[sub.name] || genreIntuition[sub.name.toLowerCase()];
    if (!gi) return;
    ATTR_CATS.forEach(cat => {
      if (!cat.giField) return;
      const key = cat.id;
      if (!counts[key]) counts[key] = {};
      (gi[cat.giField] || []).forEach(val => {
        counts[key][val] = (counts[key][val] || 0) + 1;
      });
    });
  });
  const out = {};
  Object.entries(counts).forEach(([catId, vals]) => {
    out[catId] = Object.entries(vals).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name]) => name);
  });
  return out;
}

function getAttrLinks(focused, layout, data) {
  if (!focused) return [];
  const genreIntuition = data.GENRE_INTUITION || {};
  const links = [];

  if (focused.kind === "subgenre") {
    const gi = genreIntuition[focused.name] || genreIntuition[focused.name.toLowerCase()];
    if (!gi) return [];
    ATTR_CATS.forEach(cat => {
      if (!cat.giField) return;
      (gi[cat.giField] || []).slice(0, 3).forEach(val => {
        const node = layout.attributeNodes.find(n => n.categoryId === cat.id && n.name === val);
        if (node) links.push({ from: focused.position, to: node.position, color: cat.color });
      });
    });
  } else if (focused.kind === "microstyle") {
    // Inherit parent subgenre's attribute lines
    const gi = genreIntuition[focused.parent] || genreIntuition[focused.parent.toLowerCase()];
    if (!gi) return [];
    ATTR_CATS.forEach(cat => {
      if (!cat.giField) return;
      (gi[cat.giField] || []).slice(0, 3).forEach(val => {
        const node = layout.attributeNodes.find(n => n.categoryId === cat.id && n.name === val);
        if (node) links.push({ from: focused.position, to: node.position, color: cat.color });
      });
    });
  } else if (focused.kind === "genre") {
    // Aggregate attributes across all subgenres in this genre
    const subs = layout.subgenres.filter(s => s.parent === focused.name);
    const agg = aggregateSubsAttrs(subs, genreIntuition, 3);
    Object.entries(agg).forEach(([catId, vals]) => {
      const cat = ATTR_CATS.find(c => c.id === catId);
      if (!cat) return;
      vals.forEach(val => {
        const node = layout.attributeNodes.find(n => n.categoryId === catId && n.name === val);
        if (node) links.push({ from: focused.position, to: node.position, color: cat.color });
      });
    });
  } else if (focused.kind === "attribute") {
    // Reverse direction: lines from this attribute to top subgenres using it
    const key = focused.categoryId + ":" + focused.name;
    const subSet = layout.attrToSubs[key];
    if (!subSet) return [];
    const cat = ATTR_CATS.find(c => c.id === focused.categoryId);
    const color = cat ? cat.color : DEFAULT_COLOR;
    let count = 0;
    for (const sKey of subSet) {
      if (count >= 12) break;
      const sub = layout.subsByKey[sKey];
      if (sub) {
        links.push({ from: focused.position, to: sub.position, color, isReverse: true });
        count++;
      }
    }
  }
  return links;
}

// Complement links: when an attribute is focused, show lines to its
// complement pairings in the attribute cloud.
function getComplementLinks(focused, layout, data) {
  if (!focused || focused.kind !== "attribute") return [];
  const cat = ATTR_CATS.find(c => c.id === focused.categoryId);
  if (!cat || !cat.complTable) return [];
  const table = data[cat.complTable] || {};
  const entry = table[focused.name];
  if (!entry) return [];

  const links = [];
  Object.entries(entry).forEach(([field, values]) => {
    if (!Array.isArray(values)) return;
    const targetCatId = COMP_FIELD_TO_CAT[field];
    if (!targetCatId) return;
    const targetCat = ATTR_CATS.find(c => c.id === targetCatId);
    const targetColor = targetCat ? targetCat.color : DEFAULT_COLOR;
    values.slice(0, 3).forEach(val => {
      const node = layout.attributeNodes.find(n => n.categoryId === targetCatId && n.name === val);
      if (node) links.push({ from: focused.position, to: node.position, color: targetColor });
    });
  });
  return links;
}

// ── Focus helpers ────────────────────────────────────────────────────
function subIsHighlighted(sub, focused, attrToSubs) {
  if (!focused) return true;
  if (focused.kind === "genre")      return sub.parent === focused.name;
  if (focused.kind === "subgenre")   return sub.name === focused.name && sub.parent === focused.parent;
  if (focused.kind === "microstyle") return sub.name === focused.parent && sub.parent === focused.grandparent;
  if (focused.kind === "attribute")  return attrToSubs[focused.categoryId + ":" + focused.name]?.has(sub.name + "/" + sub.parent) ?? false;
  return false;
}

// ── 3D Components ─────────────────────────────────────────────────────

function GenreSun({ genre, isFocused, dimmed, onSelect, onHover }) {
  return (
    <group position={genre.position}>
      <mesh
        onClick={e => { e.stopPropagation(); onSelect(); }}
        onPointerOver={e => { e.stopPropagation(); onHover(genre); }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); }}
      >
        <sphereGeometry args={[genre.sunRadius, 32, 32]} />
        <meshStandardMaterial
          color={genre.color} emissive={genre.color}
          emissiveIntensity={isFocused ? 2.6 : (dimmed ? 0.25 : 1.1)}
          toneMapped={false} opacity={dimmed ? 0.4 : 1} transparent={dimmed}
        />
      </mesh>
      <Html center distanceFactor={30} style={{ pointerEvents: "none" }}>
        <div style={{
          color: "#fff", fontSize: isFocused ? 12 : 10,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: isFocused ? 700 : 500, letterSpacing: "0.02em",
          background: isFocused ? "rgba(94,106,210,0.96)" : "rgba(10,10,15,0.78)",
          padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
          transform: "translate(-50%, 18px)", position: "absolute",
          opacity: dimmed ? 0.38 : 1, userSelect: "none",
        }}>{genre.name}</div>
      </Html>
    </group>
  );
}

function GenreSimLines({ links, threshold }) {
  const geo = useMemo(() => {
    const filtered = links.filter(l => l.score >= threshold);
    if (!filtered.length) return null;
    const pos = new Float32Array(filtered.length * 6);
    const col = new Float32Array(filtered.length * 6);
    const cA = new THREE.Color(), cB = new THREE.Color();
    filtered.forEach(({ from, to, colorA, colorB }, i) => {
      pos[i * 6]     = from[0]; pos[i * 6 + 1] = from[1]; pos[i * 6 + 2] = from[2];
      pos[i * 6 + 3] = to[0];   pos[i * 6 + 4] = to[1];   pos[i * 6 + 5] = to[2];
      cA.set(colorA); cB.set(colorB);
      col[i * 6]     = cA.r; col[i * 6 + 1] = cA.g; col[i * 6 + 2] = cA.b;
      col[i * 6 + 3] = cB.r; col[i * 6 + 4] = cB.g; col[i * 6 + 5] = cB.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(col, 3));
    return g;
  }, [links, threshold]);
  if (!geo) return null;
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors transparent opacity={0.32} />
    </lineSegments>
  );
}

function SubgenreSimLines({ links, visible }) {
  const geo = useMemo(() => {
    if (!links.length) return null;
    const pos = new Float32Array(links.length * 6);
    links.forEach(({ from, to }, i) => {
      pos[i * 6]     = from[0]; pos[i * 6 + 1] = from[1]; pos[i * 6 + 2] = from[2];
      pos[i * 6 + 3] = to[0];   pos[i * 6 + 4] = to[1];   pos[i * 6 + 5] = to[2];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [links]);
  if (!visible || !geo) return null;
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#6366F1" transparent opacity={0.16} />
    </lineSegments>
  );
}

function SubgenreField({ subgenres, focused, attrToSubs, onHover, onSelect }) {
  return (
    <Instances limit={Math.max(subgenres.length, 1)} range={subgenres.length}>
      <sphereGeometry args={[PLANET_R, 14, 14]} />
      <meshStandardMaterial emissiveIntensity={0.9} toneMapped={false} />
      {subgenres.map(s => {
        const hi = subIsHighlighted(s, focused, attrToSubs);
        const isF = focused?.kind === "subgenre" && focused.name === s.name && focused.parent === s.parent;
        const dim = focused && !hi;
        const scl = isF ? 1.75 : (hi && focused ? 1.2 : (dim ? 0.35 : 1));
        return (
          <Instance key={s.parent + "/" + s.name} position={s.position} color={s.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(s); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(s); }} />
        );
      })}
    </Instances>
  );
}

function MicrostyleField({ microstyles, focused, onHover, onSelect }) {
  return (
    <Instances limit={Math.max(microstyles.length, 1)} range={microstyles.length}>
      <sphereGeometry args={[MOON_R, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.7} toneMapped={false} />
      {microstyles.map(m => {
        const isF = focused?.kind === "microstyle" && focused.name === m.name && focused.parent === m.parent && focused.grandparent === m.grandparent;
        const inSub = focused?.kind === "subgenre" && focused.name === m.parent && focused.parent === m.grandparent;
        const inGenre = focused?.kind === "genre" && focused.name === m.grandparent;
        const dim = focused && !(isF || inSub || inGenre);
        const scl = isF ? 2.4 : (inSub ? 1.35 : (dim ? 0.3 : 1));
        return (
          <Instance key={m.grandparent + "/" + m.parent + "/" + m.name} position={m.position} color={m.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(m); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(m); }} />
        );
      })}
    </Instances>
  );
}

function AttributeCloudField({ attributeNodes, focused, attrToSubs, onHover, onSelect }) {
  return (
    <Instances limit={Math.max(attributeNodes.length, 1)} range={attributeNodes.length}>
      <sphereGeometry args={[ATTR_R, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.85} toneMapped={false} />
      {attributeNodes.map(n => {
        const isF = focused?.kind === "attribute" && focused.name === n.name && focused.categoryId === n.categoryId;
        // Linked: this attribute is in the focused node's attribute list
        const linked =
          (focused?.kind === "subgenre" && (attrToSubs[n.categoryId + ":" + n.name]?.has(focused.name + "/" + focused.parent) ?? false));
        const dim = focused && !isF && !linked;
        const scl = isF ? 2.2 : (linked ? 1.35 : (dim ? 0.38 : 1));
        return (
          <Instance key={n.categoryId + ":" + n.name} position={n.position} color={n.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(n); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(n); }} />
        );
      })}
    </Instances>
  );
}

function AttributeClusterLabels({ clusters }) {
  return (
    <>
      {clusters.map(c => (
        <Html key={c.id} position={c.poleCenter} center distanceFactor={60} style={{ pointerEvents: "none" }}>
          <div style={{
            color: c.color, fontSize: 9, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            background: "rgba(10,10,15,0.85)", padding: "2px 6px", borderRadius: 3,
            whiteSpace: "nowrap", userSelect: "none", border: `1px solid ${c.color}44`,
          }}>{c.label}</div>
        </Html>
      ))}
    </>
  );
}

function AttributeLinesMesh({ lines, visible }) {
  if (!visible || !lines.length) return null;
  return (
    <>
      {lines.map((l, i) => (
        <Line key={i} points={[l.from, l.to]} color={l.color} lineWidth={1.5}
              transparent opacity={l.isReverse ? 0.5 : 0.65} />
      ))}
    </>
  );
}

function ComplementLinesMesh({ lines, visible }) {
  if (!visible || !lines.length) return null;
  return (
    <>
      {lines.map((l, i) => (
        <Line key={i} points={[l.from, l.to]} color={l.color} lineWidth={1.2}
              transparent opacity={0.55} dashed dashSize={0.4} gapSize={0.2} />
      ))}
    </>
  );
}

function AncestryLines({ focused, layout, visible }) {
  const segs = useMemo(() => {
    if (!focused || !visible) return [];
    const s = [];
    if (focused.kind === "subgenre") {
      const g = layout.genres.find(x => x.name === focused.parent);
      const sub = layout.subgenres.find(x => x.name === focused.name && x.parent === focused.parent);
      if (g && sub) s.push({ from: g.position, to: sub.position, color: sub.color });
    } else if (focused.kind === "microstyle") {
      const g = layout.genres.find(x => x.name === focused.grandparent);
      const sub = layout.subgenres.find(x => x.name === focused.parent && x.parent === focused.grandparent);
      const micro = layout.microstyles.find(m => m.name === focused.name && m.parent === focused.parent && m.grandparent === focused.grandparent);
      if (g && sub) s.push({ from: g.position, to: sub.position, color: sub.color });
      if (sub && micro) s.push({ from: sub.position, to: micro.position, color: micro.color });
    }
    return s;
  }, [focused, layout, visible]);
  return (
    <>
      {segs.map((seg, i) => (
        <Line key={i} points={[seg.from, seg.to]} color={seg.color} lineWidth={2.5} transparent opacity={0.9} />
      ))}
    </>
  );
}

function HoverTooltip({ hovered }) {
  if (!hovered) return null;
  return (
    <Html position={hovered.position} center distanceFactor={20} style={{ pointerEvents: "none" }}>
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

function CameraRig({ focusTarget, controlsRef }) {
  const { camera } = useThree();
  const animating = useRef(false);
  const destPos = useRef(new THREE.Vector3(0, 8, 90));
  const destTgt = useRef(new THREE.Vector3());

  useEffect(() => {
    if (!focusTarget) { animating.current = false; return; }
    const t = new THREE.Vector3(...focusTarget.position);
    destTgt.current.copy(t);
    const dist = focusTarget.kind === "genre" ? 9 : focusTarget.kind === "subgenre" ? 5 : focusTarget.kind === "microstyle" ? 3 : 7;
    destPos.current.copy(t.clone().add(t.clone().normalize().multiplyScalar(dist)));
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

function Toggle({ on, onChange, label, color, disabled, indent }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "4px 10px", paddingLeft: indent ? 22 : 10,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1, userSelect: "none", borderRadius: 4,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: on ? color : "transparent", border: `1.5px solid ${color}` }} />
      <span style={{ fontSize: 12, fontFamily: T.fontMono, color: T.text }}>{label}</span>
    </div>
  );
}

function LayerPanel({ layers, links, setLayers, setLinks, threshold, setThreshold }) {
  const sectionStyle = { padding: "4px 10px 4px", fontSize: 9, letterSpacing: ".14em", color: T.textMuted, textTransform: "uppercase", borderBottom: `1px solid ${T.borderHi}`, marginBottom: 2, fontFamily: T.fontMono };
  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      background: "rgba(10,10,15,0.92)", border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md, padding: "6px 0", minWidth: 204, zIndex: 10,
    }}>
      <div style={sectionStyle}>layers</div>
      <Toggle on label="Genres" color="#A78BFA" disabled />
      <Toggle on={layers.subgenres}   label="Subgenres"       color="#60A5FA" onChange={v => setLayers(l => ({ ...l, subgenres: v, microstyles: !v ? false : l.microstyles }))} />
      <Toggle on={layers.microstyles} label="Microstyles"     color="#F472B6" disabled={!layers.subgenres} indent onChange={v => setLayers(l => ({ ...l, microstyles: v }))} />
      <Toggle on={layers.attributes}  label="Attribute cloud" color="#2DD4BF" onChange={v => setLayers(l => ({ ...l, attributes: v }))} />

      <div style={{ height: 6 }} />
      <div style={sectionStyle}>links</div>
      <Toggle on={links.all} label="All links" color="#E879F9" onChange={v => setLinks(l => ({ ...l, all: v }))} />
      <div style={{ opacity: links.all ? 1 : 0.3, pointerEvents: links.all ? "auto" : "none" }}>
        <Toggle on={links.genre}     label="Genre similarity"    color="#6366F1" disabled={!links.all} indent onChange={v => setLinks(l => ({ ...l, genre: v }))} />
        <Toggle on={links.sub}       label="Subgenre similarity" color="#818CF8" disabled={!links.all} indent onChange={v => setLinks(l => ({ ...l, sub: v }))} />
        <Toggle on={links.attrs}     label="Attribute links"     color="#F9A8D4" disabled={!links.all} indent onChange={v => setLinks(l => ({ ...l, attrs: v }))} />
        <Toggle on={links.compl}     label="Complement pairs"    color="#FCD34D" disabled={!links.all} indent onChange={v => setLinks(l => ({ ...l, compl: v }))} />
        <Toggle on={links.ancestry}  label="Ancestry"            color="#94A3B8" disabled={!links.all} indent onChange={v => setLinks(l => ({ ...l, ancestry: v }))} />
      </div>

      {links.all && links.genre && (
        <div style={{ padding: "6px 10px 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.textMuted, fontFamily: T.fontMono }}>min similarity</span>
            <span style={{ fontSize: 10, color: T.textSec, fontFamily: T.fontMono }}>{Math.round(threshold * 100)}%</span>
          </div>
          <input type="range" min={0.25} max={0.78} step={0.01} value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#6366F1" }} />
        </div>
      )}
    </div>
  );
}

function FocusHUD({ focused, layout, data, onClear }) {
  if (!focused) return (
    <div style={{
      position: "absolute", bottom: 16, left: 16, fontSize: 10,
      color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.65)", padding: "6px 10px",
      borderRadius: T.r_sm, userSelect: "none", zIndex: 10,
    }}>drag · scroll · click a node</div>
  );

  let kindLabel, crumbs;
  if      (focused.kind === "genre")      { kindLabel = "Genre";      crumbs = [focused.name]; }
  else if (focused.kind === "subgenre")   { kindLabel = "Subgenre";   crumbs = [focused.parent, focused.name]; }
  else if (focused.kind === "microstyle") { kindLabel = "Microstyle"; crumbs = [focused.grandparent, focused.parent, focused.name]; }
  else                                    { const cat = ATTR_CATS.find(c => c.id === focused.categoryId); kindLabel = cat ? cat.label : focused.categoryId; crumbs = [focused.label || focused.name]; }

  const genre = focused.kind === "genre" ? layout.genres.find(g => g.name === focused.name) : null;
  const attrSubCount = focused.kind === "attribute"
    ? (layout.attrToSubs[focused.categoryId + ":" + focused.name]?.size ?? 0) : null;

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16,
      background: "rgba(10,10,15,0.93)", border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md, padding: "10px 14px", maxWidth: 340,
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
      {genre && (
        <div style={{ borderTop: `1px solid ${T.borderHi}`, paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: ".1em", marginBottom: 5 }}>MOST SIMILAR TO</div>
          {genre.topSimilar.slice(0, 4).map(s => (
            <div key={s.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: T.textSec }}>{s.name}</span>
              <span style={{ fontSize: 11, color: GENRE_COLORS[s.name] || DEFAULT_COLOR, fontWeight: 600 }}>{Math.round(s.score * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      {attrSubCount !== null && (
        <div style={{ borderTop: `1px solid ${T.borderHi}`, paddingTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: ".1em", marginBottom: 3 }}>USED BY</div>
          <div style={{ fontSize: 11, color: T.textSec }}>{attrSubCount} subgenres</div>
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
      <div>{layout.genres.length} genres · {layout.subgenres.length} sub · {layout.microstyles.length} micro</div>
      <div>{layout.attributeNodes.length} attr nodes · {layout.subSimLinks.length} sub sim · {layout.genreSimLinks.length} genre sim</div>
    </div>
  );
}

// ── Top-level export ──────────────────────────────────────────────────

export default function GenreMap3D({ data }) {
  const layout         = useMemo(() => buildLayout(data || {}), [data]);
  const genreIntuition = useMemo(() => (data || {}).GENRE_INTUITION || {}, [data]);

  const [layers,    setLayers]    = useState({ subgenres: false, microstyles: false, attributes: true });
  const [links,     setLinks]     = useState({ all: true, genre: true, sub: true, attrs: true, compl: true, ancestry: true });
  const [threshold, setThreshold] = useState(0.55);
  const [focused,   setFocused]   = useState(null);
  const [hovered,   setHovered]   = useState(null);
  const controlsRef = useRef();

  const attrLines = useMemo(() =>
    (links.all && links.attrs) ? getAttrLinks(focused, layout, data || {}) : [],
    [focused, layout, data, links.all, links.attrs]
  );

  const complLines = useMemo(() =>
    (links.all && links.compl && layers.attributes) ? getComplementLinks(focused, layout, data || {}) : [],
    [focused, layout, data, links.all, links.compl, layers.attributes]
  );

  const sel = (f) => setFocused(f);
  const selectGenre = g => sel({ kind: "genre",      name: g.name, position: g.position });
  const selectSub   = s => sel({ kind: "subgenre",   name: s.name, parent: s.parent, position: s.position });
  const selectMicro = m => sel({ kind: "microstyle", name: m.name, parent: m.parent, grandparent: m.grandparent, position: m.position });
  const selectAttr  = n => sel({ kind: "attribute",  name: n.name, label: n.label, categoryId: n.categoryId, position: n.position });

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 80px)", minHeight: 500, background: "#04040B", overflow: "hidden" }}>
      <Canvas camera={{ position: [0, 8, 95], fov: 52, near: 0.1, far: 600 }} dpr={[1, 2]} onPointerMissed={() => setFocused(null)}>
        <color attach="background" args={["#04040B"]} />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 0]} intensity={0.7} distance={250} />

        <Suspense fallback={null}>
          <Stars radius={250} depth={80} count={2000} factor={4} saturation={0} fade speed={0.2} />

          {links.all && links.genre && (
            <GenreSimLines links={layout.genreSimLinks} threshold={threshold} />
          )}

          {layout.genres.map(g => {
            const dimmed = !!focused && !(
              (focused.kind === "genre"       && focused.name === g.name) ||
              (focused.kind === "subgenre"    && focused.parent === g.name) ||
              (focused.kind === "microstyle"  && focused.grandparent === g.name) ||
              (focused.kind === "attribute"   && [...(layout.attrToSubs[focused.categoryId + ":" + focused.name] || new Set())].some(k => k.endsWith("/" + g.name)))
            );
            return (
              <GenreSun key={g.name} genre={g}
                isFocused={focused?.kind === "genre" && focused.name === g.name}
                dimmed={dimmed}
                onSelect={() => selectGenre(g)}
                onHover={setHovered}
              />
            );
          })}

          {layers.subgenres && (
            <SubgenreField subgenres={layout.subgenres} focused={focused} attrToSubs={layout.attrToSubs} onHover={setHovered} onSelect={selectSub} />
          )}
          {layers.subgenres && layers.microstyles && (
            <MicrostyleField microstyles={layout.microstyles} focused={focused} onHover={setHovered} onSelect={selectMicro} />
          )}

          {layers.attributes && (
            <>
              <AttributeCloudField attributeNodes={layout.attributeNodes} focused={focused} attrToSubs={layout.attrToSubs} onHover={setHovered} onSelect={selectAttr} />
              <AttributeClusterLabels clusters={layout.attributeClusters} />
            </>
          )}

          {links.all && links.sub && layers.subgenres && <SubgenreSimLines links={layout.subSimLinks} visible />}
          {links.all && links.attrs && <AttributeLinesMesh lines={attrLines} visible />}
          {links.all && links.compl && layers.attributes && <ComplementLinesMesh lines={complLines} visible />}
          {links.all && links.ancestry && <AncestryLines focused={focused} layout={layout} visible />}

          <HoverTooltip hovered={hovered} />
        </Suspense>

        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.07} minDistance={2} maxDistance={180} rotateSpeed={0.55} zoomSpeed={0.9} panSpeed={0.6} />
        <CameraRig focusTarget={focused} controlsRef={controlsRef} />
      </Canvas>

      <LayerPanel layers={layers} links={links} setLayers={setLayers} setLinks={setLinks} threshold={threshold} setThreshold={setThreshold} />
      <StatsBadge layout={layout} />
      <FocusHUD focused={focused} layout={layout} data={data || {}} onClear={() => setFocused(null)} />
    </div>
  );
}
