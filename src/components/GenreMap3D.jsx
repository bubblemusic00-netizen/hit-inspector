import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instances, Instance, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { T } from "../theme.js";

/* ═══════════════════════════════════════════════════════════════════
 * GenreMap3D — v2
 *
 * Three regions:
 *   1. Genre galaxy (radius 32): 18 genre suns, 294 subgenre planets,
 *      1180 microstyle moons.
 *   2. Attribute cloud (radius ~56): 8 category clusters — moods,
 *      energies, harmonics, textures, mix chars, grooves, vocalists,
 *      lyrical vibes.
 *   3. Link system:
 *      • Ancestry   — parent→child chain when a node is focused
 *      • Similarity — GENRE_INTUITION cross-ref lines between related
 *                     subgenres (pre-computed, one BufferGeometry draw call)
 *      • Attribute  — focused subgenre → its attribute nodes
 *
 * Props:
 *   data — raw.data from data.json
 * ═══════════════════════════════════════════════════════════════════ */

// ── Decorative genre palette ────────────────────────────────────────
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
// giField = field name in GENRE_INTUITION for this category (null = not in GI)
const ATTR_CATS = [
  { id: "moods",     label: "Moods",        color: "#F9A8D4", dataKey: "MOODS",           giField: "moods",     isObjects: false },
  { id: "energies",  label: "Energies",      color: "#FCD34D", dataKey: "ENERGIES",        giField: "energies",  isObjects: false },
  { id: "harmonics", label: "Harmonics",     color: "#FB923C", dataKey: "HARMONIC_STYLES", giField: "harmonics", isObjects: false },
  { id: "textures",  label: "Textures",      color: "#E879F9", dataKey: "SOUND_TEXTURES",  giField: "textures",  isObjects: false },
  { id: "mix",       label: "Mix chars",     color: "#2DD4BF", dataKey: "MIX_CHARS",       giField: "mixes",     isObjects: false },
  { id: "grooves",   label: "Grooves",       color: "#60A5FA", dataKey: "GROOVES",         giField: "grooves",   isObjects: true,  nameKey: "id", labelKey: "label" },
  { id: "vocalists", label: "Vocalists",     color: "#A78BFA", dataKey: "VOCALISTS",       giField: null,        isObjects: false },
  { id: "lyrical",   label: "Lyrical vibes", color: "#6EE7B7", dataKey: "LYRICAL_VIBES",   giField: null,        isObjects: false },
];

const GI_SIM_FIELDS = ["moods", "harmonics", "textures", "energies", "grooves"];

// ── Geometry constants ──────────────────────────────────────────────
const SUN_RADIUS     = 0.95;
const PLANET_RADIUS  = 0.30;
const MOON_RADIUS    = 0.10;
const ATTR_RADIUS    = 0.18;
const SYSTEM_R       = 32;
const SUB_ORBIT      = 3.4;
const MICRO_ORBIT    = 0.95;
const ATTR_SHELL_R   = 56;
const ATTR_CLUSTER_R = 4.5;

// ── Layout math ─────────────────────────────────────────────────────

function fibSphere(n) {
  const pts = [];
  if (n <= 0) return pts;
  if (n === 1) return [[0, 0, 1]];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
}

function hash01(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xFFFFFFFF;
}

// ── Main layout builder ─────────────────────────────────────────────

function buildLayout(data) {
  const tree           = data.GENRE_TREE || {};
  const genreIntuition = data.GENRE_INTUITION || {};

  // 1. Genre galaxy
  const genreNames  = Object.keys(tree);
  const genrePoints = fibSphere(genreNames.length);
  const genres = [], subgenres = [], microstyles = [];

  genreNames.forEach((gName, gi) => {
    const center = new THREE.Vector3(...genrePoints[gi]).multiplyScalar(SYSTEM_R);
    const color  = GENRE_COLORS[gName] || DEFAULT_COLOR;
    const seed   = hash01(gName);
    const qRot   = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(seed * Math.PI * 2), Math.sin(seed * Math.PI * 2), Math.cos(seed * Math.PI * 4)).normalize(),
      seed * Math.PI * 2
    );

    const subs = Object.keys(tree[gName] || {});
    fibSphere(subs.length).forEach((sp, si) => {
      const subPos = center.clone().add(
        new THREE.Vector3(...sp).applyQuaternion(qRot).multiplyScalar(SUB_ORBIT)
      );
      const sName  = subs[si];
      const sSeed  = hash01(gName + "/" + sName);
      const sRot   = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(Math.sin(sSeed * Math.PI * 2), Math.cos(sSeed * Math.PI * 2), Math.sin(sSeed * Math.PI * 3.7)).normalize(),
        sSeed * Math.PI * 2
      );

      const microNames = tree[gName][sName] || [];
      const microEntries = [];
      fibSphere(microNames.length).forEach((mp, mi) => {
        const mPos = subPos.clone().add(
          new THREE.Vector3(...mp).applyQuaternion(sRot).multiplyScalar(MICRO_ORBIT)
        );
        const entry = {
          name: microNames[mi], parent: sName, grandparent: gName, color,
          position: [mPos.x, mPos.y, mPos.z],
        };
        microEntries.push(entry);
        microstyles.push(entry);
      });

      const sub = {
        name: sName, parent: gName, color,
        position: [subPos.x, subPos.y, subPos.z],
        microstyles: microEntries,
      };
      subgenres.push(sub);
      genres[genres.length - 1]?.subgenres.push(sub); // safe push once genre is added
    });

    genres.push({
      name: gName, color, position: [center.x, center.y, center.z], subgenres: [],
    });
    // Backfill subgenres added in the loop above
    const added = subgenres.slice(subgenres.length - subs.length);
    genres[genres.length - 1].subgenres = added;
  });

  // 2. Attribute cloud — 8 clusters on outer sphere
  const clusterPoles = fibSphere(ATTR_CATS.length);
  const attributeNodes = [], attributeClusters = [];

  ATTR_CATS.forEach((cat, ci) => {
    const poleDir = new THREE.Vector3(...clusterPoles[ci]).normalize();
    const poleCtr = poleDir.clone().multiplyScalar(ATTR_SHELL_R);
    const rawItems = data[cat.dataKey] || [];
    const items = rawItems.map(item =>
      cat.isObjects ? { name: item[cat.nameKey], label: item[cat.labelKey] }
                    : { name: item, label: item }
    );
    const catSeed = hash01(cat.id);
    const catRot  = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(Math.cos(catSeed * Math.PI * 2), Math.sin(catSeed * Math.PI * 2), Math.cos(catSeed * Math.PI * 5)).normalize(),
      catSeed * Math.PI * 2
    );
    const clusterNodes = fibSphere(items.length).map((lp, idx) => {
      const pos = poleCtr.clone().add(
        new THREE.Vector3(...lp).applyQuaternion(catRot).multiplyScalar(ATTR_CLUSTER_R)
      );
      const node = {
        name: items[idx].name, label: items[idx].label,
        categoryId: cat.id, color: cat.color,
        poleCenter: [poleCtr.x, poleCtr.y, poleCtr.z],
        position: [pos.x, pos.y, pos.z],
      };
      attributeNodes.push(node);
      return node;
    });
    attributeClusters.push({
      id: cat.id, label: cat.label, color: cat.color,
      poleCenter: [poleCtr.x, poleCtr.y, poleCtr.z],
      nodes: clusterNodes,
    });
  });

  // 3. Reverse index: attribute → which subgenres have it
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

  // 4. Subgenre similarity links (GENRE_INTUITION cross-reference)
  const attrSetFor = subgenres.map(sub => {
    const gi  = genreIntuition[sub.name] || genreIntuition[sub.name.toLowerCase()];
    const set = new Set();
    if (gi) GI_SIM_FIELDS.forEach(f => (gi[f] || []).forEach(v => set.add(f + ":" + v)));
    return { sub, set };
  });

  const simLinks = [], addedSim = new Set();
  for (let i = 0; i < attrSetFor.length; i++) {
    const { sub: a, set: aSet } = attrSetFor[i];
    const candidates = [];
    for (let j = 0; j < attrSetFor.length; j++) {
      if (i === j) continue;
      const { sub: b, set: bSet } = attrSetFor[j];
      let shared = 0;
      for (const x of aSet) if (bSet.has(x)) shared++;
      if (shared >= 3) candidates.push({ b, score: shared });
    }
    candidates.sort((x, y) => y.score - x.score);
    for (const { b, score } of candidates.slice(0, 3)) {
      const key = [a.name, b.name].sort().join("\0");
      if (!addedSim.has(key)) {
        addedSim.add(key);
        simLinks.push({ from: a.position, to: b.position, score, sameFamily: a.parent === b.parent });
      }
    }
  }

  return { genres, subgenres, microstyles, attributeNodes, attributeClusters, attrToSubs, simLinks };
}

// ── Helpers ──────────────────────────────────────────────────────────

function getAttrLinks(focused, layout, genreIntuition) {
  if (!focused || focused.kind !== "subgenre") return [];
  const gi = genreIntuition[focused.name] || genreIntuition[focused.name.toLowerCase()];
  if (!gi) return [];
  const links = [];
  ATTR_CATS.forEach(cat => {
    if (!cat.giField) return;
    (gi[cat.giField] || []).slice(0, 3).forEach(val => {
      const node = layout.attributeNodes.find(n => n.categoryId === cat.id && n.name === val);
      if (node) links.push({ from: focused.position, to: node.position, color: cat.color, label: val });
    });
  });
  return links;
}

function subIsHighlighted(sub, focused, attrToSubs) {
  if (!focused) return true;
  if (focused.kind === "genre")      return sub.parent === focused.name;
  if (focused.kind === "subgenre")   return sub.name === focused.name && sub.parent === focused.parent;
  if (focused.kind === "microstyle") return sub.name === focused.parent && sub.parent === focused.grandparent;
  if (focused.kind === "attribute")  return attrToSubs[focused.categoryId + ":" + focused.name]?.has(sub.name + "/" + sub.parent) ?? false;
  return false;
}

// ── 3D Components ─────────────────────────────────────────────────────

function GenreSun({ genre, isFocused, dimmed, onSelect }) {
  return (
    <group position={genre.position}>
      <mesh onClick={e => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color={genre.color} emissive={genre.color}
          emissiveIntensity={isFocused ? 2.4 : (dimmed ? 0.28 : 1.1)}
          toneMapped={false} opacity={dimmed ? 0.45 : 1} transparent={dimmed}
        />
      </mesh>
      <Html center distanceFactor={30} style={{ pointerEvents: "none" }}>
        <div style={{
          color: "#fff", fontSize: isFocused ? 13 : 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontWeight: isFocused ? 700 : 500, letterSpacing: "0.02em",
          background: isFocused ? "rgba(94,106,210,0.95)" : "rgba(10,10,15,0.75)",
          padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap",
          transform: "translate(-50%, 18px)", position: "absolute",
          opacity: dimmed ? 0.4 : 1, userSelect: "none",
        }}>{genre.name}</div>
      </Html>
    </group>
  );
}

function SubgenreField({ subgenres, focused, attrToSubs, onHover, onSelect }) {
  return (
    <Instances limit={Math.max(subgenres.length, 1)} range={subgenres.length}>
      <sphereGeometry args={[PLANET_RADIUS, 16, 16]} />
      <meshStandardMaterial emissiveIntensity={0.9} toneMapped={false} />
      {subgenres.map(s => {
        const highlighted = subIsHighlighted(s, focused, attrToSubs);
        const isFocused   = focused?.kind === "subgenre" && focused.name === s.name && focused.parent === s.parent;
        const dim         = focused && !highlighted;
        const scl         = isFocused ? 1.75 : (highlighted && focused ? 1.2 : (dim ? 0.38 : 1));
        return (
          <Instance key={s.parent + "/" + s.name}
            position={s.position} color={s.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(s); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(s); }}
          />
        );
      })}
    </Instances>
  );
}

function MicrostyleField({ microstyles, focused, onHover, onSelect }) {
  return (
    <Instances limit={Math.max(microstyles.length, 1)} range={microstyles.length}>
      <sphereGeometry args={[MOON_RADIUS, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.7} toneMapped={false} />
      {microstyles.map(m => {
        const isFocused     = focused?.kind === "microstyle" && focused.name === m.name && focused.parent === m.parent && focused.grandparent === m.grandparent;
        const inFocusedSub  = focused?.kind === "subgenre"   && focused.name === m.parent && focused.parent === m.grandparent;
        const inFocusedGenre = focused?.kind === "genre"     && focused.name === m.grandparent;
        const dim = focused && !(isFocused || inFocusedSub || inFocusedGenre);
        const scl = isFocused ? 2.4 : (inFocusedSub ? 1.35 : (dim ? 0.32 : 1));
        return (
          <Instance key={m.grandparent + "/" + m.parent + "/" + m.name}
            position={m.position} color={m.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(m); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(m); }}
          />
        );
      })}
    </Instances>
  );
}

function AttributeCloudField({ attributeNodes, focused, attrToSubs, onHover, onSelect }) {
  return (
    <Instances limit={Math.max(attributeNodes.length, 1)} range={attributeNodes.length}>
      <sphereGeometry args={[ATTR_RADIUS, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.85} toneMapped={false} />
      {attributeNodes.map(n => {
        const isFocused = focused?.kind === "attribute" && focused.name === n.name && focused.categoryId === n.categoryId;
        const linked    = focused?.kind === "subgenre" &&
          (attrToSubs[n.categoryId + ":" + n.name]?.has(focused.name + "/" + focused.parent) ?? false);
        const dim = focused && !isFocused && !linked;
        const scl = isFocused ? 2.1 : (linked ? 1.3 : (dim ? 0.38 : 1));
        return (
          <Instance key={n.categoryId + ":" + n.name}
            position={n.position} color={n.color} scale={scl}
            onPointerOver={e => { e.stopPropagation(); onHover(n); }}
            onPointerOut={e => { e.stopPropagation(); onHover(null); }}
            onClick={e => { e.stopPropagation(); onSelect(n); }}
          />
        );
      })}
    </Instances>
  );
}

function AttributeClusterLabels({ clusters }) {
  return (
    <>
      {clusters.map(c => (
        <Html key={c.id} position={c.poleCenter} center distanceFactor={58} style={{ pointerEvents: "none" }}>
          <div style={{
            color: c.color, fontSize: 10,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            background: "rgba(10,10,15,0.82)", padding: "2px 7px", borderRadius: 3,
            whiteSpace: "nowrap", userSelect: "none", border: `1px solid ${c.color}44`,
          }}>{c.label}</div>
        </Html>
      ))}
    </>
  );
}

function SimilarityLinesMesh({ simLinks, visible }) {
  const geo = useMemo(() => {
    if (!simLinks.length) return null;
    const pos = new Float32Array(simLinks.length * 6);
    simLinks.forEach(({ from, to }, i) => {
      pos[i * 6]     = from[0]; pos[i * 6 + 1] = from[1]; pos[i * 6 + 2] = from[2];
      pos[i * 6 + 3] = to[0];  pos[i * 6 + 4] = to[1];  pos[i * 6 + 5] = to[2];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [simLinks]);

  if (!visible || !geo) return null;
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#6366F1" transparent opacity={0.18} />
    </lineSegments>
  );
}

function AttributeLinesMesh({ lines, visible }) {
  if (!visible || !lines.length) return null;
  return (
    <>
      {lines.map((l, i) => (
        <Line key={i} points={[l.from, l.to]} color={l.color} lineWidth={1.5} transparent opacity={0.65} />
      ))}
    </>
  );
}

function AncestryLines({ focused, layout, visible }) {
  const segs = useMemo(() => {
    if (!focused || !visible) return [];
    const s = [];
    if (focused.kind === "subgenre") {
      const genre = layout.genres.find(g => g.name === focused.parent);
      const sub   = layout.subgenres.find(x => x.name === focused.name && x.parent === focused.parent);
      if (genre && sub) s.push({ from: genre.position, to: sub.position, color: sub.color });
    } else if (focused.kind === "microstyle") {
      const genre = layout.genres.find(g => g.name === focused.grandparent);
      const sub   = layout.subgenres.find(x => x.name === focused.parent && x.parent === focused.grandparent);
      const micro = layout.microstyles.find(m => m.name === focused.name && m.parent === focused.parent && m.grandparent === focused.grandparent);
      if (genre && sub) s.push({ from: genre.position, to: sub.position, color: sub.color });
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
        color: "#fff", fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontWeight: 600, background: "rgba(94,106,210,0.95)",
        padding: "4px 9px", borderRadius: 4, whiteSpace: "nowrap",
        transform: "translate(-50%, -30px)", position: "absolute",
        userSelect: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}>
        {hovered.label || hovered.name}
      </div>
    </Html>
  );
}

// CameraRig — animates to focused node, stops when settled,
// then yields full control to OrbitControls (no more zoom fight).
function CameraRig({ focusTarget, controlsRef }) {
  const { camera } = useThree();
  const animating  = useRef(false);
  const destPos    = useRef(new THREE.Vector3(0, 8, 85));
  const destTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (!focusTarget) {
      animating.current = false;
      return;
    }
    const t = new THREE.Vector3(...focusTarget.position);
    destTarget.current.copy(t);
    const fromOrigin = t.clone().normalize();
    const dist = focusTarget.kind === "genre" ? 9
               : focusTarget.kind === "subgenre" ? 5
               : focusTarget.kind === "microstyle" ? 3 : 8;
    destPos.current.copy(t.clone().add(fromOrigin.multiplyScalar(dist)));
    animating.current = true;
  }, [focusTarget]);

  useFrame((_, dt) => {
    if (!animating.current) return;
    const k = Math.min(1, dt * 2.8);
    camera.position.lerp(destPos.current, k);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(destTarget.current, k);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(destPos.current) < 0.07 &&
        controlsRef.current?.target.distanceTo(destTarget.current) < 0.07) {
      animating.current = false;
    }
  });

  return null;
}

// ── UI Overlays ───────────────────────────────────────────────────────

function Toggle({ on, onChange, label, color, disabled }) {
  return (
    <div onClick={() => !disabled && onChange(!on)} style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "5px 10px", cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.38 : 1, userSelect: "none", borderRadius: 4,
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
        background: on ? color : "transparent", border: `1.5px solid ${color}`,
      }} />
      <span style={{ fontSize: 12, fontFamily: T.fontMono, color: T.text }}>{label}</span>
    </div>
  );
}

function SectionLabel({ label }) {
  return (
    <div style={{
      padding: "6px 10px 4px", fontSize: 9, letterSpacing: "0.14em",
      color: T.textMuted, textTransform: "uppercase",
      borderBottom: `1px solid ${T.borderHi}`, marginBottom: 2, fontFamily: T.fontMono,
    }}>{label}</div>
  );
}

function LayerPanel({ layers, links, setLayers, setLinks }) {
  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      background: "rgba(10,10,15,0.9)", border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md, padding: "6px 0", backdropFilter: "blur(8px)",
      minWidth: 196, zIndex: 10,
    }}>
      <SectionLabel label="Layers" />
      <Toggle on label="Genres" color="#A78BFA" disabled />
      <Toggle
        on={layers.subgenres} label="Subgenres" color="#60A5FA"
        onChange={v => setLayers(l => ({ ...l, subgenres: v, microstyles: !v ? false : l.microstyles }))}
      />
      <Toggle
        on={layers.microstyles} label="Microstyles" color="#F472B6"
        disabled={!layers.subgenres}
        onChange={v => setLayers(l => ({ ...l, microstyles: v }))}
      />
      <Toggle
        on={layers.attributes} label="Attribute cloud" color="#2DD4BF"
        onChange={v => setLayers(l => ({ ...l, attributes: v }))}
      />

      <div style={{ height: 6 }} />
      <SectionLabel label="Links" />
      <Toggle
        on={links.all} label="All link lines" color="#E879F9"
        onChange={v => setLinks(l => ({ ...l, all: v }))}
      />
      <div style={{ paddingLeft: 12, opacity: links.all ? 1 : 0.3, pointerEvents: links.all ? "auto" : "none" }}>
        <Toggle on={links.ancestry}   label="Ancestry"        color="#94A3B8" disabled={!links.all} onChange={v => setLinks(l => ({ ...l, ancestry: v }))} />
        <Toggle on={links.similarity} label="Genre similarity" color="#6366F1" disabled={!links.all} onChange={v => setLinks(l => ({ ...l, similarity: v }))} />
        <Toggle on={links.attrs}      label="Attribute links"  color="#F9A8D4" disabled={!links.all} onChange={v => setLinks(l => ({ ...l, attrs: v }))} />
      </div>
    </div>
  );
}

function FocusHUD({ focused, onClear }) {
  if (!focused) {
    return (
      <div style={{
        position: "absolute", bottom: 16, left: 16, fontSize: 11,
        color: T.textMuted, fontFamily: T.fontMono,
        background: "rgba(10,10,15,0.65)", padding: "6px 10px",
        borderRadius: T.r_sm, backdropFilter: "blur(4px)", userSelect: "none",
      }}>
        drag · scroll · right-drag pan · click a node
      </div>
    );
  }

  let kindLabel, crumbs;
  if      (focused.kind === "genre")       { kindLabel = "Genre";       crumbs = [focused.name]; }
  else if (focused.kind === "subgenre")    { kindLabel = "Subgenre";    crumbs = [focused.parent, focused.name]; }
  else if (focused.kind === "microstyle")  { kindLabel = "Microstyle";  crumbs = [focused.grandparent, focused.parent, focused.name]; }
  else                                     { kindLabel = focused.categoryId; crumbs = [focused.label || focused.name]; }

  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16,
      background: "rgba(10,10,15,0.92)", border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md, padding: "10px 14px", backdropFilter: "blur(8px)",
      fontFamily: T.fontMono, maxWidth: 360, zIndex: 10,
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: T.textMuted, textTransform: "uppercase", marginBottom: 5 }}>
        {kindLabel}
      </div>
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
        padding: "3px 8px", cursor: "pointer", fontFamily: T.fontMono, letterSpacing: "0.05em",
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
      borderRadius: T.r_sm, backdropFilter: "blur(4px)",
      userSelect: "none", letterSpacing: "0.05em", lineHeight: 1.8, zIndex: 10,
    }}>
      <div>{layout.genres.length} genres · {layout.subgenres.length} sub · {layout.microstyles.length} micro</div>
      <div>{layout.attributeNodes.length} attr nodes · {layout.simLinks.length} sim links</div>
    </div>
  );
}

// ── Top-level export ──────────────────────────────────────────────────

export default function GenreMap3D({ data }) {
  const layout         = useMemo(() => buildLayout(data || {}), [data]);
  const genreIntuition = useMemo(() => (data || {}).GENRE_INTUITION || {}, [data]);

  const [layers, setLayers] = useState({ subgenres: true, microstyles: false, attributes: true });
  const [links,  setLinks]  = useState({ all: true, ancestry: true, similarity: true, attrs: true });
  const [focused, setFocused] = useState(null);
  const [hovered, setHovered] = useState(null);
  const controlsRef = useRef();

  const attrLines = useMemo(() =>
    (links.all && links.attrs) ? getAttrLinks(focused, layout, genreIntuition) : [],
    [focused, layout, genreIntuition, links.all, links.attrs]
  );

  const selectGenre      = g => setFocused({ kind: "genre",      name: g.name, position: g.position });
  const selectSubgenre   = s => setFocused({ kind: "subgenre",   name: s.name, parent: s.parent, position: s.position });
  const selectMicrostyle = m => setFocused({ kind: "microstyle", name: m.name, parent: m.parent, grandparent: m.grandparent, position: m.position });
  const selectAttribute  = n => setFocused({ kind: "attribute",  name: n.name, label: n.label, categoryId: n.categoryId, position: n.position });

  return (
    <div style={{
      position: "relative", width: "100%", height: "calc(100vh - 80px)",
      minHeight: 500, background: "#04040B", overflow: "hidden",
    }}>
      <Canvas
        camera={{ position: [0, 8, 90], fov: 52, near: 0.1, far: 600 }}
        dpr={[1, 2]}
        onPointerMissed={() => setFocused(null)}
      >
        <color attach="background" args={["#04040B"]} />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 0]} intensity={0.7} distance={250} />

        <Suspense fallback={null}>
          <Stars radius={250} depth={80} count={2000} factor={4} saturation={0} fade speed={0.2} />

          {layout.genres.map(g => {
            const gKey = `${g.name}`;
            const dimmed = !!focused && !(
              (focused.kind === "genre"       && focused.name === g.name) ||
              (focused.kind === "subgenre"    && focused.parent === g.name) ||
              (focused.kind === "microstyle"  && focused.grandparent === g.name) ||
              (focused.kind === "attribute"   &&
                [...(layout.attrToSubs[focused.categoryId + ":" + focused.name] || new Set())]
                  .some(k => k.endsWith("/" + g.name)))
            );
            return (
              <GenreSun key={gKey} genre={g}
                isFocused={focused?.kind === "genre" && focused.name === g.name}
                dimmed={dimmed}
                onSelect={() => selectGenre(g)}
              />
            );
          })}

          {layers.subgenres && (
            <SubgenreField
              subgenres={layout.subgenres} focused={focused}
              attrToSubs={layout.attrToSubs}
              onHover={setHovered} onSelect={selectSubgenre}
            />
          )}

          {layers.subgenres && layers.microstyles && (
            <MicrostyleField
              microstyles={layout.microstyles} focused={focused}
              onHover={setHovered} onSelect={selectMicrostyle}
            />
          )}

          {layers.attributes && (
            <>
              <AttributeCloudField
                attributeNodes={layout.attributeNodes} focused={focused}
                attrToSubs={layout.attrToSubs} subgenres={layout.subgenres}
                onHover={setHovered} onSelect={selectAttribute}
              />
              <AttributeClusterLabels clusters={layout.attributeClusters} />
            </>
          )}

          {links.all && links.similarity && (
            <SimilarityLinesMesh simLinks={layout.simLinks} visible />
          )}
          {links.all && links.attrs && (
            <AttributeLinesMesh lines={attrLines} visible />
          )}
          {links.all && links.ancestry && (
            <AncestryLines focused={focused} layout={layout} visible />
          )}

          <HoverTooltip hovered={hovered} />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enableDamping dampingFactor={0.07}
          minDistance={2} maxDistance={180}
          rotateSpeed={0.55} zoomSpeed={0.9} panSpeed={0.6}
        />
        <CameraRig focusTarget={focused} controlsRef={controlsRef} />
      </Canvas>

      <LayerPanel layers={layers} links={links} setLayers={setLayers} setLinks={setLinks} />
      <StatsBadge layout={layout} />
      <FocusHUD focused={focused} onClear={() => setFocused(null)} />
    </div>
  );
}
