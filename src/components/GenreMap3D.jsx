import React, { useMemo, useState, useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Instances, Instance, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { T } from "../theme.js";

/* ------------------------------------------------------------------ *
 * GenreMap3D
 * ------------------------------------------------------------------ *
 *  A 3D orbital map of the genre tree.
 *
 *  Hierarchy (3 layers):
 *    • Genre   — "sun"   (18 total, colored per family)
 *    • Subgenre — "planet" (294 total, orbits its sun)
 *    • Microstyle — "moon" (1180 total, orbits its planet)
 *
 *  Layout is deterministic (Fibonacci sphere distribution at each
 *  level) so the same data always produces the same map.
 *
 *  Props:
 *    genreTree — raw.data.GENRE_TREE from data.json
 *                shape: { [genre]: { [subgenre]: [microstyle, ...] } }
 * ------------------------------------------------------------------ */

// --- Decorative palette (not structural UI — decorative per genre family).
// 18 distinguishable hues roughly matching each family's vibe.
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

// --- Geometry / layout tuning.
const SUN_RADIUS    = 0.95;
const PLANET_RADIUS = 0.30;
const MOON_RADIUS   = 0.10;
const SYSTEM_R      = 26;   // suns arranged on a sphere of this radius
const SUB_ORBIT     = 3.2;  // subgenres orbit their sun at this distance
const MICRO_ORBIT   = 0.9;  // microstyles orbit their subgenre at this distance

// ---------------- Layout math ----------------

// N points evenly distributed on the unit sphere (Fibonacci lattice).
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

// Deterministic 32-bit string hash → [0,1). Used to vary orientation
// per system so every genre has a unique local "up" axis.
function hash01(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xFFFFFFFF;
}

// Build full layout from the genre tree. Runs once per data load.
function buildLayout(tree) {
  const genreNames = Object.keys(tree || {});
  const genrePoints = fibSphere(genreNames.length);

  const genres = [];
  const subgenres = [];   // flat list for instanced rendering
  const microstyles = []; // flat list for instanced rendering

  genreNames.forEach((gName, gi) => {
    const dir = new THREE.Vector3(...genrePoints[gi]);
    const center = dir.clone().multiplyScalar(SYSTEM_R);
    const color = GENRE_COLORS[gName] || DEFAULT_COLOR;
    const seed = hash01(gName);

    // Per-system rotation so each local orbital cluster is oriented
    // differently (prevents microstyle clouds from looking identical).
    const qAxis = new THREE.Vector3(
      Math.cos(seed * Math.PI * 2),
      Math.sin(seed * Math.PI * 2),
      Math.cos(seed * Math.PI * 4)
    ).normalize();
    const qAngle = seed * Math.PI * 2;
    const qRot = new THREE.Quaternion().setFromAxisAngle(qAxis, qAngle);

    const subs = Object.keys(tree[gName] || {});
    const subPoints = fibSphere(subs.length);

    const subEntries = [];
    subs.forEach((sName, si) => {
      const subLocal = new THREE.Vector3(...subPoints[si])
        .applyQuaternion(qRot)
        .multiplyScalar(SUB_ORBIT);
      const subPos = center.clone().add(subLocal);

      // Per-subgenre rotation so microstyle clouds also vary.
      const subSeed = hash01(gName + "/" + sName);
      const sAxis = new THREE.Vector3(
        Math.sin(subSeed * Math.PI * 2),
        Math.cos(subSeed * Math.PI * 2),
        Math.sin(subSeed * Math.PI * 3.7)
      ).normalize();
      const sRot = new THREE.Quaternion().setFromAxisAngle(sAxis, subSeed * Math.PI * 2);

      const microNames = tree[gName][sName] || [];
      const microPoints = fibSphere(microNames.length);

      const microEntries = [];
      microNames.forEach((mName, mi) => {
        const microLocal = new THREE.Vector3(...microPoints[mi])
          .applyQuaternion(sRot)
          .multiplyScalar(MICRO_ORBIT);
        const mPos = subPos.clone().add(microLocal);
        const entry = {
          name: mName,
          parent: sName,
          grandparent: gName,
          color,
          position: [mPos.x, mPos.y, mPos.z],
          index: microstyles.length,
        };
        microEntries.push(entry);
        microstyles.push(entry);
      });

      const subEntry = {
        name: sName,
        parent: gName,
        color,
        position: [subPos.x, subPos.y, subPos.z],
        microstyles: microEntries,
        index: subgenres.length,
      };
      subEntries.push(subEntry);
      subgenres.push(subEntry);
    });

    genres.push({
      name: gName,
      color,
      position: [center.x, center.y, center.z],
      subgenres: subEntries,
    });
  });

  return { genres, subgenres, microstyles };
}

// ---------------- 3D scene pieces ----------------

function GenreSun({ genre, isFocused, dimmed, onSelect }) {
  return (
    <group position={genre.position}>
      <mesh onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color={genre.color}
          emissive={genre.color}
          emissiveIntensity={isFocused ? 2.2 : (dimmed ? 0.35 : 1.1)}
          toneMapped={false}
          opacity={dimmed ? 0.55 : 1}
          transparent={dimmed}
        />
      </mesh>
      {/* Always-on label for the 18 top-level genres. */}
      <Html center distanceFactor={28} style={{ pointerEvents: "none" }}>
        <div style={labelStyle(isFocused, dimmed)}>{genre.name}</div>
      </Html>
    </group>
  );
}

function labelStyle(isFocused, dimmed) {
  return {
    color: "#fff",
    fontSize: isFocused ? 13 : 11,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontWeight: isFocused ? 700 : 500,
    letterSpacing: "0.02em",
    background: isFocused ? "rgba(94,106,210,0.92)" : "rgba(10,10,15,0.72)",
    padding: "3px 8px",
    borderRadius: 4,
    whiteSpace: "nowrap",
    transform: "translate(-50%, 18px)",
    position: "absolute",
    opacity: dimmed ? 0.5 : 1,
    userSelect: "none",
  };
}

// Subgenre planets: one <Instances> block, 294 instances. Each
// <Instance> receives its own click/hover events.
function SubgenreField({ subgenres, focused, onHover, onSelect, dimOutside }) {
  return (
    <Instances limit={Math.max(subgenres.length, 1)} range={subgenres.length}>
      <sphereGeometry args={[PLANET_RADIUS, 16, 16]} />
      <meshStandardMaterial
        emissiveIntensity={0.9}
        toneMapped={false}
      />
      {subgenres.map((s) => {
        const isFocused = focused?.kind === "subgenre" && focused.name === s.name && focused.parent === s.parent;
        const isChainHighlight =
          (focused?.kind === "microstyle" && focused.parent === s.name && focused.grandparent === s.parent) ||
          (focused?.kind === "genre" && focused.name === s.parent);
        const dim = dimOutside && !(isFocused || isChainHighlight);
        const scl = isFocused ? 1.7 : (isChainHighlight ? 1.25 : (dim ? 0.45 : 1));
        return (
          <Instance
            key={s.parent + "/" + s.name}
            position={s.position}
            color={s.color}
            scale={scl}
            onPointerOver={(e) => { e.stopPropagation(); onHover(s); }}
            onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            onClick={(e) => { e.stopPropagation(); onSelect(s); }}
          />
        );
      })}
    </Instances>
  );
}

// Microstyle moons: one <Instances> block, 1180 instances.
function MicrostyleField({ microstyles, focused, onHover, onSelect, dimOutside }) {
  return (
    <Instances limit={Math.max(microstyles.length, 1)} range={microstyles.length}>
      <sphereGeometry args={[MOON_RADIUS, 10, 10]} />
      <meshStandardMaterial emissiveIntensity={0.7} toneMapped={false} />
      {microstyles.map((m) => {
        const isFocused = focused?.kind === "microstyle" &&
          focused.name === m.name && focused.parent === m.parent && focused.grandparent === m.grandparent;
        const inFocusedSub = focused?.kind === "subgenre" &&
          focused.name === m.parent && focused.parent === m.grandparent;
        const inFocusedGenre = focused?.kind === "genre" && focused.name === m.grandparent;
        const dim = dimOutside && !(isFocused || inFocusedSub || inFocusedGenre);
        const scl = isFocused ? 2.2 : (inFocusedSub ? 1.3 : (dim ? 0.4 : 1));
        return (
          <Instance
            key={m.grandparent + "/" + m.parent + "/" + m.name}
            position={m.position}
            color={m.color}
            scale={scl}
            onPointerOver={(e) => { e.stopPropagation(); onHover(m); }}
            onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
            onClick={(e) => { e.stopPropagation(); onSelect(m); }}
          />
        );
      })}
    </Instances>
  );
}

// Hover tooltip — floats at the hovered node's position.
function HoverTooltip({ hovered }) {
  if (!hovered) return null;
  return (
    <Html position={hovered.position} center distanceFactor={18} style={{ pointerEvents: "none" }}>
      <div style={{
        color: "#fff",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontWeight: 600,
        background: "rgba(94,106,210,0.95)",
        padding: "4px 8px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        transform: "translate(-50%, -28px)",
        position: "absolute",
        userSelect: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}>
        {hovered.name}
      </div>
    </Html>
  );
}

// Ancestor chain link lines — only shown when something is focused.
function ChainLines({ focused, layout }) {
  const segments = useMemo(() => {
    if (!focused) return [];
    const segs = [];
    if (focused.kind === "subgenre") {
      const genre = layout.genres.find(g => g.name === focused.parent);
      const sub = layout.subgenres.find(s => s.name === focused.name && s.parent === focused.parent);
      if (genre && sub) segs.push({ from: genre.position, to: sub.position, color: sub.color });
    } else if (focused.kind === "microstyle") {
      const genre = layout.genres.find(g => g.name === focused.grandparent);
      const sub = layout.subgenres.find(s => s.name === focused.parent && s.parent === focused.grandparent);
      const micro = layout.microstyles.find(m =>
        m.name === focused.name && m.parent === focused.parent && m.grandparent === focused.grandparent
      );
      if (genre && sub) segs.push({ from: genre.position, to: sub.position, color: sub.color });
      if (sub && micro) segs.push({ from: sub.position, to: micro.position, color: micro.color });
    }
    return segs;
  }, [focused, layout]);

  return (
    <>
      {segments.map((s, i) => (
        <Line
          key={i}
          points={[s.from, s.to]}
          color={s.color}
          lineWidth={2}
          transparent
          opacity={0.9}
        />
      ))}
    </>
  );
}

// Smooth camera fly-to when focus changes. Uses lerp on both the
// OrbitControls target and the camera position.
function CameraRig({ focusTarget, controlsRef }) {
  const { camera } = useThree();
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
  const desiredPosition = useRef(new THREE.Vector3(0, 0, 60));
  const hasFocus = useRef(false);

  useEffect(() => {
    if (!focusTarget) {
      // Return to overview — back off to a wide shot.
      desiredTarget.current.set(0, 0, 0);
      desiredPosition.current.set(0, 6, 70);
      hasFocus.current = false;
      return;
    }
    hasFocus.current = true;
    const t = new THREE.Vector3(...focusTarget.position);
    desiredTarget.current.copy(t);
    // Pull the camera toward the focused node but stay behind it
    // relative to the world origin (so the camera looks "inward").
    const fromOrigin = t.clone().normalize();
    const distance = focusTarget.kind === "genre" ? 8 :
                     focusTarget.kind === "subgenre" ? 4 : 2.5;
    desiredPosition.current.copy(t.clone().add(fromOrigin.multiplyScalar(distance)));
  }, [focusTarget]);

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    camera.position.lerp(desiredPosition.current, k);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(desiredTarget.current, k);
      controlsRef.current.update();
    }
  });

  return null;
}

// ---------------- Overlays (DOM, not 3D) ----------------

function LayerPanel({ show, setShow }) {
  const row = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "6px 10px", cursor: "pointer",
    fontSize: 12, fontFamily: T.fontMono, color: T.text,
    borderRadius: T.r_sm,
    userSelect: "none",
  };
  const dot = (on, color) => ({
    width: 10, height: 10, borderRadius: "50%",
    background: on ? color : "transparent",
    border: `1.5px solid ${color}`,
    flexShrink: 0,
  });
  return (
    <div style={{
      position: "absolute", top: 16, left: 16,
      background: "rgba(10,10,15,0.85)",
      border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md,
      padding: 6,
      backdropFilter: "blur(6px)",
      minWidth: 180,
    }}>
      <div style={{
        padding: "4px 10px 6px",
        fontSize: 10, letterSpacing: "0.1em",
        color: T.textMuted, textTransform: "uppercase",
        borderBottom: `1px solid ${T.borderHi}`,
        marginBottom: 4,
      }}>
        Layers
      </div>
      <div style={{ ...row, cursor: "default" }}>
        <span style={dot(true, "#A78BFA")} />
        <span style={{ flex: 1 }}>Genres</span>
        <span style={{ color: T.textMuted, fontSize: 10 }}>always</span>
      </div>
      <div style={row} onClick={() => setShow(s => ({ ...s, subgenres: !s.subgenres, microstyles: s.subgenres ? false : s.microstyles }))}>
        <span style={dot(show.subgenres, "#60A5FA")} />
        <span style={{ flex: 1 }}>Subgenres</span>
      </div>
      <div style={{ ...row, opacity: show.subgenres ? 1 : 0.4, cursor: show.subgenres ? "pointer" : "not-allowed" }}
           onClick={() => show.subgenres && setShow(s => ({ ...s, microstyles: !s.microstyles }))}>
        <span style={dot(show.microstyles, "#F472B6")} />
        <span style={{ flex: 1 }}>Microstyles</span>
      </div>
    </div>
  );
}

function FocusHUD({ focused, onClear }) {
  if (!focused) {
    return (
      <div style={{
        position: "absolute", bottom: 16, left: 16,
        fontSize: 11, color: T.textMuted, fontFamily: T.fontMono,
        background: "rgba(10,10,15,0.6)",
        padding: "6px 10px", borderRadius: T.r_sm,
        backdropFilter: "blur(4px)",
        userSelect: "none",
      }}>
        drag to rotate · scroll to zoom · right-drag to pan · click a node
      </div>
    );
  }
  const crumbs = focused.kind === "genre"      ? [focused.name] :
                 focused.kind === "subgenre"   ? [focused.parent, focused.name] :
                                                 [focused.grandparent, focused.parent, focused.name];
  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16,
      background: "rgba(10,10,15,0.9)",
      border: `1px solid ${T.borderHi}`,
      borderRadius: T.r_md,
      padding: "10px 14px",
      backdropFilter: "blur(6px)",
      fontFamily: T.fontMono,
      maxWidth: 380,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: "0.1em",
        color: T.textMuted, textTransform: "uppercase",
        marginBottom: 4,
      }}>
        {focused.kind === "genre" ? "Genre" : focused.kind === "subgenre" ? "Subgenre" : "Microstyle"}
      </div>
      <div style={{ fontSize: 13, color: T.text, marginBottom: 6, wordBreak: "break-word" }}>
        {crumbs.map((c, i) => (
          <span key={i}>
            <span style={{ color: i === crumbs.length - 1 ? T.text : T.textSec }}>{c}</span>
            {i < crumbs.length - 1 && <span style={{ color: T.textMuted, margin: "0 6px" }}>›</span>}
          </span>
        ))}
      </div>
      <button
        onClick={onClear}
        style={{
          fontSize: 10, color: T.textMuted,
          background: "transparent",
          border: `1px solid ${T.borderHi}`,
          borderRadius: T.r_sm,
          padding: "3px 8px",
          cursor: "pointer",
          fontFamily: T.fontMono,
          letterSpacing: "0.05em",
        }}
      >
        CLEAR ×
      </button>
    </div>
  );
}

function StatsBadge({ layout }) {
  return (
    <div style={{
      position: "absolute", top: 16, right: 16,
      fontSize: 10, color: T.textMuted, fontFamily: T.fontMono,
      background: "rgba(10,10,15,0.6)",
      padding: "6px 10px", borderRadius: T.r_sm,
      backdropFilter: "blur(4px)",
      userSelect: "none",
      letterSpacing: "0.05em",
    }}>
      {layout.genres.length} genres · {layout.subgenres.length} subgenres · {layout.microstyles.length} microstyles
    </div>
  );
}

// ---------------- Top-level component ----------------

export default function GenreMap3D({ genreTree }) {
  const layout = useMemo(() => buildLayout(genreTree || {}), [genreTree]);
  const [show, setShow] = useState({ subgenres: true, microstyles: false });
  const [focused, setFocused] = useState(null); // { kind, name, parent?, grandparent?, position }
  const [hovered, setHovered] = useState(null);
  const controlsRef = useRef();

  const selectGenre = (g) =>
    setFocused({ kind: "genre", name: g.name, position: g.position });
  const selectSubgenre = (s) =>
    setFocused({ kind: "subgenre", name: s.name, parent: s.parent, position: s.position });
  const selectMicrostyle = (m) =>
    setFocused({ kind: "microstyle", name: m.name, parent: m.parent, grandparent: m.grandparent, position: m.position });

  // Dim non-focused nodes when something is focused, to highlight the
  // chain of interest. Tuned to still read as "same map, just narrowed."
  const dimOutside = focused !== null;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "calc(100vh - 80px)",
      minHeight: 500,
      background: "#05050A",
      overflow: "hidden",
    }}>
      <Canvas
        camera={{ position: [0, 6, 70], fov: 55, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        onPointerMissed={() => setFocused(null)}
      >
        <color attach="background" args={["#05050A"]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 0, 0]} intensity={0.6} distance={200} />
        <Suspense fallback={null}>
          <Stars radius={200} depth={60} count={1500} factor={4} saturation={0} fade speed={0.3} />
          {/* Genres are always rendered. */}
          {layout.genres.map((g) => (
            <GenreSun
              key={g.name}
              genre={g}
              isFocused={focused?.kind === "genre" && focused.name === g.name}
              dimmed={dimOutside && !(
                (focused?.kind === "genre"      && focused.name === g.name) ||
                (focused?.kind === "subgenre"   && focused.parent === g.name) ||
                (focused?.kind === "microstyle" && focused.grandparent === g.name)
              )}
              onSelect={() => selectGenre(g)}
            />
          ))}
          {show.subgenres && (
            <SubgenreField
              subgenres={layout.subgenres}
              focused={focused}
              onHover={setHovered}
              onSelect={selectSubgenre}
              dimOutside={dimOutside}
            />
          )}
          {show.microstyles && (
            <MicrostyleField
              microstyles={layout.microstyles}
              focused={focused}
              onHover={setHovered}
              onSelect={selectMicrostyle}
              dimOutside={dimOutside}
            />
          )}
          <HoverTooltip hovered={hovered} />
          <ChainLines focused={focused} layout={layout} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={140}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
          panSpeed={0.6}
        />
        <CameraRig focusTarget={focused} controlsRef={controlsRef} />
      </Canvas>

      <LayerPanel show={show} setShow={setShow} />
      <StatsBadge layout={layout} />
      <FocusHUD focused={focused} onClear={() => setFocused(null)} />
    </div>
  );
}
