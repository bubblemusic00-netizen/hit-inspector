// Dark monitoring-dashboard tokens. Deliberately different from Hit
// Engine's casino aesthetic — this is a data-inspection tool, not a
// consumer product. Clean, legible, focused. Monospace for identifiers.

export const T = {
  // Backgrounds (deepest to lightest)
  bg:        "#0a0a0a",
  bgSurface: "#111",
  bgCard:    "#171717",
  bgHover:   "#1f1f1f",

  // Text
  text:      "#eee",
  textSec:   "#aaa",
  textMuted: "#666",
  textDim:   "#444",

  // Borders
  border:    "#222",
  borderHi:  "#333",

  // Accents
  accent:    "#5E6AD2",   // indigo, matches Hit Engine's Linear-inspired T.accent
  success:   "#10b981",
  warning:   "#f59e0b",
  error:     "#ef4444",
  info:      "#06b6d4",

  // Data-viz palette (for bars, dots, categorical coloring)
  palette:   ["#5E6AD2","#10b981","#f59e0b","#ef4444","#06b6d4","#a855f7","#ec4899","#84cc16","#f97316","#14b8a6"],

  // Typography
  fontSans:  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
  fontMono:  `"SF Mono", Menlo, Consolas, "Courier New", monospace`,

  // Spacing (4-px base scale)
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48, s8: 64,

  // Radii
  r_sm: 4, r_md: 6, r_lg: 8,
};
