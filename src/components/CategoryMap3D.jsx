import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instances, Instance, Stars, Line, Segments, Segment } from "@react-three/drei";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
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
const MID_R      = 0.48;
const SMALL_R    = 0.2;
const ATTR_R     = 0.32;
const MID_ORBIT  = 5.0;
const SMALL_ORBIT= 4.2;    // was 2.8 — micros float clearly away from parent
                           // sub, no more crowding

// Default size multipliers — applied on top of every tier's base radius.
// The customization slider still reads "1.0×" at its default position,
// but visually the note is this much bigger. Keeps the UI familiar
// while making the default view more readable.
const BIG_MULT   = 1.4;
const MID_MULT   = 1.4;
const SMALL_MULT = 1.6;
const ATTR_MULT  = 1.6;

// ── Musical note geometry (compound: body + stem + cap + flag) ─────
// Ported and simplified from the MusicPlanet design. Each part has a
// scalar vertex "tint" baked in (body=1.0 brightest, stem=0.35 darkest,
// flag=0.8, etc.) — when the material has `vertexColors: true`, these
// tints multiply with the instance color so a red genre gets a vivid
// red body with dark-red stem & flag, blue gets blue/dark-blue, etc.
// The decorative ring is included only in the big-tier geometry — rings
// would visually clash at sub/micro density.

// Merge N non-indexed BufferGeometries into one, preserving the
// position / normal / color attributes.
function mergeGeos(geoms) {
  const nonIdx = geoms.map(g => g.index ? g.toNonIndexed() : g);
  const hasColor = nonIdx.every(g => g.getAttribute("color"));
  let total = 0;
  for (const g of nonIdx) total += g.getAttribute("position").count;

  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = hasColor ? new Float32Array(total * 3) : null;
  let off = 0;
  for (const g of nonIdx) {
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    pos.set(p.array, off * 3);
    nrm.set(n.array, off * 3);
    if (hasColor) col.set(g.getAttribute("color").array, off * 3);
    off += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  if (hasColor) merged.setAttribute("color", new THREE.BufferAttribute(col, 3));
  merged.computeBoundingSphere();
  return merged;
}

// Duplicate a geometry's vertices (force non-indexed) and paint every vertex
// with the same grey tint value. When the material has `vertexColors: true`,
// this tint multiplies with the instance color.
function withTint(geom, tint) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  const n = g.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i*3] = tint; colors[i*3+1] = tint; colors[i*3+2] = tint;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

// Like withTint, but paints the sphere body with 4 latitude bands of
// differing brightness — reproduces the "gas-giant" striping effect from
// the MusicPlanet palette (light top, medium, dark-medium, dark bottom).
// A gentle longitudinal sine wave makes the band edges feel organic
// instead of perfectly horizontal.
function bandedBody(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  const pos = g.getAttribute("position");
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  // 16 stops with irregular values — creates visible bright/dark bands
  // rather than a smooth top-to-bottom gradient. Linear interp (not
  // smoothstep) keeps band edges defined. Values >1.0 push brightest
  // latitudes to HDR for the "atmospheric haze" look on gas giants.
  const stops = [
    0.08, 0.12, 0.22, 0.18,   // south pole: very dark with hint of variation
    0.42, 0.28, 0.58, 0.40,   // lower mid: alternating dark/bright stripes
    0.75, 1.25, 0.95, 1.10,   // bright belt (peak brightness ~north mid)
    0.72, 0.92, 0.55, 0.30,   // top fade — not fully dark, gives the pole a lit dome feel
  ];
  const nStops = stops.length - 1;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const lat = (y + 1) * 0.5;
    // Stronger two-octave wave for more organic band wobble
    const wave =
      Math.sin(x * 3.5 + z * 2.8) * 0.055 +
      Math.cos(x * 6.8 - z * 5.1) * 0.022;
    const t = Math.max(0, Math.min(0.9999, lat + wave));
    const p = t * nStops;
    const i0 = Math.floor(p);
    const i1 = Math.min(i0 + 1, nStops);
    const f = p - i0;
    // Linear interp — preserves visible band edges (smoothstep washed them out).
    const tint = stops[i0] * (1 - f) + stops[i1] * f;
    colors[i*3] = tint; colors[i*3+1] = tint; colors[i*3+2] = tint;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

// Magma variant — wider HDR range (0.05 nearly-black → 1.70 pushing bloom)
// combined with a stronger, three-octave noise for "convection cell" feel.
// Used only on the 18 big genre nodes, where a shader hook modulates the
// emissive by these same vertex colors so dark bands read as cooler crust
// and the bright seams blaze like magma pouring through. The result: you
// can actually see the curvature and surface structure, instead of a flat
// colored ball (which was the user's complaint with the previous material).
function bandedBodyMagma(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  const pos = g.getAttribute("position");
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const stops = [
    0.05, 0.09, 0.16, 0.12,   // crust (south): near-black
    0.34, 0.20, 0.50, 0.28,   // cooling zone (lower mid)
    0.95, 1.70, 1.30, 1.55,   // MAGMA belt — HDR hot seams
    0.80, 1.05, 0.48, 0.20,   // crust (north fade)
  ];
  const nStops = stops.length - 1;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const lat = (y + 1) * 0.5;
    // Three-octave wave: big warp + medium wobble + fine grain. The fine
    // grain makes the bright bands look like turbulent plasma rather than
    // smooth stripes.
    const wave =
      Math.sin(x * 3.2 + z * 2.6) * 0.075 +
      Math.cos(x * 6.2 - z * 4.8) * 0.030 +
      Math.sin(x * 11.5 + z * 9.0) * 0.012;
    const t = Math.max(0, Math.min(0.9999, lat + wave));
    const p = t * nStops;
    const i0 = Math.floor(p);
    const i1 = Math.min(i0 + 1, nStops);
    const f = p - i0;
    const tint = stops[i0] * (1 - f) + stops[i1] * f;
    colors[i*3] = tint; colors[i*3+1] = tint; colors[i*3+2] = tint;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function makeNoteGeometry({ withRing = false, detail = "med", magma = false } = {}) {
  const parts = [];
  const segW = detail === "hi" ? 32 : 24;
  const segH = detail === "hi" ? 22 : 16;

  // Body — the "planet" sphere. Magma bands for bigs (more extreme range
  // so the shader-driven emissive modulation has material to work with);
  // the standard atmospheric band for mids/smalls/attrs.
  const body = new THREE.SphereGeometry(1.0, segW, segH);
  parts.push(magma ? bandedBodyMagma(body) : bandedBody(body));

  // Optional decorative ring (bigs only — too busy on dense tiers).
  if (withRing) {
    const ring = new THREE.TorusGeometry(1.55, 0.12, 6, detail === "hi" ? 40 : 24);
    ring.scale(1, 1, 0.1);
    ring.rotateX(Math.PI / 2 - 0.38);
    ring.rotateZ(0.22);
    parts.push(withTint(ring, 0.85));
  }

  // Stem — shorter than the MusicPlanet original (1.6 vs 2.6) so that
  // vertically-stacked notes don't clobber each other when packed tightly.
  const stemR = 0.13;
  const stemH = 1.6;
  const stemX = 0.72;
  const stemY = stemH / 2 + 0.45;
  const stem = new THREE.CylinderGeometry(stemR * 0.8, stemR, stemH, detail === "hi" ? 12 : 8);
  stem.translate(stemX, stemY, 0);
  parts.push(withTint(stem, 0.38));

  // Cap at the top of the stem.
  const cap = new THREE.SphereGeometry(stemR * 1.25, 8, 6);
  cap.translate(stemX, stemY + stemH / 2, 0);
  parts.push(withTint(cap, 0.55));

  // Flag — curved bezier tail hanging off the stem top. Scaled down
  // from the MusicPlanet source so it fits the shorter stem.
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.72, -0.02, 1.10, -0.48, 0.96, -1.10);
  s.bezierCurveTo(0.86, -1.48, 0.52, -1.62, 0.15, -1.68);
  s.bezierCurveTo(0.58, -1.40, 0.70, -1.00, 0.57, -0.65);
  s.bezierCurveTo(0.40, -0.30, 0.18, -0.11, 0, 0);
  s.lineTo(0, 0);
  const flag = new THREE.ExtrudeGeometry(s, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.035, bevelSize: 0.035,
    bevelSegments: detail === "hi" ? 3 : 1,
    curveSegments: detail === "hi" ? 8 : 6,
  });
  flag.translate(stemX + stemR * 0.4, stemY + stemH / 2 - 0.04, -0.075);
  flag.computeVertexNormals();
  parts.push(withTint(flag, 0.8));

  return mergeGeos(parts);
}

// Hi-detail compound WITH the tilted ring AND magma-range banding — used
// only for the 18 big genre nodes. The magma body pairs with a shader
// modulation on the material (see BigNoteNode) to make the sphere look
// like a tiny sun instead of a flat colored ball.
const BIG_NOTE_GEOM = makeNoteGeometry({ withRing: true, detail: "hi", magma: true });
// Medium-detail compound WITHOUT the ring — used for every other tier
// (mids / smalls / attrs), where we might be drawing 1500+ instances.
const NOTE_GEOM     = makeNoteGeometry({ withRing: false, detail: "med" });

// Polished, softly-glowing instanced material. Uses a uniform emissive
// level (not per-instance) for reliability — shader modifications via
// onBeforeCompile are fragile and can silently fail across devices.
// The per-instance color still comes through via instance color ×
// vertex tint, which gives each note a vivid, individualized look.
function buildGlowyInstancedMaterial({ metalness = 0.4, roughness = 0.4, emissive = 0x444444 } = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness, roughness,
    emissive,
    emissiveIntensity: 0.55,
    toneMapped: false,
  });
}

const MAT_MID   = buildGlowyInstancedMaterial({ metalness: 0.42, roughness: 0.38, emissive: 0x4a4a4a });
const MAT_SMALL = buildGlowyInstancedMaterial({ metalness: 0.38, roughness: 0.42, emissive: 0x3e3e3e });
const MAT_ATTR  = buildGlowyInstancedMaterial({ metalness: 0.38, roughness: 0.40, emissive: 0x484848 });

// ── Glow halo ─────────────────────────────────────────────────────
// Real-looking bloom: a canvas-generated radial gradient texture rendered
// as camera-facing billboards (THREE.Points). Soft alpha falloff means no
// hard silhouette, additive blending lets colors stack on overlap, and
// sizeAttenuation keeps the glow a consistent world-space size. Much
// closer to genuine bloom than a transparent sphere ever gets.
const GLOW_TEX = (() => {
  const size = 128;
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (!canvas) return null;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  // Corona-style falloff: hot core that stays bright longer, then a
  // slow fade into space. The previous curve dropped to 38% alpha by
  // r=0.20, which read as a tight halo — this version keeps meaningful
  // brightness out to r=0.55 so the aura extends several body-widths
  // past the sphere before dissolving.
  grad.addColorStop(0.00, "rgba(255,255,255,0.98)");
  grad.addColorStop(0.10, "rgba(255,255,255,0.82)");
  grad.addColorStop(0.22, "rgba(255,255,255,0.58)");
  grad.addColorStop(0.38, "rgba(255,255,255,0.34)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.18)");
  grad.addColorStop(0.75, "rgba(255,255,255,0.07)");
  grad.addColorStop(1.00, "rgba(255,255,255,0.00)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
})();

// Halo sizes in world units. Big genre nodes get a much bigger corona
// than the other tiers — these are the hubs of the universe and should
// feel like small suns, not tight dots. Mids/smalls/attrs stay modest
// so the view doesn't turn into a blur of overlapping halos.
const GLOW_SIZE_BIG   = 24.0;
const GLOW_SIZE_MID   = 6.5;
const GLOW_SIZE_SMALL = 3.2;
const GLOW_SIZE_ATTR  = 4.8;

function buildGlowMaterial(size) {
  const mat = new THREE.PointsMaterial({
    size,
    map: GLOW_TEX,
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: true,
    toneMapped: false,
  });
  // Per-instance size multiplier via a custom vertex attribute (aSize).
  // Default = 1.0 for each point; tiers update this per frame so a focused
  // note's halo grows and a dimmed note's halo shrinks in step with its body.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float aSize;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "gl_PointSize = size;",
      "gl_PointSize = size * aSize;"
    );
  };
  return mat;
}
const MAT_GLOW_MID   = buildGlowMaterial(GLOW_SIZE_MID);
const MAT_GLOW_SMALL = buildGlowMaterial(GLOW_SIZE_SMALL);
const MAT_GLOW_ATTR  = buildGlowMaterial(GLOW_SIZE_ATTR);

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

// Stable identity keys for filter Sets (need to distinguish same-named items
// across different parents). A microstyle called "Boom Bap" can exist under
// multiple subs in theory, so the triple is what uniquely identifies it.
const smallKey = (s) => `${s.grandparent}/${s.parent}/${s.name}`;
const attrKey  = (a) => `${a.categoryId}:${a.name}`;

// Averages two CSS-style colors into a single hex (#rrggbb). Uses THREE
// so any format that THREE.Color accepts (hex, 'rgb()', named) works.
// Cached by "a|b" key — a single edge-build pass blends the same color
// pairs hundreds of times (e.g. every small under the same big shares a
// pair), so the memoized lookup saves the Color allocations.
const BLEND_CACHE = new Map();
function blendHex(a, b) {
  const A = a || "#5E6AD2";
  const B = b || A;
  const key = A + "|" + B;
  const cached = BLEND_CACHE.get(key);
  if (cached) return cached;
  const c = new THREE.Color(A).lerp(new THREE.Color(B), 0.5);
  const out = "#" + c.getHexString();
  BLEND_CACHE.set(key, out);
  return out;
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

// ── Shared: decluster (anti-clipping) ──────────────────────────────
// Pairwise repulsion pass. If two nodes end up closer than `minDist`,
// push them apart along the line between them until they're at `minDist`.
// Runs for at most `iterations` passes, stopping early if nothing moves.
// O(n²) per iteration — fine for n up to ~1500. For bigger sets we'd
// need spatial hashing, but we don't have any at that scale here.
function declusterTier(nodes, minDist, iterations = 15) {
  if (!nodes.length || minDist <= 0) return;
  const minSq = minDist * minDist;
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i].pos;
      if (!a) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j].pos;
        if (!b) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const distSq = dx*dx + dy*dy + dz*dz;
        if (distSq < minSq && distSq > 1e-9) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist) * 0.5;
          const ux = dx / dist, uy = dy / dist, uz = dz / dist;
          a[0] -= ux * push; a[1] -= uy * push; a[2] -= uz * push;
          b[0] += ux * push; b[1] += uy * push; b[2] += uz * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
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
      edges.push({ from: gi_, to: si, kind: "tree", strength: 2.6, ideal: 11.0 });
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
  // Anti-clipping passes so no two nodes sit inside each other.
  declusterTier(mids, MID_R * 2 * MID_MULT + 0.4, 15);
  declusterTier(attributes, ATTR_R * 2 * ATTR_MULT + 0.25, 10);
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
  declusterTier(smalls, SMALL_R * 2 * SMALL_MULT + 0.15, 8);

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
  declusterTier(mids, MID_R * 2 * MID_MULT + 0.4, 15);

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
  declusterTier(smalls, SMALL_R * 2 * SMALL_MULT + 0.15, 8);

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
  declusterTier(mids, MID_R * 2 * MID_MULT + 0.4, 15);
  declusterTier(attributes, ATTR_R * 2 * ATTR_MULT + 0.25, 10);

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
  declusterTier(mids, MID_R * 2 * MID_MULT + 0.4, 15);
  declusterTier(attributes, ATTR_R * 2 * ATTR_MULT + 0.25, 10);

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

  // Wrap focused node with kind field so it's symmetric with target nodes.
  const F = { ...focused, kind: focused.kind };

  if (focused.kind === "big") {
    layout.mids.filter(s => s.parent === focused.name).forEach(s => {
      lines.push({
        from: focused.pos, to: s.pos,
        color: blendHex(focused.color, s.color), kind: "tree",
        fromNode: F, toNode: { ...s, kind: "mid" },
      });
    });
    if (layout.hasAttrs) {
      (layout.bigAttrEdges(focused) || []).forEach(({ node, cat }) => {
        lines.push({
          from: focused.pos, to: node.pos,
          color: blendHex(focused.color, cat.color), kind: "attr",
          fromNode: F, toNode: { ...node, kind: "attribute" },
        });
      });
    }
  } else if (focused.kind === "mid") {
    const parent = layout.bigByName[focused.parent];
    if (parent) lines.push({
      from: parent.pos, to: focused.pos,
      color: blendHex(parent.color, focused.color), kind: "tree",
      fromNode: { ...parent, kind: "big" }, toNode: F,
    });
    if (layout.hasSmalls) {
      layout.smalls.filter(m => m.parent === focused.name && m.grandparent === focused.parent).forEach(m => {
        lines.push({
          from: focused.pos, to: m.pos,
          color: blendHex(focused.color, m.color), kind: "tree",
          fromNode: F, toNode: { ...m, kind: "small" },
        });
      });
    }
    if (layout.hasAttrs) {
      (layout.midToAttrs(focused) || []).forEach(({ node, cat }) => {
        lines.push({
          from: focused.pos, to: node.pos,
          color: blendHex(focused.color, cat.color), kind: "attr",
          fromNode: F, toNode: { ...node, kind: "attribute" },
        });
      });
    }
  } else if (focused.kind === "small") {
    const parent = layout.midsByKey[focused.parent + "/" + focused.grandparent];
    if (parent) lines.push({
      from: parent.pos, to: focused.pos,
      color: blendHex(parent.color, focused.color), kind: "tree",
      fromNode: { ...parent, kind: "mid" }, toNode: F,
    });
    if (layout.hasAttrs && parent) {
      (layout.midToAttrs(parent) || []).slice(0, 3).forEach(({ node, cat }) => {
        lines.push({
          from: focused.pos, to: node.pos,
          color: blendHex(focused.color, cat.color), kind: "attr",
          fromNode: F, toNode: { ...node, kind: "attribute" },
        });
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
            if (node) lines.push({
              from: focused.pos, to: node.pos,
              color: blendHex(focused.color, node.color), kind: "compl",
              fromNode: F, toNode: { ...node, kind: "attribute" },
            });
          });
        });
      }
    }
    (layout.attrToMids(focused, 15) || []).forEach(s => {
      lines.push({
        from: focused.pos, to: s.pos,
        color: blendHex(focused.color, s.color), kind: "attr",
        fromNode: F, toNode: { ...s, kind: "mid" },
      });
    });
  }
  return lines;
}

// Relatedness helpers for dim/highlight
function isMidRelated(mid, focused, relatedMidSet) {
  if (!focused) return true;
  if (focused.kind === "big") return mid.parent === focused.name;
  if (focused.kind === "mid") return mid.name === focused.name && mid.parent === focused.parent;
  if (focused.kind === "small") return mid.name === focused.parent && mid.parent === focused.grandparent;
  if (focused.kind === "attribute") return relatedMidSet ? relatedMidSet.has(`${mid.parent}/${mid.name}`) : false;
  return false;
}

function isAttrRelated(attr, focused, relatedAttrSet) {
  if (!focused) return true;
  if (focused.kind === "attribute") return focused.name === attr.name && focused.categoryId === attr.categoryId;
  return relatedAttrSet ? relatedAttrSet.has(`${attr.categoryId}:${attr.name}`) : false;
}

// ── 3D Components ──────────────────────────────────────────────────

// One rotating note for a big (genre hub). Kept as its own component so
// each big has its own ref + useFrame spinning loop. Label sits OUTSIDE
// the rotating group so text stays horizontal while the note turns.
function BigNoteNode({ b, focused, sizeMult, onSelect, onHover, onCopy }) {
  const spinRef = useRef();
  const sp = useMemo(() => {
    const s = hash01(b.name + "/spin");
    return { speed: 0.08 + s * 0.18, phase: s * Math.PI * 2 };
  }, [b.name]);
  useFrame((_, dt) => {
    if (spinRef.current) spinRef.current.rotation.y += dt * sp.speed;
  });

  const isF = focused?.kind === "big" && focused.name === b.name;
  const related =
    (focused?.kind === "mid"   && focused.parent === b.name) ||
    (focused?.kind === "small" && focused.grandparent === b.name);
  const dim = focused && !isF && !related;

  // Magma material — built once per big (color is per-genre). The shader
  // hook multiplies emissive radiance by a function of vColor.r (the band
  // tint we wrote into the geometry), so dark latitudes barely glow while
  // the bright bands push hard into HDR. Without this, a high uniform
  // emissiveIntensity washes the banding flat (which was the complaint).
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: b.color,
      emissive: b.color,
      emissiveIntensity: 1.0,
      metalness: 0.35,
      roughness: 0.42,
      vertexColors: true,
      toneMapped: false,
    });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         totalEmissiveRadiance *= (0.22 + vColor.r * 1.35);`
      );
    };
    return m;
  }, [b.color]);

  // Keep emissiveIntensity reactive to focus/dim state without rebuilding
  // the material (which would re-compile the shader).
  useEffect(() => {
    material.emissiveIntensity = isF ? 1.8 : (dim ? 0.35 : 1.0);
  }, [material, isF, dim]);

  // Dispose the per-node material when the component unmounts (category
  // switch, filter rebuild, etc). Geometry is shared and never disposed.
  useEffect(() => () => { material.dispose(); }, [material]);

  return (
    <group position={b.pos} scale={sizeMult * BIG_R * BIG_MULT}>
      <group ref={spinRef} rotation={[0, sp.phase, 0]}>
        <mesh
          onClick={e => { e.stopPropagation(); onSelect(b); }}
          onContextMenu={e => { e.stopPropagation(); onCopy?.(b.name); }}
          onPointerOver={e => { e.stopPropagation(); onHover(b); }}
          onPointerOut={e => { e.stopPropagation(); onHover(null); }}
        >
          <primitive object={BIG_NOTE_GEOM} attach="geometry" />
          <primitive object={material} attach="material" />
        </mesh>
        {/* Glow — camera-facing billboard with gradient texture,
            creates a soft bloom-like halo. */}
        <points raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([0, 0, 0]), 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[new Float32Array([
                new THREE.Color(b.color).r,
                new THREE.Color(b.color).g,
                new THREE.Color(b.color).b,
              ]), 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={isF ? GLOW_SIZE_BIG * 1.7 : GLOW_SIZE_BIG}
            map={GLOW_TEX}
            vertexColors
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
            toneMapped={false}
            opacity={isF ? 1.0 : (dim ? 0.28 : 0.85)}
          />
        </points>
      </group>
    </group>
  );
}

function BigNodes({ bigs, focused, layout, onSelect, onHover, onCopy, sizeMult = 1 }) {
  return (
    <>
      {bigs.map(b => (
        <BigNoteNode key={b.name} b={b} focused={focused}
          sizeMult={sizeMult}
          onSelect={onSelect} onHover={onHover} onCopy={onCopy} />
      ))}
    </>
  );
}

// Mids — raw InstancedMesh so we can mutate per-instance matrices every
// frame (for the self-spin). Colors are written once via setColorAt;
// matrices are rewritten each frame with focus scale + spin angle.
function MidNodes({ mids, focused, layout, onSelect, onHover, onCopy, sizeMult = 1, relatedMidSet = null }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  // Glow uses Points — positions mirror the body instances, colors match,
  // a per-point aSize attribute lets us scale individual halos for focus/dim.
  const glowPos = useMemo(() => new Float32Array(mids.length * 3), [mids.length]);
  const glowCol = useMemo(() => new Float32Array(mids.length * 3), [mids.length]);
  const glowSize = useMemo(() => {
    const arr = new Float32Array(mids.length);
    arr.fill(1);
    return arr;
  }, [mids.length]);

  const spinData = useMemo(() => mids.map(m => {
    const s = hash01(m.parent + "/" + m.name + "/spin");
    return { phase: s * Math.PI * 2, speed: 0.15 + s * 0.35 };
  }), [mids]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m || !mids.length) return;
    for (let i = 0; i < mids.length; i++) {
      tmpColor.set(mids[i].color);
      m.setColorAt(i, tmpColor);
      glowCol[i * 3 + 0] = tmpColor.r;
      glowCol[i * 3 + 1] = tmpColor.g;
      glowCol[i * 3 + 2] = tmpColor.b;
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (glowRef.current) {
      const ca = glowRef.current.geometry.attributes.color;
      if (ca) ca.needsUpdate = true;
    }
  }, [mids, tmpColor, glowCol]);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m || !mids.length) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < mids.length; i++) {
      const s = mids[i];
      const sd = spinData[i];
      const isF = focused?.kind === "mid" && focused.name === s.name && focused.parent === s.parent;
      const rel = isMidRelated(s, focused, relatedMidSet);
      const dim = focused && !rel;
      const scl = isF ? 1.85 : (rel && focused ? 1.40 : (dim ? 0.65 : 1));
      tmpObj.position.set(s.pos[0], s.pos[1], s.pos[2]);
      tmpObj.rotation.set(0, sd.phase + t * sd.speed, 0);
      tmpObj.scale.setScalar(scl * sizeMult * MID_R * MID_MULT);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      glowPos[i * 3 + 0] = s.pos[0];
      glowPos[i * 3 + 1] = s.pos[1];
      glowPos[i * 3 + 2] = s.pos[2];
      glowSize[i] = isF ? 1.7 : (rel && focused ? 1.35 : (dim ? 0.55 : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (glowRef.current) {
      const g = glowRef.current.geometry;
      g.attributes.position.needsUpdate = true;
      if (g.attributes.aSize) g.attributes.aSize.needsUpdate = true;
    }
  });

  if (!mids.length) return null;
  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, mids.length]}
        onClick={e => { e.stopPropagation(); if (e.instanceId != null) onSelect(mids[e.instanceId]); }}
        onContextMenu={e => { e.stopPropagation(); if (e.instanceId != null) onCopy?.(mids[e.instanceId].name); }}
        onPointerOver={e => { e.stopPropagation(); if (e.instanceId != null) onHover(mids[e.instanceId]); }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); }}
      >
        <primitive object={NOTE_GEOM} attach="geometry" />
        <primitive object={MAT_MID} attach="material" />
      </instancedMesh>
      <points ref={glowRef} raycast={() => null} key={`glow-mid-${mids.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[glowCol, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[glowSize, 1]} />
        </bufferGeometry>
        <primitive object={MAT_GLOW_MID} attach="material" />
      </points>
    </>
  );
}

// Smalls — orbit around their parent mid (like moons around a planet)
// AND self-rotate. The initial offset from parent is taken from the
// layout-time position; we rotate that offset around a per-small random
// axis each frame, keeping the orbit plane stable but different for
// every micro so they don't all orbit in the same plane.
function SmallNodes({ smalls, focused, onSelect, onHover, onCopy, sizeMult = 1, layout, livePosRef = null }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const tmpAxis = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  const glowPos = useMemo(() => new Float32Array(smalls.length * 3), [smalls.length]);
  const glowCol = useMemo(() => new Float32Array(smalls.length * 3), [smalls.length]);
  const glowSize = useMemo(() => {
    const arr = new Float32Array(smalls.length);
    arr.fill(1);
    return arr;
  }, [smalls.length]);

  const orbitData = useMemo(() => {
    const midLookup = (sName, gName) =>
      layout?.midsByKey?.[sName + "/" + gName] ||
      layout?.midsByKey?.[sName] ||
      layout?.mids?.find(x => x.name === sName && (!gName || x.parent === gName));
    return smalls.map(s => {
      const parent = midLookup(s.parent, s.grandparent);
      const cx = parent?.pos?.[0] ?? s.pos[0];
      const cy = parent?.pos?.[1] ?? s.pos[1];
      const cz = parent?.pos?.[2] ?? s.pos[2];
      const seed = hash01(s.grandparent + "/" + s.parent + "/" + s.name);
      const ax = Math.sin(seed * 7.13);
      const ay = Math.cos(seed * 5.81);
      const az = Math.sin(seed * 3.43 + 1.1);
      const aLen = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
      return {
        cx, cy, cz,
        ox: s.pos[0] - cx, oy: s.pos[1] - cy, oz: s.pos[2] - cz,
        axx: ax / aLen, axy: ay / aLen, axz: az / aLen,
        orbitSpeed: 0.015 + seed * 0.035,
        orbitPhase: seed * Math.PI * 2,
        spinSpeed: 0.30 + seed * 0.70,
        spinPhase: (1 - seed) * Math.PI * 2,
      };
    });
  }, [smalls, layout]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m || !smalls.length) return;
    for (let i = 0; i < smalls.length; i++) {
      tmpColor.set(smalls[i].color);
      m.setColorAt(i, tmpColor);
      glowCol[i * 3 + 0] = tmpColor.r;
      glowCol[i * 3 + 1] = tmpColor.g;
      glowCol[i * 3 + 2] = tmpColor.b;
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (glowRef.current) {
      const ca = glowRef.current.geometry.attributes.color;
      if (ca) ca.needsUpdate = true;
    }
  }, [smalls, tmpColor, glowCol]);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m || !smalls.length) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < smalls.length; i++) {
      const s = smalls[i];
      const d = orbitData[i];
      const isF = focused?.kind === "small" && focused.name === s.name && focused.parent === s.parent && focused.grandparent === s.grandparent;
      const inMid = focused?.kind === "mid" && focused.name === s.parent && focused.parent === s.grandparent;
      const inBig = focused?.kind === "big" && focused.name === s.grandparent;
      const dim = focused && !(isF || inMid || inBig);
      const scl = isF ? 2.5 : ((inMid || inBig) ? 1.55 : (dim ? 0.60 : 1));

      tmpAxis.set(d.axx, d.axy, d.axz);
      tmpQuat.setFromAxisAngle(tmpAxis, d.orbitPhase + t * d.orbitSpeed);
      tmpVec.set(d.ox, d.oy, d.oz).applyQuaternion(tmpQuat);
      const wx = d.cx + tmpVec.x, wy = d.cy + tmpVec.y, wz = d.cz + tmpVec.z;
      // Share live position with anything that needs to follow us (edges).
      // Key format matches what focusLines/allEdges use to reference smalls.
      if (livePosRef) {
        livePosRef.current.set(s.grandparent + "/" + s.parent + "/" + s.name, [wx, wy, wz]);
      }
      tmpObj.position.set(wx, wy, wz);
      tmpObj.rotation.set(0, d.spinPhase + t * d.spinSpeed, 0);
      tmpObj.scale.setScalar(scl * sizeMult * SMALL_R * SMALL_MULT);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      glowPos[i * 3 + 0] = wx;
      glowPos[i * 3 + 1] = wy;
      glowPos[i * 3 + 2] = wz;
      glowSize[i] = isF ? 1.9 : ((inMid || inBig) ? 1.40 : (dim ? 0.50 : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (glowRef.current) {
      const g = glowRef.current.geometry;
      g.attributes.position.needsUpdate = true;
      if (g.attributes.aSize) g.attributes.aSize.needsUpdate = true;
    }
  });

  if (!smalls.length) return null;
  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, smalls.length]}
        onClick={e => { e.stopPropagation(); if (e.instanceId != null) onSelect(smalls[e.instanceId]); }}
        onContextMenu={e => { e.stopPropagation(); if (e.instanceId != null) onCopy?.(smalls[e.instanceId].name); }}
        onPointerOver={e => { e.stopPropagation(); if (e.instanceId != null) onHover(smalls[e.instanceId]); }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); }}
      >
        <primitive object={NOTE_GEOM} attach="geometry" />
        <primitive object={MAT_SMALL} attach="material" />
      </instancedMesh>
      <points ref={glowRef} raycast={() => null} key={`glow-small-${smalls.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[glowCol, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[glowSize, 1]} />
        </bufferGeometry>
        <primitive object={MAT_GLOW_SMALL} attach="material" />
      </points>
    </>
  );
}

// Attrs — self-rotate in place (no orbit, since they float in a cloud
// that isn't parented to any single node).
function AttributeNodes({ attributes, focused, layout, onSelect, onHover, onCopy, sizeMult = 1, relatedAttrSet = null }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const glowPos = useMemo(() => new Float32Array(attributes.length * 3), [attributes.length]);
  const glowCol = useMemo(() => new Float32Array(attributes.length * 3), [attributes.length]);
  const glowSize = useMemo(() => {
    const arr = new Float32Array(attributes.length);
    arr.fill(1);
    return arr;
  }, [attributes.length]);

  const spinData = useMemo(() => attributes.map(a => {
    const s = hash01(a.categoryId + ":" + a.name + "/spin");
    return { phase: s * Math.PI * 2, speed: 0.18 + s * 0.4 };
  }), [attributes]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m || !attributes.length) return;
    for (let i = 0; i < attributes.length; i++) {
      tmpColor.set(attributes[i].color);
      m.setColorAt(i, tmpColor);
      glowCol[i * 3 + 0] = tmpColor.r;
      glowCol[i * 3 + 1] = tmpColor.g;
      glowCol[i * 3 + 2] = tmpColor.b;
      glowPos[i * 3 + 0] = attributes[i].pos[0];
      glowPos[i * 3 + 1] = attributes[i].pos[1];
      glowPos[i * 3 + 2] = attributes[i].pos[2];
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (glowRef.current) {
      const g = glowRef.current.geometry;
      if (g.attributes.color)    g.attributes.color.needsUpdate = true;
      if (g.attributes.position) g.attributes.position.needsUpdate = true;
    }
  }, [attributes, tmpColor, glowCol, glowPos]);

  useFrame(({ clock }) => {
    const m = meshRef.current;
    if (!m || !attributes.length) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < attributes.length; i++) {
      const a = attributes[i];
      const sd = spinData[i];
      const isF = focused?.kind === "attribute" && focused.name === a.name && focused.categoryId === a.categoryId;
      const rel = isAttrRelated(a, focused, relatedAttrSet);
      const dim = focused && !isF && !rel;
      const scl = isF ? 2.3 : (rel && focused ? 1.55 : (dim ? 0.65 : 1));
      tmpObj.position.set(a.pos[0], a.pos[1], a.pos[2]);
      tmpObj.rotation.set(0, sd.phase + t * sd.speed, 0);
      tmpObj.scale.setScalar(scl * sizeMult * ATTR_R * ATTR_MULT);
      tmpObj.updateMatrix();
      m.setMatrixAt(i, tmpObj.matrix);
      glowSize[i] = isF ? 1.8 : (rel && focused ? 1.40 : (dim ? 0.55 : 1));
    }
    m.instanceMatrix.needsUpdate = true;
    if (glowRef.current) {
      const g = glowRef.current.geometry;
      if (g.attributes.aSize) g.attributes.aSize.needsUpdate = true;
    }
  });

  if (!attributes.length) return null;
  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, attributes.length]}
        onClick={e => { e.stopPropagation(); if (e.instanceId != null) onSelect(attributes[e.instanceId]); }}
        onContextMenu={e => {
          e.stopPropagation();
          if (e.instanceId != null) {
            const a = attributes[e.instanceId];
            onCopy?.(a.label || a.name);
          }
        }}
        onPointerOver={e => { e.stopPropagation(); if (e.instanceId != null) onHover(attributes[e.instanceId]); }}
        onPointerOut={e => { e.stopPropagation(); onHover(null); }}
      >
        <primitive object={NOTE_GEOM} attach="geometry" />
        <primitive object={MAT_ATTR} attach="material" />
      </instancedMesh>
      <points ref={glowRef} raycast={() => null} key={`glow-attr-${attributes.length}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[glowCol, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[glowSize, 1]} />
        </bufferGeometry>
        <primitive object={MAT_GLOW_ATTR} attach="material" />
      </points>
    </>
  );
}

// Batched edges renderer — all edges live in ONE LineSegments2 mesh, so
// the GPU sees a single draw call no matter how many lines there are.
// With individual drei <Line> components per edge, hub-focus with 40+
// connections was costing 40+ draw calls and MeshLine shader invocations,
// which is why focus dropped fps. Now it's effectively free.
//
// Hit detection: LineSegments2's raycast populates `faceIndex` on the
// intersection — that's the segment index in the order we pushed positions.
// We maintain a parallel `edgeLookup` so we can map faceIndex → edge data.
//
// Hover highlight: rather than rebuild the batched geometry on every
// hover (expensive), we overlay a single drei <Line> on top of the
// hovered segment — one extra draw call that only exists while hovered.
function InteractiveEdges({
  edges, visible = true, opacity = 1,
  hoveredIndex = -1,
  onHoverEdge, onClickEdge,
  widthBase = 3.0, widthHover = 6.0,
  livePosRef = null,
}) {
  const { size } = useThree();
  const clearTimerRef = useRef(null);

  // Kind-aware shortening so the line doesn't overlap the node body.
  // Hoisted so useFrame (below) can reuse the same table without
  // redefining it per call.
  const nodeMargin = (k) => {
    switch (k) {
      case "big":       return 1.5;
      case "mid":       return 0.62;
      case "small":     return 0.30;
      case "attribute": return 0.45;
      default:          return 0.45;
    }
  };
  // Lookup a live position for a small endpoint. Returns null if there's
  // no live position available (meaning the node is static, or we don't
  // have a livePosRef yet) — callers fall back to the static e.from/e.to.
  const getLiveEndpoint = (node) => {
    if (!livePosRef || !node || node.kind !== "small") return null;
    const key = node.grandparent + "/" + node.parent + "/" + node.name;
    return livePosRef.current.get(key) || null;
  };

  // Build the batched mesh + lookup from edges. Shortened at each endpoint
  // by a kind-aware margin so lines don't overlap node bodies (fixes click
  // stealing from small nodes).
  const { mesh, edgeLookup, hasLiveEndpoint, posBuffer } = useMemo(() => {
    if (!visible || !edges.length) return { mesh: null, edgeLookup: [], hasLiveEndpoint: false, posBuffer: null };
    const positions = [];
    const colorsArr = [];
    const lookup = [];
    let anyLive = false;
    const c = new THREE.Color();
    for (let ei = 0; ei < edges.length; ei++) {
      const e = edges[ei];
      const dx = e.to[0] - e.from[0];
      const dy = e.to[1] - e.from[1];
      const dz = e.to[2] - e.from[2];
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (len < 0.001) continue;
      const mFrom = Math.min(nodeMargin(e.fromNode?.kind), len * 0.35);
      const mTo   = Math.min(nodeMargin(e.toNode?.kind),   len * 0.35);
      const tFrom = mFrom / len;
      const tTo   = mTo   / len;
      positions.push(
        e.from[0] + dx*tFrom, e.from[1] + dy*tFrom, e.from[2] + dz*tFrom,
        e.to[0]   - dx*tTo,   e.to[1]   - dy*tTo,   e.to[2]   - dz*tTo
      );
      c.set(e.color || "#5E6AD2");
      colorsArr.push(c.r, c.g, c.b, c.r, c.g, c.b);
      lookup.push(e);
      if (e.fromNode?.kind === "small" || e.toNode?.kind === "small") anyLive = true;
    }
    if (!lookup.length) return { mesh: null, edgeLookup: [], hasLiveEndpoint: false, posBuffer: null };

    const geom = new LineSegmentsGeometry();
    geom.setPositions(positions);
    geom.setColors(colorsArr);

    const mat = new LineMaterial({
      vertexColors: true,
      linewidth: widthBase,
      transparent: true,
      opacity: opacity,
      depthTest: true,
      depthWrite: false,
      worldUnits: false,  // linewidth is in pixels, constant under zoom
      toneMapped: false,
    });
    mat.resolution.set(size.width || window.innerWidth, size.height || window.innerHeight);

    // Keep a typed view of the positions so the per-frame update can
    // write into the same array before pushing back through setPositions.
    // (LineSegmentsGeometry internally allocates a fresh interleaved
    // buffer each setPositions call, so this Float32Array is just our
    // scratch copy.)
    const posBuf = new Float32Array(positions);

    return { mesh: new LineSegments2(geom, mat), edgeLookup: lookup, hasLiveEndpoint: anyLive, posBuffer: posBuf };
  }, [edges, visible]); // rebuild only when edge set changes

  // Per-frame position update — only runs when at least one edge touches
  // a small (orbiting) node. Recomputes the shortened segment using the
  // live world-space endpoint and pushes the updated buffer to the geom.
  // No-op for edges made entirely of static nodes (bigs/mids/attributes).
  useFrame(() => {
    if (!mesh || !hasLiveEndpoint || !livePosRef || !posBuffer) return;
    let changed = false;
    for (let i = 0; i < edgeLookup.length; i++) {
      const e = edgeLookup[i];
      const fromLive = getLiveEndpoint(e.fromNode);
      const toLive = getLiveEndpoint(e.toNode);
      if (!fromLive && !toLive) continue;
      const fx = fromLive ? fromLive[0] : e.from[0];
      const fy = fromLive ? fromLive[1] : e.from[1];
      const fz = fromLive ? fromLive[2] : e.from[2];
      const tx = toLive ? toLive[0] : e.to[0];
      const ty = toLive ? toLive[1] : e.to[1];
      const tz = toLive ? toLive[2] : e.to[2];
      const dx = tx - fx, dy = ty - fy, dz = tz - fz;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (len < 0.001) continue;
      const mFrom = Math.min(nodeMargin(e.fromNode?.kind), len * 0.35);
      const mTo   = Math.min(nodeMargin(e.toNode?.kind),   len * 0.35);
      const tF = mFrom / len;
      const tT = mTo   / len;
      const base = i * 6;
      posBuffer[base + 0] = fx + dx * tF;
      posBuffer[base + 1] = fy + dy * tF;
      posBuffer[base + 2] = fz + dz * tF;
      posBuffer[base + 3] = tx - dx * tT;
      posBuffer[base + 4] = ty - dy * tT;
      posBuffer[base + 5] = tz - dz * tT;
      changed = true;
    }
    if (changed) {
      // setPositions rewires the interleaved buffer in one call. For
      // focus-mode (dozens of edges) this is cheap; for ON-mode (~1500)
      // it's still bounded because `hasLiveEndpoint` gates entry — most
      // ON-mode edges don't touch smalls, so the loop just skips them.
      mesh.geometry.setPositions(posBuffer);
    }
  });

  // Keep resolution, linewidth, opacity in sync with props without
  // tearing down the geometry.
  useEffect(() => {
    if (!mesh) return;
    mesh.material.resolution.set(size.width || window.innerWidth, size.height || window.innerHeight);
  }, [mesh, size.width, size.height]);

  useEffect(() => {
    if (!mesh) return;
    mesh.material.linewidth = widthBase;
    mesh.material.opacity = opacity;
    mesh.material.needsUpdate = true;
  }, [mesh, widthBase, opacity]);

  // Dispose on unmount / rebuild
  useEffect(() => () => {
    if (mesh) {
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
    }
  }, [mesh]);

  if (!mesh) return null;

  const hoveredEdge = hoveredIndex >= 0 ? edgeLookup[hoveredIndex] : null;

  // Hover exit grace — user complained that hover vanishes before they can
  // move toward the click. 220ms delay gives them time to commit.
  const scheduleClear = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      if (onHoverEdge) onHoverEdge(-1);
    }, 220);
  };
  const cancelClear = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  };

  return (
    <>
      <primitive
        object={mesh}
        onPointerMove={(e) => {
          if (e.faceIndex != null && edgeLookup[e.faceIndex]) {
            cancelClear();
            if (onHoverEdge && hoveredIndex !== e.faceIndex) onHoverEdge(e.faceIndex);
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          scheduleClear();
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (e.faceIndex != null && onClickEdge && edgeLookup[e.faceIndex]) {
            onClickEdge(edgeLookup[e.faceIndex]);
          }
        }}
      />
      {hoveredEdge && (
        <Line
          points={[hoveredEdge.from, hoveredEdge.to]}
          color="#ffffff"
          lineWidth={widthHover}
          transparent
          opacity={Math.min(1, opacity + 0.2)}
          raycast={() => null}
        />
      )}
    </>
  );
}

// Floating tag shown at the midpoint of a hovered edge.
// - If the user has focused a node: show the OTHER endpoint's name
//   (focus-relative — tells them where the click would take them)
// - If no focus (general ON-mode view): show BOTH endpoint names with ↔
function EdgeTooltip({ edge, focused }) {
  if (!edge) return null;
  const mid = [
    (edge.from[0] + edge.to[0]) / 2,
    (edge.from[1] + edge.to[1]) / 2,
    (edge.from[2] + edge.to[2]) / 2,
  ];
  let text;
  if (focused) {
    const sameAsFocused = (n) =>
      n && focused && n.kind === focused.kind && n.name === focused.name;
    const other = sameAsFocused(edge.fromNode) ? edge.toNode : edge.fromNode;
    text = other?.label || other?.name || "";
  } else {
    const a = edge.fromNode?.label || edge.fromNode?.name || "";
    const b = edge.toNode?.label   || edge.toNode?.name   || "";
    text = `${a}  ↔  ${b}`;
  }
  if (!text) return null;
  return (
    <Html position={mid} center style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
      <div style={{
        color: "#fff", fontSize: 11, fontFamily: T.fontMono,
        fontWeight: 600, background: "rgba(14,14,22,0.96)",
        border: "1px solid rgba(94,106,210,0.6)",
        padding: "5px 10px", borderRadius: 4, whiteSpace: "nowrap",
        transform: "translate(-50%, -50%)", position: "absolute",
        userSelect: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
        letterSpacing: "0.02em",
      }}>{text}</div>
    </Html>
  );
}

// ── Unified label system ──────────────────────────────────────────
// One component per tier. Each instance decides which items to label
// based on the mode: "on" (all), "auto" (within tier threshold), "off"
// (none). Orbiting smalls have their labels follow the live world
// position so labels don't dangle where the node *was* at layout time.
//
// Performance: in "auto" mode the distance check is throttled to ~6Hz
// via tickRef, and state updates only happen when the visible set
// actually changes — so a stable camera doesn't cause per-frame React
// re-renders. "on" mode with many items (1000+ smalls) renders all
// <Html> elements, which is expensive — the UI labels that toggle as
// "auto (recommended)" so users understand the trade-off.

const LABEL_TIER_CFG = {
  big:   { distanceFactor: 34, yOffset: 24, autoThreshold: Infinity, fontSize: 11 },
  mid:   { distanceFactor: 22, yOffset: 14, autoThreshold: 55, fontSize: 10 },
  small: { distanceFactor: 14, yOffset: 9,  autoThreshold: 14, fontSize: 9 },
  attr:  { distanceFactor: 20, yOffset: 12, autoThreshold: 35, fontSize: 10 },
};

function smallLiveKey(item) {
  if (item.grandparent && item.parent && item.name) {
    return item.grandparent + "/" + item.parent + "/" + item.name;
  }
  return null;
}

function readItemPos(item, livePosRef) {
  // Smalls orbit — try live ref first; everything else uses static pos.
  if (livePosRef) {
    const k = smallLiveKey(item);
    if (k) {
      const live = livePosRef.current.get(k);
      if (live) return live;
    }
  }
  return item.pos;
}

function labelFocusMatch(item, tier, focused) {
  if (!focused) return false;
  if (tier === "big")   return focused.kind === "big"       && focused.name === item.name;
  if (tier === "mid")   return focused.kind === "mid"       && focused.name === item.name && focused.parent === item.parent;
  if (tier === "small") return focused.kind === "small"     && focused.name === item.name && focused.parent === item.parent && focused.grandparent === item.grandparent;
  if (tier === "attr")  return focused.kind === "attribute" && focused.name === item.name && focused.categoryId === item.categoryId;
  return false;
}

function labelKeyFor(it, tier, i) {
  if (tier === "big")   return `b-${it.name}`;
  if (tier === "mid")   return `m-${it.parent}/${it.name}`;
  if (tier === "small") return `s-${it.grandparent}/${it.parent}/${it.name}`;
  if (tier === "attr")  return `a-${it.categoryId}:${it.name}`;
  return `x-${i}`;
}

function LiveLabel({ item, tier, focused, livePosRef }) {
  const groupRef = useRef();
  const cfg = LABEL_TIER_CFG[tier];
  useFrame(() => {
    if (!groupRef.current) return;
    const p = readItemPos(item, livePosRef);
    if (p) groupRef.current.position.set(p[0], p[1], p[2]);
  });
  const isF = labelFocusMatch(item, tier, focused);
  const dim = focused && !isF;
  return (
    <group ref={groupRef}>
      <Html center distanceFactor={cfg.distanceFactor} style={{ pointerEvents: "none" }}>
        <div style={{
          color: "#fff",
          fontSize: isF ? cfg.fontSize + 2 : cfg.fontSize,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: isF ? 700 : 500, letterSpacing: "0.02em",
          background: isF ? "rgba(94,106,210,0.96)" : "rgba(10,10,15,0.78)",
          padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
          transform: `translate(-50%, ${cfg.yOffset}px)`, position: "absolute",
          opacity: dim ? 0.45 : 1, userSelect: "none",
        }}>{item.label || item.name}</div>
      </Html>
    </group>
  );
}

function NodeLabels({ items, mode, tier, focused, livePosRef = null }) {
  const { camera } = useThree();
  const [visible, setVisible] = useState([]);
  const tickRef = useRef(0);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const cfg = LABEL_TIER_CFG[tier];

  useFrame((_, dt) => {
    if (mode === "off") {
      if (visible.length) setVisible([]);
      return;
    }
    if (mode === "on" || !isFinite(cfg.autoThreshold)) {
      if (visible !== items) setVisible(items);
      return;
    }
    // "auto": throttle the camera-distance check to ~6Hz.
    tickRef.current += dt;
    if (tickRef.current < 0.16) return;
    tickRef.current = 0;
    const thresh = cfg.autoThreshold;
    const near = [];
    for (const it of items) {
      const p = readItemPos(it, livePosRef);
      if (!p) continue;
      tmpVec.set(p[0], p[1], p[2]);
      if (camera.position.distanceTo(tmpVec) < thresh) near.push(it);
    }
    setVisible(prev => {
      if (prev.length !== near.length) return near;
      for (let i = 0; i < near.length; i++) if (prev[i] !== near[i]) return near;
      return prev;
    });
  });

  if (mode === "off") return null;
  return (
    <>
      {visible.map((it, i) => (
        <LiveLabel key={labelKeyFor(it, tier, i)} item={it} tier={tier}
          focused={focused} livePosRef={livePosRef} />
      ))}
    </>
  );
}

// HoverTooltip — displays the hovered node's name at its world position.
// Critical: orbiting smalls rewrite their world position via the shared
// livePosRef each frame, but the `hovered` prop here only carries the
// static layout-time `pos`. If we bind Html to `hovered.pos`, the tooltip
// appears where the node WAS at layout time, not where it actually is —
// producing the "transparent dot with a floating name" effect the user
// reported. We wrap Html in a group and update its position per-frame
// from livePosRef when the hovered node is an orbiting small, so the
// label tracks the moving body.
//
// If the hovered node IS the currently-focused node, skip the tooltip
// entirely — NodeLabels already renders the focused label in accent
// styling, and drawing HoverTooltip on top produced a visible
// double-label in focus+hover state (user-reported).
function HoverTooltip({ hovered, focused = null, livePosRef = null }) {
  const groupRef = useRef();
  useFrame(() => {
    if (!hovered || !groupRef.current) return;
    let p = hovered.pos;
    if (livePosRef && hovered.kind === "small" && hovered.grandparent) {
      const live = livePosRef.current.get(
        hovered.grandparent + "/" + hovered.parent + "/" + hovered.name
      );
      if (live) p = live;
    }
    if (p) groupRef.current.position.set(p[0], p[1], p[2]);
  });
  if (!hovered || !hovered.pos) return null;
  // Suppress tooltip when the user is hovering the currently-focused
  // node itself — NodeLabels already renders its label in accent style,
  // so drawing HoverTooltip on top produced a visible double label.
  if (focused) {
    const h = hovered;
    const matches =
      (focused.kind === "big"       && h.name === focused.name && !h.parent && !h.categoryId) ||
      (focused.kind === "mid"       && h.name === focused.name && h.parent === focused.parent && !h.grandparent) ||
      (focused.kind === "small"     && h.name === focused.name && h.parent === focused.parent && h.grandparent === focused.grandparent) ||
      (focused.kind === "attribute" && h.name === focused.name && h.categoryId === focused.categoryId);
    if (matches) return null;
  }
  return (
    <group ref={groupRef}>
      <Html center distanceFactor={20} style={{ pointerEvents: "none" }}>
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
    </group>
  );
}

// CameraRig: smooth fly-to-focus animation using lerp. The `animating`
// flag is exposed via a prop ref so OrbitControls' onStart can cancel
// the animation the moment the user grabs the camera (drag or wheel-
// zoom). Without this cancel, the lerp pulls camera + target back each
// frame while the user's input is fighting to move them — producing
// the "stuck, snaps back, works again after a few seconds" symptom.
function CameraRig({ focusTarget, resetCount, controlsRef, animatingRef, syncAnimating }) {
  const { camera } = useThree();
  const destPos = useRef(new THREE.Vector3(0, 15, 130));
  const destTgt = useRef(new THREE.Vector3());

  // Flip both the ref (for useFrame's per-tick check) and the React
  // state (for OrbitControls' autoRotate prop) via the sync callback.
  // If syncAnimating isn't wired up, fall back to the ref only so the
  // component stays usable.
  const setAnimating = (v) => {
    if (animatingRef) animatingRef.current = v;
    if (syncAnimating) syncAnimating(v);
  };

  useEffect(() => {
    if (!focusTarget) { setAnimating(false); return; }
    const p = focusTarget.pos;
    if (!p) return;
    const t = new THREE.Vector3(...p);
    destTgt.current.copy(t);
    const dist = focusTarget.kind === "big" ? 22 : focusTarget.kind === "mid" ? 9 : focusTarget.kind === "small" ? 4.5 : 8;
    const dir = t.length() > 0.01 ? t.clone().normalize() : new THREE.Vector3(0, 0, 1);
    destPos.current.copy(t.clone().add(dir.multiplyScalar(dist)));
    setAnimating(true);
  }, [focusTarget]);

  // Reset: fly back to the default viewing position.
  useEffect(() => {
    if (!resetCount) return;
    destPos.current.set(0, 15, 130);
    destTgt.current.set(0, 0, 0);
    setAnimating(true);
  }, [resetCount]);

  useFrame((_, dt) => {
    if (!animatingRef?.current) return;
    const k = Math.min(1, dt * 2.8);
    camera.position.lerp(destPos.current, k);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(destTgt.current, k);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(destPos.current) < 0.07 && controlsRef.current?.target.distanceTo(destTgt.current) < 0.07) {
      setAnimating(false);
    }
  });
  return null;
}

// FreeFlightNav — WASD + Z/X keyboard free-flight that shifts both the
// camera AND the OrbitControls target by the same vector. Because the
// target moves in lockstep, orbit controls keep working naturally after
// each move: the user can still drag to rotate around wherever they
// flew to, scroll to zoom, etc. Without moving the target you'd orbit
// around the old pivot, which feels broken.
//
// Movement is camera-relative for W/A/S/D (go where you're looking)
// and world-axis for Z/X (always straight down/up), which matches
// how users instinctively reach for an "elevate" control. Speed
// scales with camera-to-target distance so flying near a small node
// isn't unmanageably fast, and flying across the full map isn't
// glacially slow.
//
// Any keypress cancels a pending focus-lerp so keyboard input always
// wins over a fly-to animation (same principle as OrbitControls
// onStart). We ignore keys while the user is typing into an <input> /
// <textarea> / contenteditable element so search / filter typing
// doesn't drift the camera.
function FreeFlightNav({ controlsRef, keysDownRef, syncAnimating }) {
  const { camera } = useThree();
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right   = useMemo(() => new THREE.Vector3(), []);
  const move    = useMemo(() => new THREE.Vector3(), []);
  const WORLD_UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, dt) => {
    if (!controlsRef.current) return;
    const keys = keysDownRef.current;
    if (!keys || keys.size === 0) return;

    // Cancel any fly-to-focus animation so the keyboard immediately
    // takes precedence (otherwise lerp + movement fight each other).
    if (syncAnimating) syncAnimating(false);

    // Speed scales with camera-to-target distance. At default zoom
    // (dist ~130) that's ~19 u/s — crosses the map in a handful of
    // seconds. Zoomed into a microstyle (dist ~5) it's ~0.75 u/s —
    // nudge-precision.
    const dist = camera.position.distanceTo(controlsRef.current.target);
    const speed = Math.max(1.2, dist * 0.15);
    const step = speed * dt;

    forward.subVectors(controlsRef.current.target, camera.position);
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    right.crossVectors(forward, WORLD_UP).normalize();

    move.set(0, 0, 0);
    if (keys.has("w")) move.add(forward);
    if (keys.has("s")) move.sub(forward);
    if (keys.has("d")) move.add(right);
    if (keys.has("a")) move.sub(right);
    if (keys.has("x")) move.y += 1;
    if (keys.has("z")) move.y -= 1;

    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(step);
    camera.position.add(move);
    controlsRef.current.target.add(move);
    controlsRef.current.update();
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

function Slider({ value, onChange, min = 0, max = 100, step = 1, label, formatValue, disabled }) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div style={{ padding: "5px 10px 3px", opacity: disabled ? 0.35 : 1 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        fontSize: 10, fontFamily: T.fontMono, marginBottom: 3,
      }}>
        <span style={{ color: T.textMuted, letterSpacing: ".04em" }}>{label}</span>
        <span style={{ color: T.text, fontSize: 9, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{
          width: "100%", cursor: disabled ? "default" : "pointer",
          accentColor: T.accent, display: "block", margin: 0,
        }}
      />
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

// Label-mode row: tier name on the left, tiny on/auto/off segmented
// control on the right. Compact enough to stack four of them in the
// LABELS section of the VIEW tab. When disabled (because its layer is
// off), the row dims but remains visible so the user sees the option
// exists.
function LabelModeRow({ tierLabel, value, onChange, disabled = false }) {
  const opts = [
    { value: "on",   label: "on" },
    { value: "auto", label: "auto" },
    { value: "off",  label: "off" },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      margin: "2px 10px 2px",
      opacity: disabled ? 0.45 : 1,
    }}>
      <div style={{
        flex: 1, minWidth: 0,
        fontSize: 11, fontFamily: T.fontMono, color: T.textSec,
        letterSpacing: ".03em",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{tierLabel}</div>
      <div style={{
        display: "flex", borderRadius: 4,
        border: `1px solid ${T.borderHi}`, overflow: "hidden",
        pointerEvents: disabled ? "none" : "auto",
      }}>
        {opts.map(opt => (
          <div key={opt.value} onClick={() => onChange(opt.value)} style={{
            padding: "3px 8px",
            fontSize: 9, fontFamily: T.fontMono, letterSpacing: ".06em",
            cursor: "pointer", userSelect: "none",
            background: value === opt.value ? T.borderHi : "transparent",
            color: value === opt.value ? T.text : T.textMuted,
            textTransform: "uppercase",
          }}>{opt.label}</div>
        ))}
      </div>
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

// Multi-select list — every item has a toggleable colored dot. The whole
// list is scrollable so it scales to hundreds of subgenres without bloating
// the panel. `selected` convention: `null` = everything shown, `Set` with
// explicit values = only those shown (empty Set = nothing shown).
function MultiSelectList({ items, selected, onChange, maxHeight = 170, query = "", onQuery }) {
  const allValues = useMemo(() => items.map(i => i.value), [items]);
  const isOn = (v) => !selected || selected.has(v);

  const toggle = (v) => {
    // Simple toggle: the click only affects the item clicked. The previous
    // implementation treated a click-while-all-on as an exclusive select
    // (and similarly for click-while-searching), which meant one wrong
    // click instantly unchecked all 17 other genres. User wanted the
    // click to only flip the one item they actually pressed.
    //
    // Semantics:
    //   selected === null  → "show all" (no filter active)
    //   selected === Set() → "show none"
    //   selected === Set(xs) → show only xs
    //
    // Starting from null and clicking → build the full set minus the
    // clicked item. If a subsequent toggle restores every item we collapse
    // back to null so the "ALL" label lights up again.
    let next;
    if (!selected) {
      next = new Set(allValues.filter(x => x !== v));
    } else if (selected.has(v)) {
      next = new Set(selected);
      next.delete(v);
    } else {
      next = new Set(selected);
      next.add(v);
    }
    if (next && next.size === allValues.length) next = null;
    onChange(next);
  };
  const selectAll = () => onChange(null);
  const selectNone = () => onChange(new Set());

  // Apply user's typed-in filter, if any.
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      it.label.toLowerCase().includes(q) ||
      (it.group && it.group.toLowerCase().includes(q))
    );
  }, [items, query]);

  // Count for display. If null, show total / total.
  const selCount = selected ? selected.size : allValues.length;

  return (
    <div style={{ padding: "2px 10px 8px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 9, fontFamily: T.fontMono, color: T.textMuted,
          letterSpacing: ".06em",
        }}>{selCount}/{allValues.length}</span>
        <div style={{ display: "flex", gap: 10, fontSize: 9, fontFamily: T.fontMono, letterSpacing: ".06em" }}>
          <span onClick={selectAll}
            style={{ color: !selected ? T.text : T.textMuted, cursor: "pointer", textTransform: "uppercase" }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = !selected ? T.text : T.textMuted}
          >all</span>
          <span onClick={selectNone}
            style={{ color: (selected && selected.size === 0) ? T.text : T.textMuted, cursor: "pointer", textTransform: "uppercase" }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = (selected && selected.size === 0) ? T.text : T.textMuted}
          >none</span>
        </div>
      </div>
      {onQuery !== undefined && (
        <input
          type="text"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="filter…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "4px 8px", marginBottom: 4,
            background: "rgba(20,20,28,0.85)",
            border: `1px solid ${T.borderHi}`, borderRadius: 4,
            color: T.text, fontSize: 11, fontFamily: T.fontMono,
            outline: "none",
          }}
        />
      )}
      <div style={{
        maxHeight, overflowY: "auto",
        border: `1px solid ${T.border}`, borderRadius: 4,
        background: "rgba(14,14,22,0.65)",
      }}>
        {filtered.length === 0 && (
          <div style={{
            padding: "8px 10px", fontSize: 10, color: T.textMuted,
            fontFamily: T.fontMono, textAlign: "center",
          }}>no matches</div>
        )}
        {filtered.map(it => {
          const on = isOn(it.value);
          const dotColor = it.color || "#5E6AD2";
          return (
            <div
              key={it.value}
              onClick={() => toggle(it.value)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "3px 7px", cursor: "pointer",
                opacity: on ? 1 : 0.38,
                fontSize: 11, fontFamily: T.fontMono,
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(94,106,210,0.14)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: on ? dotColor : "transparent",
                border: `1.5px solid ${dotColor}`,
              }} />
              <span style={{ color: T.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.label}
              </span>
              {it.group && (
                <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: ".04em" }}>
                  {it.group}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  filters, setFilters,
  search, setSearch,
  searchResults, onSearchResultClick,
  nodeSizes, setNodeSizes,
  labelOpts, setLabelOpts,
  lineOpacity, setLineOpacity,
  allLinesOpacity, setAllLinesOpacity,
  rotateSpeed, setRotateSpeed,
  onResetCustomization,
}) {
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [tab, setTab] = useState("view"); // view | filter | style
  const [minimized, setMinimized] = useState(false);
  const dragStart = useRef(null);

  const onHeaderMouseDown = (e) => {
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    const onMove = (ev) => {
      if (!dragStart.current) return;
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      setPos({
        x: Math.max(0, dragStart.current.px + dx),
        y: Math.max(0, dragStart.current.py + dy),
      });
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
  };

  const bigItems = useMemo(() => layout.bigs.map(b => ({
    value: b.name, label: b.name, color: b.color,
  })), [layout.bigs]);

  const midItems = useMemo(() => {
    const bigColorByName = {};
    for (const b of layout.bigs) bigColorByName[b.name] = b.color;
    let src = layout.mids;
    if (filters.bigs) src = src.filter(m => filters.bigs.has(m.parent));
    return src
      .map(m => ({
        value: m.name, label: m.name, group: m.parent,
        color: bigColorByName[m.parent] || "#5E6AD2",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [layout.mids, layout.bigs, filters.bigs]);

  const [bigQuery, setBigQuery] = useState("");
  const [midQuery, setMidQuery] = useState("");
  const [smallQuery, setSmallQuery] = useState("");
  const [attrQuery, setAttrQuery] = useState("");

  // Microstyle items — scoped by selected bigs/mids so the list shrinks
  // as the user narrows above. Colored by grandparent (big) color.
  const smallItems = useMemo(() => {
    if (!layout.hasSmalls) return [];
    const bigColorByName = {};
    for (const b of layout.bigs) bigColorByName[b.name] = b.color;
    let src = layout.smalls;
    if (filters.bigs) src = src.filter(s => filters.bigs.has(s.grandparent));
    if (filters.mids) src = src.filter(s => filters.mids.has(s.parent));
    return src
      .map(s => ({
        value: smallKey(s),
        label: s.name,
        group: s.parent,
        color: bigColorByName[s.grandparent] || "#5E6AD2",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [layout.smalls, layout.bigs, layout.hasSmalls, filters.bigs, filters.mids]);

  // Attribute items — flattened across all categories. `group` holds the
  // category label so MultiSelectList shows it as a breadcrumb, and color
  // is the category's color.
  const attrItems = useMemo(() => {
    if (!layout.hasAttrs) return [];
    return layout.attributes
      .map(a => {
        const cat = ATTR_CAT_BY_ID[a.categoryId];
        return {
          value: attrKey(a),
          label: a.label || a.name,
          group: cat ? cat.label : a.categoryId,
          color: cat ? cat.color : (a.color || "#5E6AD2"),
        };
      })
      .sort((a, b) => {
        if (a.group !== b.group) return a.group.localeCompare(b.group);
        return a.label.localeCompare(b.label);
      });
  }, [layout.attributes, layout.hasAttrs]);

  const setBigsFilter = (next) => {
    setFilters(f => {
      if (next && f.mids) {
        const allowedMidNames = new Set(
          layout.mids.filter(m => next.has(m.parent)).map(m => m.name)
        );
        const prunedMids = new Set();
        for (const v of f.mids) if (allowedMidNames.has(v)) prunedMids.add(v);
        return { ...f, bigs: next, mids: prunedMids.size === 0 ? null : prunedMids };
      }
      return { ...f, bigs: next };
    });
  };
  const setMidsFilter   = (next) => setFilters(f => ({ ...f, mids: next }));
  const setSmallsFilter = (next) => setFilters(f => ({ ...f, smalls: next }));
  const setAttrsFilter  = (next) => setFilters(f => ({ ...f, attrs: next }));

  const pctFmt  = v => (v * 100).toFixed(0) + "%";
  const multFmt = v => v.toFixed(1) + "×";

  const tabs = [
    { id: "view",   label: "View" },
    { id: "filter", label: "Filter" },
    { id: "style",  label: "Style" },
  ];

  const activeFilterCount =
    (filters.bigs    ? 1 : 0) +
    (filters.mids    ? 1 : 0) +
    (filters.smalls  ? 1 : 0) +
    (filters.attrs   ? 1 : 0) +
    (filters.attrCats ? 1 : 0);

  return (
    <div style={{
      position: "absolute", top: pos.y, left: pos.x,
      width: 276,
      maxHeight: "calc(100vh - 140px)",
      overflow: "hidden", display: "flex", flexDirection: "column",
      background: "rgba(10,10,15,0.94)",
      border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md,
      zIndex: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
    }}>
      {/* Drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", cursor: "grab",
          borderBottom: minimized ? "none" : `1px solid ${T.borderHi}`,
          background: "rgba(20,20,30,0.5)",
          userSelect: "none",
          borderTopLeftRadius: T.r_md, borderTopRightRadius: T.r_md,
          borderBottomLeftRadius: minimized ? T.r_md : 0,
          borderBottomRightRadius: minimized ? T.r_md : 0,
        }}
      >
        <span style={{
          fontSize: 10, fontFamily: T.fontMono, letterSpacing: ".2em",
          color: T.textSec, textTransform: "uppercase",
        }}>⋮⋮ hit map</span>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span
            onClick={(e) => { e.stopPropagation(); setMinimized(m => !m); }}
            onMouseDown={e => e.stopPropagation()}
            title={minimized ? "Expand" : "Minimize"}
            style={{
              fontSize: 12, color: T.textMuted, cursor: "pointer",
              padding: "2px 8px", borderRadius: 3,
              fontFamily: T.fontMono, lineHeight: 1,
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
          >{minimized ? "+" : "−"}</span>
          <span
            onClick={(e) => { e.stopPropagation(); setPos({ x: 16, y: 16 }); }}
            onMouseDown={e => e.stopPropagation()}
            title="Reset position"
            style={{
              fontSize: 9, color: T.textMuted, cursor: "pointer",
              padding: "2px 6px", borderRadius: 3,
              fontFamily: T.fontMono, letterSpacing: ".08em",
            }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
          >⟲</span>
        </div>
      </div>

      {!minimized && (<>
      {/* Tabs */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${T.borderHi}`,
      }}>
        {tabs.map(t => {
          const on = tab === t.id;
          const badge = t.id === "filter" && activeFilterCount > 0 ? activeFilterCount : null;
          return (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, textAlign: "center", padding: "9px 0",
                cursor: "pointer", userSelect: "none",
                fontSize: 10, fontFamily: T.fontMono,
                letterSpacing: ".14em", textTransform: "uppercase",
                color: on ? T.text : T.textMuted,
                background: on ? "rgba(94,106,210,0.12)" : "transparent",
                borderBottom: on ? `2px solid ${T.accent}` : "2px solid transparent",
                transition: "color 120ms, background 120ms",
                position: "relative",
              }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.color = T.textSec; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.color = T.textMuted; }}
            >
              {t.label}
              {badge != null && (
                <span style={{
                  position: "absolute", top: 4, right: 10,
                  fontSize: 8, fontWeight: 700,
                  background: T.accent, color: "#fff",
                  padding: "1px 5px", borderRadius: 6,
                  letterSpacing: 0,
                }}>{badge}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab content (scrollable) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 0 8px" }}>

      {tab === "view" && (
        <>
          <SectionLabel>layers</SectionLabel>
          <Toggle on={layers.bigs} label={`${layout.bigLabel} (big)`} color="#A78BFA"
            onChange={v => setLayers(l => ({ ...l, bigs: v }))} />
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

          <SectionLabel>labels</SectionLabel>
          <LabelModeRow tierLabel={layout.bigLabel}   value={labelOpts.big}
            onChange={v => setLabelOpts(o => ({ ...o, big: v }))} />
          <LabelModeRow tierLabel={layout.midLabel}   value={labelOpts.mid}
            onChange={v => setLabelOpts(o => ({ ...o, mid: v }))} disabled={!layers.mids} />
          {layout.hasSmalls && (
            <LabelModeRow tierLabel={layout.smallLabel} value={labelOpts.small}
              onChange={v => setLabelOpts(o => ({ ...o, small: v }))} disabled={!layers.smalls} />
          )}
          {layout.hasAttrs && (
            <LabelModeRow tierLabel="Attributes" value={labelOpts.attr}
              onChange={v => setLabelOpts(o => ({ ...o, attr: v }))} disabled={!layers.attributes} />
          )}

          <SectionLabel action={
            <span
              onClick={() => setNodeSizes({ big: 1, mid: 1, small: 1, attr: 1 })}
              style={{ fontSize: 9, color: T.textMuted, cursor: "pointer",
                      fontFamily: T.fontMono, letterSpacing: ".1em" }}
              onMouseEnter={e => e.currentTarget.style.color = T.text}
              onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
            >reset</span>
          }>size</SectionLabel>
          <Slider label={layout.bigLabel} value={nodeSizes.big}
            min={0.3} max={3} step={0.1} formatValue={multFmt}
            onChange={v => setNodeSizes(s => ({ ...s, big: v }))} />
          <Slider label={layout.midLabel} value={nodeSizes.mid}
            min={0.3} max={3} step={0.1} formatValue={multFmt}
            disabled={!layers.mids}
            onChange={v => setNodeSizes(s => ({ ...s, mid: v }))} />
          {layout.hasSmalls && (
            <Slider label={layout.smallLabel} value={nodeSizes.small}
              min={0.3} max={3} step={0.1} formatValue={multFmt}
              disabled={!layers.smalls}
              onChange={v => setNodeSizes(s => ({ ...s, small: v }))} />
          )}
          {layout.hasAttrs && (
            <Slider label="Attributes" value={nodeSizes.attr}
              min={0.3} max={3} step={0.1} formatValue={multFmt}
              disabled={!layers.attributes}
              onChange={v => setNodeSizes(s => ({ ...s, attr: v }))} />
          )}
        </>
      )}

      {tab === "filter" && (
        <>
          <SectionLabel>search</SectionLabel>
          <SearchBox
            value={search}
            onChange={setSearch}
            results={searchResults}
            onResultClick={onSearchResultClick}
          />

          <SectionLabel action={
            activeFilterCount > 0 ? (
              <span
                onClick={() => setFilters(f => ({
                  ...f, bigs: null, mids: null, smalls: null, attrs: null, attrCats: null,
                }))}
                style={{
                  fontSize: 9, color: T.textMuted, cursor: "pointer",
                  fontFamily: T.fontMono, letterSpacing: ".1em",
                }}
                onMouseEnter={e => e.currentTarget.style.color = T.text}
                onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
              >clear all</span>
            ) : null
          }>{layout.bigLabel.toLowerCase()}s</SectionLabel>
          <MultiSelectList
            items={bigItems}
            selected={filters.bigs}
            onChange={setBigsFilter}
            maxHeight={140}
            query={bigQuery}
            onQuery={setBigQuery}
          />

          {layers.mids && (
            <>
              <SectionLabel>{layout.midLabel.toLowerCase()}s</SectionLabel>
              <MultiSelectList
                items={midItems}
                selected={filters.mids}
                onChange={setMidsFilter}
                maxHeight={160}
                query={midQuery}
                onQuery={setMidQuery}
              />
            </>
          )}

          {layout.hasSmalls && layers.smalls && (
            <>
              <SectionLabel>{layout.smallLabel.toLowerCase()}s</SectionLabel>
              <MultiSelectList
                items={smallItems}
                selected={filters.smalls}
                onChange={setSmallsFilter}
                maxHeight={170}
                query={smallQuery}
                onQuery={setSmallQuery}
              />
            </>
          )}

          {layout.hasAttrs && layers.attributes && (
            <>
              <SectionLabel>attributes</SectionLabel>
              <MultiSelectList
                items={attrItems}
                selected={filters.attrs}
                onChange={setAttrsFilter}
                maxHeight={180}
                query={attrQuery}
                onQuery={setAttrQuery}
              />
            </>
          )}
        </>
      )}

      {tab === "style" && (
        <>
          <SectionLabel>connections</SectionLabel>
          <SegmentedControl value={linesMode} onChange={setLinesMode} options={[
            { value: "off",  label: "off" },
            { value: "auto", label: "auto" },
            { value: "on",   label: "on" },
          ]} />
          {linesMode !== "off" && (
            <Slider label="Focus edges" value={lineOpacity}
              min={0} max={1} step={0.05} formatValue={pctFmt}
              onChange={setLineOpacity} />
          )}
          {linesMode === "on" && (
            <Slider label="All edges" value={allLinesOpacity}
              min={0} max={1} step={0.02} formatValue={pctFmt}
              onChange={setAllLinesOpacity} />
          )}

          <SectionLabel>rotation</SectionLabel>
          <Slider label="Speed" value={rotateSpeed}
            min={0.05} max={2} step={0.05} formatValue={multFmt}
            onChange={setRotateSpeed} />

          <div style={{
            marginTop: 12, padding: "8px 10px", borderTop: `1px solid ${T.borderHi}`,
          }}>
            <div
              onClick={onResetCustomization}
              style={{
                textAlign: "center", padding: "7px 8px",
                border: `1px solid ${T.borderHi}`, borderRadius: 4,
                fontSize: 10, fontFamily: T.fontMono,
                color: T.textMuted, letterSpacing: ".12em",
                cursor: "pointer", userSelect: "none",
                textTransform: "uppercase",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = T.text;
                e.currentTarget.style.borderColor = T.accent;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = T.textMuted;
                e.currentTarget.style.borderColor = T.borderHi;
              }}
            >↺ reset style</div>
          </div>
        </>
      )}

      </div>
      </>)}
    </div>
  );
}

function FocusHUD({ focused, layout }) {
  if (!focused) return (
    <div style={{
      position: "absolute", bottom: 16, left: 16, fontSize: 10,
      color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.65)", padding: "6px 10px",
      borderRadius: T.r_sm, userSelect: "none", zIndex: 10,
    }}>drag · scroll · click a node to see its pairings · wasd / zx to fly</div>
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
      <div style={{ fontSize: 13, color: T.text, wordBreak: "break-word" }}>
        {crumbs.map((c, i) => (
          <span key={i}>
            <span style={{ color: i === crumbs.length - 1 ? T.text : T.textSec }}>{c}</span>
            {i < crumbs.length - 1 && <span style={{ color: T.textMuted, margin: "0 6px" }}>›</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResetViewButton({ onReset, hasFocus }) {
  return (
    <div
      onClick={onReset}
      title="Reset view (Esc)"
      style={{
        background: "rgba(10,10,15,0.92)", border: `1px solid ${T.borderHi}`,
        borderRadius: T.r_md, padding: "10px 22px", cursor: "pointer",
        color: T.textSec, fontSize: 13, fontFamily: T.fontMono, fontWeight: 500,
        letterSpacing: ".18em", textTransform: "uppercase", userSelect: "none",
        transition: "color 120ms, border-color 120ms, transform 120ms",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = T.text;
        e.currentTarget.style.borderColor = T.accent;
        e.currentTarget.style.transform = "scale(1.04)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = T.textSec;
        e.currentTarget.style.borderColor = T.borderHi;
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      ⟲ reset view
    </div>
  );
}

// Auto-rotate pill. Visually matches ResetViewButton so the two sit in a
// cohesive toolbar. When rotation is active the icon spins and the border
// takes on the accent color; when paused it's muted. Primary interaction,
// not a configuration setting — belongs in the map, not the side panel.
function AutoRotateButton({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      title={on ? "Auto-rotate on (click to pause)" : "Auto-rotate off (click to resume)"}
      style={{
        background: "rgba(10,10,15,0.92)",
        border: `1px solid ${on ? T.accent : T.borderHi}`,
        borderRadius: T.r_md, padding: "10px 18px", cursor: "pointer",
        color: on ? T.text : T.textSec,
        fontSize: 13, fontFamily: T.fontMono, fontWeight: 500,
        letterSpacing: ".18em", textTransform: "uppercase", userSelect: "none",
        display: "flex", alignItems: "center", gap: 10,
        transition: "color 120ms, border-color 120ms, transform 120ms",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <span style={{
        fontSize: 16, color: on ? T.accent : T.textMuted,
        animation: on ? "hi-spin 2s linear infinite" : "none",
        display: "inline-block", lineHeight: 1,
      }}>↻</span>
      <span>{on ? "rotating" : "paused"}</span>
      <style>{`@keyframes hi-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Prominent "exit focus" pill — shown in the toolbar only while a node is
// focused. Different from "reset view": this only unfocuses (camera stays
// where the user left it), while Reset View also resets camera + filters.
// Tinted with the accent color so it visually announces itself as the
// primary escape hatch from focus mode (the user complained the old small
// × inside FocusHUD was easy to miss).
function ExitFocusButton({ onExit }) {
  return (
    <div
      onClick={onExit}
      title="Exit focus (Esc)"
      style={{
        background: "rgba(94,106,210,0.22)",
        border: `1px solid ${T.accent}`,
        borderRadius: T.r_md, padding: "10px 20px", cursor: "pointer",
        color: T.text, fontSize: 13, fontFamily: T.fontMono, fontWeight: 600,
        letterSpacing: ".18em", textTransform: "uppercase", userSelect: "none",
        display: "flex", alignItems: "center", gap: 10,
        transition: "background 120ms, transform 120ms, box-shadow 120ms",
        boxShadow: "0 4px 20px rgba(94,106,210,0.35)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(94,106,210,0.38)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(94,106,210,0.22)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>×</span>
      <span>exit focus</span>
    </div>
  );
}

// Grouped floating toolbar at the bottom of the map. When focused, the
// EXIT FOCUS pill gets prime (leftmost) placement — that's the primary
// action users want while exploring a node. Auto-rotate and Reset View
// remain always-visible to the right.
function MapToolbar({ autoRotate, onToggleAutoRotate, onReset, hasFocus, onExitFocus }) {
  return (
    <div style={{
      position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
      display: "flex", gap: 12, alignItems: "center", zIndex: 10,
    }}>
      {hasFocus && <ExitFocusButton onExit={onExitFocus} />}
      <AutoRotateButton on={autoRotate} onToggle={onToggleAutoRotate} />
      <ResetViewButton onReset={onReset} hasFocus={hasFocus} />
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
    bigs: true,
    mids: true,
    smalls: layout.hasSmalls && categoryId === "microstyles",
    attributes: layout.hasAttrs,
  });
  const [focused, setFocused] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState(-1);      // index into focus-lines
  const [hoveredAllEdgeIdx, setHoveredAllEdgeIdx] = useState(-1); // index into allEdges
  const [linesMode, setLinesMode] = useState("auto");   // "off" | "auto" | "on"
  const [autoRotate, setAutoRotate] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const [resetCount, setResetCount] = useState(0);

  // Filtering panel — multi-select membership sets. `null` = all shown
  // (no filter). Explicit `Set` = only those values pass the filter. An
  // empty Set means "show nothing at this tier", which is a valid state.
  //   bigs:     Set<string> of genre/family/hub names to keep
  //   mids:     Set<string> of sub/item names to keep
  //   attrCats: Set<string> of attribute category ids (moods / grooves …)
  const [filters, setFilters] = useState({ bigs: null, mids: null, smalls: null, attrCats: null, attrs: null });
  const [search, setSearch] = useState("");

  // ── Fine-grain customization ─────────────────────────────────────
  // All visual parameters are state-driven so the user can tune the map
  // to their preference. Defaults match the pre-customization look.
  const [nodeSizes, setNodeSizes] = useState({ big: 1.0, mid: 1.0, small: 1.0, attr: 1.0 });
  const [labelOpts, setLabelOpts] = useState({
    big:   "on",    // genres — always on by default (only 18 of them)
    mid:   "auto",  // subgenres — auto fades to close ones
    small: "auto",  // microstyles
    attr:  "auto",  // attributes
  });
  const [lineOpacity, setLineOpacity] = useState(1.0);   // 0 = invisible, 1 = full
  const [allLinesOpacity, setAllLinesOpacity] = useState(0.08); // base for "on" mode
  const [rotateSpeed, setRotateSpeed] = useState(0.18);  // very slow — full rotation ~5 min
  const [bgStars, setBgStars] = useState({ on: true, count: 2000, speed: 0.2 });

  const controlsRef = useRef();
  const interactionTimer = useRef(null);
  // Paired with a React state — the ref is read in useFrame every tick
  // (zero re-render cost), the state is what OrbitControls' `autoRotate`
  // prop reads so React knows to pause the orbit when a lerp is active.
  // Without the state half, auto-rotate would keep rotating the camera
  // around the target while the lerp tries to hold it at destPos, and
  // the two would fight forever — that's what causes the "jitters in
  // and out" video the user reported.
  const cameraAnimatingRef = useRef(false);
  const [cameraAnimating, setCameraAnimating] = useState(false);
  const syncCameraAnimating = (v) => {
    if (cameraAnimatingRef.current === v) return;
    cameraAnimatingRef.current = v;
    setCameraAnimating(v);
  };

  // Keyboard-flight key tracker: a Set of canonical lowercase keys
  // currently held down. We key on `e.code` (physical key position,
  // layout-agnostic: W is always "KeyW" regardless of Hebrew / QWERTY
  // / AZERTY) and not `e.key`, which on a Hebrew keyboard yields "'"
  // instead of "w" and broke flight entirely. We ignore key events
  // originating in inputs / textareas / contenteditable regions so
  // typing into the search or filter boxes doesn't drift the camera.
  const keyboardMoveRef = useRef(new Set());
  useEffect(() => {
    const CODE_TO_KEY = {
      KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", KeyX: "x", KeyZ: "z",
    };
    const isTextTarget = (t) => {
      if (!t) return false;
      const tag = (t.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || t.isContentEditable;
    };
    const onKeyDown = (e) => {
      if (isTextTarget(e.target)) return;
      const mapped = CODE_TO_KEY[e.code];
      if (!mapped) return;
      keyboardMoveRef.current.add(mapped);
      e.preventDefault();
    };
    const onKeyUp = (e) => {
      const mapped = CODE_TO_KEY[e.code];
      if (mapped && keyboardMoveRef.current.has(mapped)) {
        keyboardMoveRef.current.delete(mapped);
      }
    };
    const onBlur = () => keyboardMoveRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Right-click-to-copy: writes the clicked node's name to the system
  // clipboard and flashes a small toast so the user knows it worked.
  // `t` is a timestamp used as a key so rapid successive copies don't
  // cancel each other's toast with a stale clear-timer.
  const [copyToast, setCopyToast] = useState(null);
  const copyNodeName = (name) => {
    if (!name) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(name).catch(() => {});
    }
    setCopyToast({ text: name, t: Date.now() });
  };
  useEffect(() => {
    if (!copyToast) return;
    const timer = setTimeout(() => {
      setCopyToast(curr => curr?.t === copyToast.t ? null : curr);
    }, 1500);
    return () => clearTimeout(timer);
  }, [copyToast]);
  // Live-position map: smalls orbit around their parents via useFrame, so
  // their world-space position changes every frame. Anything that draws
  // geometry connecting TO a small (focus lines, ON-mode edges) needs to
  // follow the small or the lines will dangle in empty space.
  //
  // SmallNodes writes to this Map each frame (key: "grandparent/parent/name"
  // → [x,y,z]); InteractiveEdges reads from it each frame to update the
  // batched LineSegments2 buffer in place. No re-render cost — the only
  // per-frame work is the buffer write on affected segments.
  const livePosRef = useRef(new Map());

  // Reset when switching categories
  useEffect(() => {
    setFocused(null);
    setHovered(null);
    setLayers({
      bigs: true,
      mids: true,
      smalls: layout.hasSmalls,
      attributes: layout.hasAttrs,
    });
    setLinesMode("auto");
    setAutoRotate(true);
    setFilters({ bigs: null, mids: null, smalls: null, attrCats: null, attrs: null });
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
  // ── Focus override sets ──────────────────────────────────────────
  // When a node is focused, its related neighbourhood (parents,
  // children, attrs) should remain visible even when filters would
  // normally hide them — otherwise the focus view shows lines leading
  // to empty space where the hidden node WOULD be. Keys:
  //   bigs  → Set of big names
  //   mids  → Set of "parent/name"
  //   smalls → Set of smallKey(s)
  //   attrs → Set of "categoryId:name"
  const focusOverride = useMemo(() => {
    if (!focused) return null;
    const bigs = new Set();
    const mids = new Set();
    const smalls = new Set();
    const attrs = new Set();

    if (focused.kind === "big") {
      bigs.add(focused.name);
      for (const m of layout.mids) {
        if (m.parent === focused.name) {
          mids.add(`${m.parent}/${m.name}`);
          if (layout.midToAttrs) {
            (layout.midToAttrs(m) || []).forEach(r => {
              if (r?.node) attrs.add(`${r.node.categoryId}:${r.node.name}`);
            });
          }
        }
      }
      for (const s of layout.smalls) {
        if (s.grandparent === focused.name) smalls.add(smallKey(s));
      }
      if (layout.bigAttrEdges) {
        (layout.bigAttrEdges(focused) || []).forEach(r => {
          if (r?.node) attrs.add(`${r.node.categoryId}:${r.node.name}`);
        });
      }
    } else if (focused.kind === "mid") {
      bigs.add(focused.parent);
      mids.add(`${focused.parent}/${focused.name}`);
      for (const s of layout.smalls) {
        if (s.parent === focused.name && s.grandparent === focused.parent) smalls.add(smallKey(s));
      }
      if (layout.midToAttrs) {
        (layout.midToAttrs(focused) || []).forEach(r => {
          if (r?.node) attrs.add(`${r.node.categoryId}:${r.node.name}`);
        });
      }
    } else if (focused.kind === "small") {
      bigs.add(focused.grandparent);
      mids.add(`${focused.grandparent}/${focused.parent}`);
      smalls.add(smallKey(focused));
      if (layout.midToAttrs) {
        const parent = layout.midsByKey?.[focused.parent + "/" + focused.grandparent] ||
          layout.mids.find(m => m.name === focused.parent && m.parent === focused.grandparent);
        if (parent) {
          (layout.midToAttrs(parent) || []).slice(0, 3).forEach(r => {
            if (r?.node) attrs.add(`${r.node.categoryId}:${r.node.name}`);
          });
        }
      }
    } else if (focused.kind === "attribute") {
      attrs.add(`${focused.categoryId}:${focused.name}`);
      // Complement attrs (cross-attr relations from complTable)
      const cat = ATTR_CAT_BY_ID[focused.categoryId];
      if (cat && cat.complTable && layout.data) {
        const table = layout.data[cat.complTable] || {};
        const entry = table[focused.name];
        if (entry && typeof entry === "object") {
          Object.entries(entry).forEach(([field, values]) => {
            const tgt = COMP_FIELD_TO_CAT[field];
            if (!tgt || !Array.isArray(values)) return;
            values.forEach(val => attrs.add(`${tgt}:${val}`));
          });
        }
      }
      // Mids that reference this attr
      if (layout.attrToMids) {
        (layout.attrToMids(focused, 15) || []).forEach(m => {
          mids.add(`${m.parent}/${m.name}`);
          bigs.add(m.parent);
        });
      }
    }
    return { bigs, mids, smalls, attrs };
  }, [focused, layout]);

  // ── Visible lists (filters applied, with focus overrides) ────────
  const visibleBigs = useMemo(() => {
    if (!filters.bigs) return layout.bigs;
    return layout.bigs.filter(b =>
      filters.bigs.has(b.name) || focusOverride?.bigs.has(b.name)
    );
  }, [layout.bigs, filters.bigs, focusOverride]);

  const visibleMids = useMemo(() => {
    const keep = (m) => {
      if (filters.bigs && !filters.bigs.has(m.parent) &&
          !focusOverride?.mids.has(`${m.parent}/${m.name}`)) return false;
      if (filters.mids && !filters.mids.has(m.name) &&
          !focusOverride?.mids.has(`${m.parent}/${m.name}`)) return false;
      return true;
    };
    return layout.mids.filter(keep);
  }, [layout.mids, filters.bigs, filters.mids, focusOverride]);

  const visibleSmalls = useMemo(() => {
    const keep = (s) => {
      const sk = smallKey(s);
      const overrideHit = focusOverride?.smalls.has(sk);
      if (filters.bigs && !filters.bigs.has(s.grandparent) && !overrideHit) return false;
      if (filters.mids && !filters.mids.has(s.parent) && !overrideHit) return false;
      if (filters.smalls && !filters.smalls.has(sk) && !overrideHit) return false;
      return true;
    };
    return layout.smalls.filter(keep);
  }, [layout.smalls, filters.bigs, filters.mids, filters.smalls, focusOverride]);

  const visibleAttributes = useMemo(() => {
    const keep = (a) => {
      const ak = attrKey(a);
      const overrideHit = focusOverride?.attrs.has(ak);
      if (filters.attrCats && !filters.attrCats.has(a.categoryId) && !overrideHit) return false;
      if (filters.attrs && !filters.attrs.has(ak) && !overrideHit) return false;
      return true;
    };
    return layout.attributes.filter(keep);
  }, [layout.attributes, filters.attrCats, filters.attrs, focusOverride]);

  // ── Rendered lists (what actually gets drawn) ─────────────────────
  // Layer toggles normally hide a tier, with ONE universal exception:
  // anything that the current focus "reaches" (through focusOverride)
  // stays visible no matter what. This matches the user's stated rule:
  //   "if a star has an active connection to the focus, or is the focus
  //    itself, show it — regardless of layer toggles or filter state."
  // When no focus is active and a tier's layer is off, that tier just
  // renders nothing. When layer is on, we render everything visibleX
  // already allows (filter + focus override mixed in).
  const renderedBigs = useMemo(() => {
    if (layers.bigs) return visibleBigs;
    if (!focusOverride) return [];
    return visibleBigs.filter(b => focusOverride.bigs.has(b.name));
  }, [layers.bigs, visibleBigs, focusOverride]);

  const renderedMids = useMemo(() => {
    if (layers.mids) return visibleMids;
    if (!focusOverride) return [];
    return visibleMids.filter(m => focusOverride.mids.has(`${m.parent}/${m.name}`));
  }, [layers.mids, visibleMids, focusOverride]);

  const renderedSmalls = useMemo(() => {
    if (!layout.hasSmalls) return [];
    if (layers.smalls) return visibleSmalls;
    if (!focusOverride) return [];
    return visibleSmalls.filter(s => focusOverride.smalls.has(smallKey(s)));
  }, [layout.hasSmalls, layers.smalls, visibleSmalls, focusOverride]);

  const renderedAttributes = useMemo(() => {
    if (!layout.hasAttrs) return [];
    if (layers.attributes) return visibleAttributes;
    if (!focusOverride) return [];
    return visibleAttributes.filter(a => focusOverride.attrs.has(attrKey(a)));
  }, [layout.hasAttrs, layers.attributes, visibleAttributes, focusOverride]);

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
    const prefix = [], sub = [];
    for (const item of searchIndex) {
      const n = item.name.toLowerCase();
      if (n === q) prefix.unshift(item);
      else if (n.startsWith(q)) prefix.push(item);
      else if (n.includes(q)) sub.push(item);
    }
    return [...prefix, ...sub].slice(0, 12);
  }, [search, searchIndex]);

  const lines = useMemo(() => focusLines(focused, layout), [focused, layout]);

  // Pre-compute "who is related to the currently-focused node" sets so the
  // per-frame scale/dim loop inside each tier doesn't call expensive layout
  // lookups 1000× per frame. Big perf win when focus sits on an attribute
  // with many mid relations, or on a big with many attr edges.
  const relatedMidSet = useMemo(() => {
    if (!focused || focused.kind !== "attribute") return null;
    if (!layout.attrToMids) return null;
    const s = new Set();
    (layout.attrToMids(focused, 9999) || []).forEach(m => s.add(`${m.parent}/${m.name}`));
    return s;
  }, [focused, layout]);

  const relatedAttrSet = useMemo(() => {
    if (!focused) return null;
    const s = new Set();
    if (focused.kind === "mid" && layout.midToAttrs) {
      (layout.midToAttrs(focused) || []).forEach(r => s.add(`${r.node.categoryId}:${r.node.name}`));
    } else if (focused.kind === "big" && layout.bigAttrEdges) {
      (layout.bigAttrEdges(focused) || []).forEach(r => s.add(`${r.node.categoryId}:${r.node.name}`));
    }
    return s;
  }, [focused, layout]);

  const allEdges = useMemo(() => {
    const out = [];
    // Use renderedX so edges are drawn ONLY when both endpoints will
    // actually show on screen. When a tier's layer toggle is off we
    // effectively erase every edge that touches that tier (except the
    // focus lineage, which renderedX keeps alive). Previously edges
    // were built off visibleX, which ignored layer toggles entirely —
    // and the result was dozens of "ghost lines" shooting out from
    // bigs to empty space when user turned mid/small off.
    const renderedBigNames = new Set(renderedBigs.map(b => b.name));
    const renderedMidKey  = new Set(renderedMids.map(m => `${m.parent}/${m.name}`));
    const renderedSmallKey = new Set(renderedSmalls.map(s => smallKey(s)));
    const renderedAttrKey = new Set(renderedAttributes.map(a => `${a.categoryId}:${a.name}`));

    for (const m of renderedMids) {
      const parent = layout.bigByName?.[m.parent];
      if (!parent?.pos || !m.pos) continue;
      if (!renderedBigNames.has(parent.name)) continue;
      out.push({
        from: parent.pos, to: m.pos,
        color: blendHex(parent.color, m.color),
        fromNode: { ...parent, kind: "big" }, toNode: { ...m, kind: "mid" },
      });
    }
    if (layout.hasSmalls && renderedSmalls.length) {
      const midLookup = (sName, gName) =>
        layout.midsByKey?.[sName + "/" + gName] ||
        layout.midsByKey?.[sName] ||
        layout.mids.find(x => x.name === sName && (!gName || x.parent === gName));
      for (const s of renderedSmalls) {
        const parent = midLookup(s.parent, s.grandparent);
        if (!parent?.pos || !s.pos) continue;
        if (!renderedMidKey.has(`${parent.parent}/${parent.name}`)) continue;
        out.push({
          from: parent.pos, to: s.pos,
          color: blendHex(parent.color, s.color),
          fromNode: { ...parent, kind: "mid" }, toNode: { ...s, kind: "small" },
        });
      }
    }
    // Attribute edges — driven from the ATTR side (per-attribute cap
    // instead of per-mid). The previous approach iterated every mid's
    // top-3 attrs, which meant an attr at rank 4+ under all its mids
    // got edge-less. That produced the "floating attribute star"
    // effect even though the attr had many real relationships (visible
    // when you focused on it). Now each visible attr independently
    // picks up to ATTR_EDGE_CAP_MID edges to the mids that reference
    // it, guaranteeing every attr shows a realistic cluster of
    // connections. A small per-big cap adds genre-level connections
    // for attrs that associate aggregated at that level.
    if (layout.hasAttrs && renderedAttributes.length) {
      const ATTR_EDGE_CAP_MID = 8;   // edges per attr to its referencing mids
      const BIG_ATTR_CAP      = 3;   // additional edges per big's top attrs
      const emittedEdgeKey = new Set();

      if (layout.attrToMids) {
        for (const a of renderedAttributes) {
          if (!a.pos) continue;
          // Fetch up to 3× the cap so we have filler when some users are
          // hidden (due to bigs/mids filter state) — we only actually
          // draw up to the cap from the VISIBLE ones.
          const users = layout.attrToMids(a, ATTR_EDGE_CAP_MID * 3) || [];
          let drawn = 0;
          for (const u of users) {
            if (drawn >= ATTR_EDGE_CAP_MID) break;
            if (!u?.pos) continue;
            if (!renderedMidKey.has(`${u.parent}/${u.name}`)) continue;
            const ek = `mid/${u.parent}/${u.name}::${a.categoryId}:${a.name}`;
            if (emittedEdgeKey.has(ek)) continue;
            emittedEdgeKey.add(ek);
            out.push({
              from: u.pos, to: a.pos,
              color: blendHex(u.color, a.color),
              fromNode: { ...u, kind: "mid" },
              toNode:   { ...a, kind: "attribute" },
            });
            drawn++;
          }
        }
      }

      // Per-big contribution: attrs that bigAttrEdges ranks highly for
      // each genre get an extra genre-level line. This gives "genre
      // hub" attrs (e.g. a mood dominant across an entire family) a
      // visible link to the big node even when they're already
      // connected to several of that big's mids.
      if (layout.bigAttrEdges) {
        const attrByKey = new Map(renderedAttributes.map(a => [`${a.categoryId}:${a.name}`, a]));
        for (const b of renderedBigs) {
          const bAttrs = layout.bigAttrEdges(b) || [];
          let added = 0;
          for (const { node, cat } of bAttrs) {
            if (added >= BIG_ATTR_CAP) break;
            if (!node?.pos) continue;
            const k = `${node.categoryId}:${node.name}`;
            if (!renderedAttrKey.has(k)) continue;
            const attrNode = attrByKey.get(k) || node;
            const ek = `big/${b.name}::${k}`;
            if (emittedEdgeKey.has(ek)) continue;
            emittedEdgeKey.add(ek);
            const attrColor = (cat?.color) || attrNode.color;
            out.push({
              from: b.pos, to: attrNode.pos,
              color: blendHex(b.color, attrColor),
              fromNode: { ...b, kind: "big" },
              toNode:   { ...attrNode, kind: "attribute" },
            });
            added++;
          }
        }
      }

      // Final safety net: any rendered attr that still has no edge
      // (very rare — means no referencing mid is rendered AND no big
      // lists it) gets one big-fallback edge so it isn't left
      // completely disconnected.
      const attrHasEdge = new Set();
      for (const e of out) {
        if (e.toNode?.kind === "attribute") {
          attrHasEdge.add(`${e.toNode.categoryId}:${e.toNode.name}`);
        }
        if (e.fromNode?.kind === "attribute") {
          attrHasEdge.add(`${e.fromNode.categoryId}:${e.fromNode.name}`);
        }
      }

      // Complement edges (attr ↔ attr): two attrs that the complement
      // tables list as "pair well together" get a line between them.
      // Essential for categories with `giField: null` (vocalists,
      // lyrical) — those NEVER appear in any mid's GI entry, so the
      // per-attr → mid pass above returns nothing for them and they'd
      // float alone. Complement tables are their only connection
      // source. We also use these for any attr in other categories
      // that happened to miss the mid-cap cutoff. Cap per-attr to 3
      // complements so the map doesn't turn into a web.
      if (layout.data) {
        const renderedAttrByKey = new Map(renderedAttributes.map(a => [`${a.categoryId}:${a.name}`, a]));
        for (const a of renderedAttributes) {
          if (!a.pos) continue;
          const cat = ATTR_CAT_BY_ID[a.categoryId];
          if (!cat?.complTable) continue;
          const table = layout.data[cat.complTable] || {};
          const entry = table[a.name];
          if (!entry || typeof entry !== "object") continue;
          let added = 0;
          for (const [field, values] of Object.entries(entry)) {
            if (added >= 3) break;
            const tgt = COMP_FIELD_TO_CAT[field];
            if (!tgt || !Array.isArray(values)) continue;
            for (const val of values) {
              if (added >= 3) break;
              const otherKey = `${tgt}:${val}`;
              const other = renderedAttrByKey.get(otherKey);
              if (!other?.pos) continue;
              // Dedup: only draw in one direction (a→other), never both.
              const ek1 = `cmpl/${a.categoryId}:${a.name}::${otherKey}`;
              const ek2 = `cmpl/${otherKey}::${a.categoryId}:${a.name}`;
              if (emittedEdgeKey.has(ek1) || emittedEdgeKey.has(ek2)) continue;
              emittedEdgeKey.add(ek1);
              out.push({
                from: a.pos, to: other.pos,
                color: blendHex(a.color, other.color),
                fromNode: { ...a, kind: "attribute" },
                toNode:   { ...other, kind: "attribute" },
              });
              attrHasEdge.add(`${a.categoryId}:${a.name}`);
              attrHasEdge.add(otherKey);
              added++;
            }
          }
        }
      }

      if (layout.bigAttrEdges) {
        for (const a of renderedAttributes) {
          const k = `${a.categoryId}:${a.name}`;
          if (attrHasEdge.has(k)) continue;
          if (!a.pos) continue;
          for (const b of renderedBigs) {
            const bAttrs = layout.bigAttrEdges(b) || [];
            const hit = bAttrs.some(r => r.node?.categoryId === a.categoryId && r.node?.name === a.name);
            if (hit) {
              out.push({
                from: b.pos, to: a.pos,
                color: blendHex(b.color, a.color),
                fromNode: { ...b, kind: "big" },
                toNode:   { ...a, kind: "attribute" },
              });
              attrHasEdge.add(k);
              break;
            }
          }
        }
      }
    }
    return out;
  }, [renderedBigs, renderedMids, renderedSmalls, renderedAttributes, layout]);

  const selectBig   = b => setFocused({ kind: "big",       name: b.name, pos: b.pos });
  const selectMid   = s => setFocused({ kind: "mid",       name: s.name, parent: s.parent, pos: s.pos });
  const selectSmall = m => setFocused({ kind: "small",     name: m.name, parent: m.parent, grandparent: m.grandparent, pos: m.pos });
  const selectAttr  = a => setFocused({ kind: "attribute", name: a.name, label: a.label, categoryId: a.categoryId, pos: a.pos });

  // Edge click — go to the OTHER endpoint if we're focused on one side,
  // otherwise (general view) pick one at random. Keeps navigation fluid.
  const clickEdge = (edge) => {
    if (!edge?.fromNode || !edge?.toNode) return;
    let target;
    if (focused) {
      const sameAsFocused = (n) =>
        n && n.kind === focused.kind && n.name === focused.name &&
        (focused.kind !== "mid"   || n.parent === focused.parent) &&
        (focused.kind !== "small" || (n.parent === focused.parent && n.grandparent === focused.grandparent)) &&
        (focused.kind !== "attribute" || n.categoryId === focused.categoryId);
      target = sameAsFocused(edge.fromNode) ? edge.toNode : edge.fromNode;
    } else {
      target = Math.random() < 0.5 ? edge.fromNode : edge.toNode;
    }
    if (!target) return;
    if (target.kind === "big")        selectBig(target);
    else if (target.kind === "mid")   selectMid(target);
    else if (target.kind === "small") selectSmall(target);
    else if (target.kind === "attribute") selectAttr(target);
  };

  const handleReset = () => {
    setFocused(null);
    setFilters({ bigs: null, mids: null, smalls: null, attrCats: null, attrs: null });
    setSearch("");
    setResetCount(c => c + 1);
    // Pause auto-rotate briefly so the reset lerp doesn't tug-of-war with
    // the OrbitControls rotating the camera around the target. Without this,
    // reset visibly jitters back and forth.
    setInteracting(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setInteracting(false), 1800);
  };

  const handleResetCustomization = () => {
    setNodeSizes({ big: 1.0, mid: 1.0, small: 1.0, attr: 1.0 });
    setLabelOpts({ big: "on", mid: "auto", small: "auto", attr: "auto" });
    setLineOpacity(1.0);
    setAllLinesOpacity(0.08);
    setRotateSpeed(0.18);
    setBgStars({ on: true, count: 2000, speed: 0.2 });
  };

  const handleSearchResultClick = (item) => {
    setSearch("");
    const n = item.node;

    // Collect attributes related to the picked node so we can narrow the
    // attribute filter too. Without this, picking a genre correctly hid
    // unrelated bigs/mids/smalls but left all 224 attribute stars still
    // glowing around the map — the "unrelated lit stars" the user
    // reported.
    const relatedAttrs = new Set();
    const pushRel = (r) => { if (r?.node) relatedAttrs.add(attrKey(r.node)); };
    if (item.kind === "big") {
      if (layout.bigAttrEdges) (layout.bigAttrEdges(n) || []).forEach(pushRel);
      if (layout.midToAttrs) {
        for (const m of layout.mids) {
          if (m.parent === n.name) (layout.midToAttrs(m) || []).forEach(pushRel);
        }
      }
    } else if (item.kind === "mid") {
      if (layout.midToAttrs) (layout.midToAttrs(n) || []).forEach(pushRel);
    } else if (item.kind === "small") {
      const parent =
        layout.midsByKey?.[n.parent + "/" + n.grandparent] ||
        layout.mids.find(m => m.name === n.parent && m.parent === n.grandparent);
      if (parent && layout.midToAttrs) (layout.midToAttrs(parent) || []).forEach(pushRel);
    }

    // Always rewire filters to the picked item + its subtree. Previously
    // we only did this when the user hadn't customized anything yet —
    // which meant the first pick narrowed correctly, but a SECOND pick
    // (now that filters are no longer empty) just moved the focus
    // highlight while the old subtree stayed on screen. We also clear
    // downstream filters so stale levels from a previous narrow don't
    // linger (e.g. first pick narrowed mids to {Afro Drill}; user then
    // picks Hip-Hop — without `mids: null`, visibleMids would stay
    // pinned to Afro Drill under the broader scope).
    if (item.kind === "big") {
      setFilters(f => ({
        ...f,
        bigs: new Set([n.name]),
        mids: null, smalls: null,
        attrCats: null,
        attrs: relatedAttrs,
      }));
    } else if (item.kind === "mid") {
      setFilters(f => ({
        ...f,
        bigs: new Set([n.parent]),
        mids: new Set([n.name]),
        smalls: null,
        attrCats: null,
        attrs: relatedAttrs,
      }));
    } else if (item.kind === "small") {
      setFilters(f => ({
        ...f,
        bigs:   new Set([n.grandparent]),
        mids:   new Set([n.parent]),
        smalls: new Set([smallKey(n)]),
        attrCats: null,
        attrs: relatedAttrs,
      }));
    } else {
      // Attribute pick: narrow attrCats + attrs to just that attribute.
      // We don't touch bigs/mids/smalls because attributes cross-cut the
      // genre tree — the focus highlight will light up what connects.
      setFilters(f => ({
        ...f,
        attrCats: new Set([n.categoryId]),
        attrs:    new Set([attrKey(n)]),
      }));
    }

    if (item.kind === "big") selectBig(item.node);
    else if (item.kind === "mid") selectMid(item.node);
    else if (item.kind === "small") selectSmall(item.node);
    else selectAttr(item.node);
  };

  // Pause auto-rotate only on actual drag (pointer down), NOT on scroll/wheel.
  // OrbitControls' start/end events fire for zoom-wheel too, which is annoying
  // when user just wants to zoom without losing the rotation.
  const onCanvasPointerDown = (e) => {
    // Left click or any touch triggers drag. Right-click / middle-click pass through.
    if (e.button !== 0 && e.pointerType !== "touch") return;
    setInteracting(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
  };
  const onCanvasPointerUp = () => {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setInteracting(false), 1500);
  };

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100dvh", minHeight: 500, background: "radial-gradient(ellipse at center, #0A0A14 0%, #04040B 70%)", overflow: "hidden" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [0, 15, 130], fov: 50, near: 0.1, far: 800 }}
        dpr={[1, 2]}
        onPointerDown={onCanvasPointerDown}
        onPointerUp={onCanvasPointerUp}
      >
        <color attach="background" args={["#04040B"]} />
        <ambientLight intensity={0.90} />
        <pointLight position={[0, 0, 0]} intensity={1.75} distance={260} color="#9aa8ff" />
        <pointLight position={[80, 40, 40]} intensity={0.875} distance={200} color="#ffd6a8" />

        <Suspense fallback={null}>
          {bgStars.on && bgStars.count > 0 && (
            <Stars radius={300} depth={90} count={bgStars.count} factor={6} saturation={0.15} fade speed={bgStars.speed} />
          )}

          {renderedBigs.length > 0 && (
            <BigNodes bigs={renderedBigs} focused={focused} layout={layout} onSelect={selectBig} onHover={setHovered} onCopy={copyNodeName}
                      sizeMult={nodeSizes.big} />
          )}

          {renderedMids.length > 0 && (
            <MidNodes mids={renderedMids} focused={focused} layout={layout} onSelect={selectMid} onHover={setHovered} onCopy={copyNodeName}
                      sizeMult={nodeSizes.mid} relatedMidSet={relatedMidSet} />
          )}

          {renderedSmalls.length > 0 && (
            <SmallNodes smalls={renderedSmalls} focused={focused} layout={layout} onSelect={selectSmall} onHover={setHovered} onCopy={copyNodeName}
                        sizeMult={nodeSizes.small} livePosRef={livePosRef} />
          )}

          {renderedAttributes.length > 0 && (
            <AttributeNodes attributes={renderedAttributes} focused={focused} layout={layout} onSelect={selectAttr} onHover={setHovered} onCopy={copyNodeName}
                            sizeMult={nodeSizes.attr} relatedAttrSet={relatedAttrSet} />
          )}

          {/* Labels — one NodeLabels instance per tier. Renders independently
              of the meshes so a hidden layer still can't show ghost labels. */}
          {renderedBigs.length > 0 && labelOpts.big !== "off" && (
            <NodeLabels items={renderedBigs} mode={labelOpts.big} tier="big"
                        focused={focused} livePosRef={livePosRef} />
          )}
          {renderedMids.length > 0 && labelOpts.mid !== "off" && (
            <NodeLabels items={renderedMids} mode={labelOpts.mid} tier="mid"
                        focused={focused} livePosRef={livePosRef} />
          )}
          {renderedSmalls.length > 0 && labelOpts.small !== "off" && (
            <NodeLabels items={renderedSmalls} mode={labelOpts.small} tier="small"
                        focused={focused} livePosRef={livePosRef} />
          )}
          {renderedAttributes.length > 0 && labelOpts.attr !== "off" && (
            <NodeLabels items={renderedAttributes} mode={labelOpts.attr} tier="attr"
                        focused={focused} livePosRef={livePosRef} />
          )}

          {linesMode === "on" && (
            <InteractiveEdges
              edges={allEdges}
              opacity={allLinesOpacity}
              hoveredIndex={hoveredAllEdgeIdx}
              onHoverEdge={setHoveredAllEdgeIdx}
              onClickEdge={clickEdge}
              widthBase={2.2}
              widthHover={4.0}
              livePosRef={livePosRef}
            />
          )}
          {linesMode !== "off" && focused && (
            <InteractiveEdges
              edges={lines}
              opacity={lineOpacity}
              hoveredIndex={hoveredEdgeIdx}
              onHoverEdge={setHoveredEdgeIdx}
              onClickEdge={clickEdge}
              widthBase={4.0}
              widthHover={7.0}
              livePosRef={livePosRef}
            />
          )}
          <EdgeTooltip
            edge={
              hoveredEdgeIdx    >= 0 ? lines[hoveredEdgeIdx] :
              hoveredAllEdgeIdx >= 0 ? allEdges[hoveredAllEdgeIdx] :
              null
            }
            focused={focused}
          />}

          <HoverTooltip hovered={hovered} focused={focused} livePosRef={livePosRef} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enableDamping dampingFactor={0.07}
          minDistance={2} maxDistance={260}
          rotateSpeed={0.55} zoomSpeed={0.9} panSpeed={0.6}
          autoRotate={autoRotate && !interacting && !cameraAnimating} autoRotateSpeed={rotateSpeed}
          onStart={() => { syncCameraAnimating(false); }}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null }}
        />
        <CameraRig focusTarget={focused} resetCount={resetCount} controlsRef={controlsRef} animatingRef={cameraAnimatingRef} syncAnimating={syncCameraAnimating} />
        <FreeFlightNav controlsRef={controlsRef} keysDownRef={keyboardMoveRef} syncAnimating={syncCameraAnimating} />
      </Canvas>

      <LayerPanel
        layers={layers} setLayers={setLayers} layout={layout}
        linesMode={linesMode} setLinesMode={setLinesMode}
        filters={filters} setFilters={setFilters}
        search={search} setSearch={setSearch}
        searchResults={searchResults}
        onSearchResultClick={handleSearchResultClick}
        nodeSizes={nodeSizes} setNodeSizes={setNodeSizes}
        labelOpts={labelOpts} setLabelOpts={setLabelOpts}
        lineOpacity={lineOpacity} setLineOpacity={setLineOpacity}
        allLinesOpacity={allLinesOpacity} setAllLinesOpacity={setAllLinesOpacity}
        rotateSpeed={rotateSpeed} setRotateSpeed={setRotateSpeed}
        onResetCustomization={handleResetCustomization}
      />
      <StatsBadge layout={layout} focused={focused} />
      <MapToolbar
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate(v => !v)}
        onReset={handleReset}
        hasFocus={!!focused}
        onExitFocus={() => setFocused(null)}
      />
      <FocusHUD focused={focused} layout={layout} />
      {copyToast && (
        <div
          key={copyToast.t}
          style={{
            position: "absolute", top: 58, left: "50%", transform: "translateX(-50%)",
            background: "rgba(94,106,210,0.96)",
            border: `1px solid ${T.accent}`,
            color: "#fff", fontFamily: T.fontMono, fontSize: 12, fontWeight: 600,
            letterSpacing: ".04em",
            padding: "8px 14px", borderRadius: T.r_md,
            boxShadow: "0 6px 24px rgba(94,106,210,0.5)",
            zIndex: 30, whiteSpace: "nowrap", maxWidth: "70vw",
            overflow: "hidden", textOverflow: "ellipsis",
            pointerEvents: "none",
            animation: "hi-copytoast 1500ms ease-out forwards",
          }}
        >
          ✓ copied&nbsp;&nbsp;<span style={{ fontWeight: 500, opacity: 0.92 }}>"{copyToast.text}"</span>
          <style>{`
            @keyframes hi-copytoast {
              0%   { opacity: 0; transform: translate(-50%, -6px); }
              12%  { opacity: 1; transform: translate(-50%, 0); }
              78%  { opacity: 1; transform: translate(-50%, 0); }
              100% { opacity: 0; transform: translate(-50%, -3px); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
