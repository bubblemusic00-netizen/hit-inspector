# Hit Inspector

A **local dev tool** for inspecting Hit Engine's data catalogs. Not deployed.
Reads directly from `C:\hit-engine\src\App.jsx` on every request, so live
edits to Hit Engine surface in the inspector as soon as you refresh.

## One-time setup

```
cd C:\hit-inspector
npm install
```

## Run

```
npm run dev
```

Opens on http://localhost:5174

Port 5174 is used so it won't clash with Hit Engine on 5173 — you can run
both at the same time.

## Custom Hit Engine path

The inspector looks in these places in order:

1. Environment variable `HIT_ENGINE_PATH`
2. `C:\hit-engine\src\App.jsx` (Windows default)
3. `~/hit-engine/src/App.jsx` (Unix/Mac fallback)
4. `../hit-engine/src/App.jsx` (sibling-directory fallback)

If your Hit Engine lives somewhere else, set the env var in PowerShell:

```powershell
$env:HIT_ENGINE_PATH = "D:\projects\hit-engine\src\App.jsx"
npm run dev
```

If the inspector can't find your App.jsx, it shows an error page with the
paths it tried and a hint.

## What's shown

### Left sidebar

12 categories grouped by kind:

- **Genre** — Genres / Sub-genres / Micro-styles
- **Character** — Moods / Energy arcs
- **Rhythm** — Grooves
- **Vocal** — Vocalists / Lyrical vibes / Languages
- **Sound** — Instruments / Harmonic styles / Textures / Mix characters

### Per-category tabs

- **Items** — sortable, filterable list with cross-reference counts
- **Family** — pairings from the complement tables (what goes with what)
- **Statistics** — bar chart of cross-reference ranking + summary cards

### Overview page

Catalog totals, complement-table coverage gaps highlighted in yellow.

## How "popularity" is computed

Real signal from catalog cross-references. An item's popularity = how
many times it appears inside OTHER complement-table entries. If
"Euphoric" is listed as a pairing inside 17 different groove/vocal/lyrical
entries, its cross-ref count is 17.

No fake analytics, no invented numbers. If an item has low xref, it
genuinely is under-referenced in the current catalog — that's a real
gap worth inspecting.

## Categories without pairings

Languages, Genres, Sub-genres, Micro-styles, and Instruments don't have
complement tables, so their Family/Stats views use different visualizations
(tree explorer, sub/micro distribution).

## Files

```
hit-inspector/
├── package.json          deps: React + Vite
├── vite.config.js        dev plugin that extracts data from App.jsx
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx           router + shell
    ├── theme.js          design tokens (dark monitoring-dashboard look)
    ├── categories.js     central category config + derived-stats builder
    └── components/
        ├── Layout.jsx
        ├── CategoryPage.jsx
        ├── OverviewPage.jsx
        ├── ItemsView.jsx
        ├── FamilyView.jsx
        └── StatsView.jsx
```

## When Hit Engine's data schema changes

If you add a new catalog array in Hit Engine (e.g. `const MOODS_V2 = [...]`)
or a new complement table, the inspector needs to know to read it:

1. Open `vite.config.js`
2. Add the constant name to `WANTED_CONSTS`
3. Open `src/categories.js`
4. Add a new entry to `CATEGORIES` with the right `shape` and `complementTable`

Restart the dev server. New category appears in sidebar.
