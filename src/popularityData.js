/* ═══════════════════════════════════════════════════════════════════
 * popularityData.js — deterministic synthetic popularity timeseries
 *
 * Generates monthly data 1970-01 → 2026-12 (684 points) for each of
 * the 18 genres in the catalog. Values are normalized to 0-100
 * representing RELATIVE popularity vs the most popular genre at that
 * month — so totals across genres don't sum to a fixed number, but
 * no genre ever exceeds ~95-100 at its historical peak.
 *
 * NOT RANDOM. Each genre profile is hand-tuned to reflect real
 * historical trajectories:
 *   - Hip-Hop: 1979 emergence, steady growth, mainstream dominance 2015+
 *   - Disco: explodes 1975, peaks 1978-1980, collapses 1980, slow return
 *   - Metal: 1970 Sabbath emergence, peak 1986-1990, nu-metal boom 2000s
 *   - Electronic: slow burn 1970s, rave 1990s, EDM explosion 2010-2016
 *   - K-pop world: Latin/World pop-cultural wave 2017+
 *
 * The generator composes FOUR curves per genre:
 *   1. Base envelope: logistic S-curve for emergence + optional decline
 *   2. Seasonality: ±4-10% yearly cycle (holiday, summer, etc)
 *   3. Viral spikes: one-shot events (e.g. "Gangnam Style" 2012)
 *   4. Deterministic noise: mulberry32 PRNG seeded by genre name
 *
 * Output is stable: same genre name → same exact series every reload.
 * ═══════════════════════════════════════════════════════════════════ */

/* ───────────── PRNG: deterministic seeded noise ───────────── */

// mulberry32 — 32-bit seeded PRNG, fast, good distribution. We want
// the same genre to produce the same noise every reload, so we hash
// the name into a seed and run the PRNG forward.
function stringHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ───────────── Shape primitives ───────────── */

// Logistic S-curve: value climbs from ~0 at t=emergence to ~1 at
// t=maturity. Used for "genre gaining popularity".
function logistic(t, emergence, maturity) {
  if (t <= emergence) return 0;
  const mid = (emergence + maturity) / 2;
  const k = 8 / (maturity - emergence); // slope — steeper for faster adoption
  return 1 / (1 + Math.exp(-k * (t - mid)));
}

// Decay envelope: value drops from 1 at t=peakEnd to floor at
// t=floorTime. Exponential decay, not linear (more realistic for
// "fading from mainstream").
function decay(t, peakEnd, floorTime, floorLevel) {
  if (t <= peakEnd) return 1;
  if (t >= floorTime) return floorLevel;
  const p = (t - peakEnd) / (floorTime - peakEnd);
  // Ease-out cubic decay: fast initial drop, slower tail
  const eased = 1 - Math.pow(1 - p, 3);
  return 1 - eased * (1 - floorLevel);
}

/* ───────────── Genre profiles ─────────────
 *
 * Each profile encodes a genre's real-world popularity trajectory.
 *
 * Fields:
 *   emergence:     year when genre first registers measurable presence
 *   maturity:      year it reaches its main popularity plateau
 *   peakYear:      single year of maximum popularity
 *   peakLevel:     0-100, how high that peak is vs the most popular
 *                  music of its era. Pop sits at 90+. Gospel tops at 35.
 *   postPeakPath:  "stable" | "gentle-decline" | "steep-decline" | "rebound"
 *                  Controls what happens after peak:
 *                  - stable: holds near peak forever
 *                  - gentle-decline: drops ~30% by 2026
 *                  - steep-decline: drops to floorLevel quickly
 *                  - rebound: drops then recovers (nostalgia revivals)
 *   floorLevel:    0-1 multiplier, what peak drops to if declining
 *   floorTime:     year it reaches that floor (for declining genres)
 *   seasonalityAmp: 0-1, how much the genre swings yearly (±%)
 *   seasonalityPeakMonth: 1-12, which month peaks (December for holiday,
 *                         July for summer, etc)
 *   viralEvents:   [{year, month, magnitude, decay}]
 *                  One-off popularity spikes (e.g. a viral hit).
 *                  magnitude is absolute points added to level; decay is
 *                  months over which it fades.
 *   noiseAmp:      0-1, baseline monthly volatility (~5% typical)
 */

const GENRE_PROFILES = {
  "Pop": {
    emergence: 1955, maturity: 1965, peakYear: 1985, peakLevel: 98,
    postPeakPath: "stable", floorLevel: 0.9,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 6,
    viralEvents: [
      { year: 1983, month: 12, magnitude: 6, decay: 8 },   // Thriller
      { year: 2012, month: 9,  magnitude: 5, decay: 6 },   // Gangnam Style crossover
      { year: 2017, month: 7,  magnitude: 4, decay: 8 },   // Despacito
    ],
    noiseAmp: 0.04,
  },

  "Hip-Hop": {
    emergence: 1979, maturity: 1999, peakYear: 2018, peakLevel: 96,
    postPeakPath: "stable", floorLevel: 0.92,
    seasonalityAmp: 0.05, seasonalityPeakMonth: 7,
    viralEvents: [
      { year: 2015, month: 2,  magnitude: 8, decay: 12 },  // trap mainstream
      { year: 2020, month: 3,  magnitude: 6, decay: 10 },  // lockdown streaming
    ],
    noiseAmp: 0.05,
  },

  "R&B / Soul": {
    emergence: 1955, maturity: 1967, peakYear: 1972, peakLevel: 85,
    postPeakPath: "rebound", floorLevel: 0.55, floorTime: 1995,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 2,
    viralEvents: [
      { year: 2001, month: 6,  magnitude: 7, decay: 20 },  // neo-soul revival
      { year: 2012, month: 10, magnitude: 5, decay: 18 },  // Frank Ocean / The Weeknd
    ],
    noiseAmp: 0.05,
  },

  "Disco / Dance": {
    emergence: 1973, maturity: 1977, peakYear: 1978, peakLevel: 92,
    postPeakPath: "steep-decline", floorLevel: 0.25, floorTime: 1984,
    seasonalityAmp: 0.08, seasonalityPeakMonth: 7,
    viralEvents: [
      { year: 1978, month: 1,  magnitude: 7, decay: 18 },  // Saturday Night Fever
      { year: 1979, month: 7,  magnitude: -15, decay: 36 },// Disco Demolition Night
      { year: 2001, month: 6,  magnitude: 5, decay: 24 },  // French Touch revival
      { year: 2013, month: 5,  magnitude: 6, decay: 18 },  // Daft Punk "Get Lucky"
      { year: 2020, month: 11, magnitude: 7, decay: 24 },  // "Future Nostalgia" era
    ],
    noiseAmp: 0.06,
  },

  "Electronic": {
    emergence: 1971, maturity: 1995, peakYear: 2014, peakLevel: 88,
    postPeakPath: "gentle-decline", floorLevel: 0.75, floorTime: 2026,
    seasonalityAmp: 0.07, seasonalityPeakMonth: 8,
    viralEvents: [
      { year: 1988, month: 7,  magnitude: 6, decay: 24 },  // Second Summer of Love / acid house
      { year: 2011, month: 3,  magnitude: 8, decay: 30 },  // EDM peak: Skrillex, Avicii
      { year: 2014, month: 6,  magnitude: 5, decay: 24 },  // festival culture apex
    ],
    noiseAmp: 0.06,
  },

  "Latin": {
    emergence: 1960, maturity: 1975, peakYear: 2020, peakLevel: 87,
    postPeakPath: "stable", floorLevel: 0.85,
    seasonalityAmp: 0.05, seasonalityPeakMonth: 7,
    viralEvents: [
      { year: 1999, month: 5,  magnitude: 8, decay: 12 },  // Ricky Martin crossover
      { year: 2017, month: 7,  magnitude: 12, decay: 24 }, // Despacito / reggaeton mainstream
      { year: 2022, month: 5,  magnitude: 6, decay: 18 },  // Bad Bunny global
    ],
    noiseAmp: 0.05,
  },

  "Rock": {
    emergence: 1955, maturity: 1965, peakYear: 1975, peakLevel: 97,
    postPeakPath: "gentle-decline", floorLevel: 0.5, floorTime: 2022,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 5,
    viralEvents: [
      { year: 1991, month: 9,  magnitude: 8, decay: 24 },  // Nevermind / grunge
      { year: 2001, month: 8,  magnitude: 5, decay: 18 },  // garage rock revival (Strokes)
    ],
    noiseAmp: 0.04,
  },

  "Metal": {
    emergence: 1970, maturity: 1984, peakYear: 1988, peakLevel: 72,
    postPeakPath: "rebound", floorLevel: 0.45, floorTime: 1995,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 10,
    viralEvents: [
      { year: 1999, month: 8,  magnitude: 10, decay: 24 }, // nu-metal peak (Limp Bizkit, Korn)
      { year: 2020, month: 4,  magnitude: 4, decay: 18 },  // metal streaming resurgence
    ],
    noiseAmp: 0.05,
  },

  "World / Global": {
    emergence: 1970, maturity: 1990, peakYear: 2022, peakLevel: 65,
    postPeakPath: "stable", floorLevel: 0.6,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 7,
    viralEvents: [
      { year: 1986, month: 9,  magnitude: 5, decay: 18 },  // Graceland / world-music as category
      { year: 2012, month: 8,  magnitude: 8, decay: 18 },  // K-pop global breakthrough
      { year: 2019, month: 4,  magnitude: 7, decay: 24 },  // BTS / Latin pop crest
    ],
    noiseAmp: 0.05,
  },

  "Blues": {
    emergence: 1950, maturity: 1960, peakYear: 1968, peakLevel: 58,
    postPeakPath: "gentle-decline", floorLevel: 0.35, floorTime: 2026,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 9,
    viralEvents: [
      { year: 1990, month: 5, magnitude: 5, decay: 24 },   // Robert Cray / SRV nostalgia
    ],
    noiseAmp: 0.04,
  },

  "Country / Americana": {
    emergence: 1950, maturity: 1960, peakYear: 1996, peakLevel: 75,
    postPeakPath: "stable", floorLevel: 0.72,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 7,
    viralEvents: [
      { year: 1992, month: 8, magnitude: 6, decay: 24 },   // Billy Ray Cyrus / Garth Brooks
      { year: 2019, month: 4, magnitude: 8, decay: 12 },   // "Old Town Road" crossover
      { year: 2023, month: 7, magnitude: 6, decay: 18 },   // Morgan Wallen / Zach Bryan era
    ],
    noiseAmp: 0.04,
  },

  "Folk / Acoustic": {
    emergence: 1950, maturity: 1962, peakYear: 1969, peakLevel: 70,
    postPeakPath: "rebound", floorLevel: 0.35, floorTime: 1985,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 10,
    viralEvents: [
      { year: 2011, month: 2, magnitude: 8, decay: 24 },   // Mumford / Lumineers indie folk
      { year: 2020, month: 7, magnitude: 5, decay: 18 },   // folklore / evermore
    ],
    noiseAmp: 0.04,
  },

  "Jazz": {
    emergence: 1950, maturity: 1955, peakYear: 1958, peakLevel: 80,
    postPeakPath: "gentle-decline", floorLevel: 0.25, floorTime: 2026,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 11,
    viralEvents: [
      { year: 1959, month: 8,  magnitude: 4, decay: 18 },  // "Kind of Blue"
      { year: 2015, month: 5,  magnitude: 3, decay: 12 },  // Kendrick Lamar jazz-rap renaissance
    ],
    noiseAmp: 0.04,
  },

  "Ambient / New Age": {
    emergence: 1975, maturity: 1985, peakYear: 1994, peakLevel: 45,
    postPeakPath: "rebound", floorLevel: 0.45, floorTime: 2010,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 12,
    viralEvents: [
      { year: 2017, month: 3,  magnitude: 6, decay: 30 },  // lo-fi / study streams boom
      { year: 2020, month: 4,  magnitude: 8, decay: 24 },  // pandemic relaxation streaming
    ],
    noiseAmp: 0.04,
  },

  "Soundtrack / Score": {
    emergence: 1950, maturity: 1975, peakYear: 2015, peakLevel: 62,
    postPeakPath: "stable", floorLevel: 0.6,
    seasonalityAmp: 0.06, seasonalityPeakMonth: 12,
    viralEvents: [
      { year: 1977, month: 5, magnitude: 8, decay: 12 },   // Star Wars phenomenon
      { year: 1997, month: 12,magnitude: 6, decay: 12 },   // Titanic score
      { year: 2018, month: 2, magnitude: 4, decay: 12 },   // MCU omnipresence
    ],
    noiseAmp: 0.05,
  },

  "Classical / Orchestral": {
    emergence: 1950, maturity: 1955, peakYear: 1958, peakLevel: 55,
    postPeakPath: "gentle-decline", floorLevel: 0.4, floorTime: 2026,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 12,
    viralEvents: [
      { year: 2020, month: 4, magnitude: 4, decay: 24 },   // lockdown classical playlist spike
    ],
    noiseAmp: 0.03,
  },

  "Gospel / Spiritual": {
    emergence: 1950, maturity: 1960, peakYear: 1972, peakLevel: 40,
    postPeakPath: "gentle-decline", floorLevel: 0.55, floorTime: 2026,
    seasonalityAmp: 0.07, seasonalityPeakMonth: 12,
    viralEvents: [
      { year: 2004, month: 10, magnitude: 5, decay: 12 },  // Kanye's Jesus Walks
      { year: 2019, month: 11, magnitude: 6, decay: 18 },  // Jesus Is King / Lauren Daigle crossover
    ],
    noiseAmp: 0.04,
  },

  "Experimental": {
    emergence: 1970, maturity: 1985, peakYear: 2012, peakLevel: 35,
    postPeakPath: "stable", floorLevel: 0.8,
    seasonalityAmp: 0.02, seasonalityPeakMonth: 10,
    viralEvents: [
      { year: 2014, month: 6, magnitude: 4, decay: 24 },   // Death Grips / PC Music
    ],
    noiseAmp: 0.06,
  },
};

/* ───────────── Series generation ───────────── */

const START_YEAR = 1970;
const END_YEAR = 2026;
const END_MONTH = 12;

// Returns array of { year, month, t } for every month in the range.
// t is a float year (e.g. 2018.5 = mid-July 2018) for curve math.
function buildTimeline() {
  const out = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const maxM = y === END_YEAR ? END_MONTH : 12;
    for (let m = 1; m <= maxM; m++) {
      out.push({ year: y, month: m, t: y + (m - 1) / 12 });
    }
  }
  return out;
}

// Given a profile and a month { year, month, t }, compute the level
// (0-100) at that point. Composes envelope × seasonality + viral +
// noise.
function sampleProfile(profile, sample, rng) {
  const { t, month } = sample;

  // ── Envelope: rising S-curve → peak → optional decline ────────────
  // Rise: 0 pre-emergence → peakLevel at maturity.
  const rise = logistic(t, profile.emergence, profile.maturity);

  // After peak (peakYear), apply postPeakPath shape.
  let postPeak = 1;
  if (t > profile.peakYear) {
    const floorTime = profile.floorTime || 2026;
    if (profile.postPeakPath === "stable") {
      postPeak = profile.floorLevel + (1 - profile.floorLevel) * 0.95; // ~95% hold
    } else if (profile.postPeakPath === "gentle-decline") {
      postPeak = decay(t, profile.peakYear, floorTime, profile.floorLevel);
    } else if (profile.postPeakPath === "steep-decline") {
      postPeak = decay(t, profile.peakYear, floorTime, profile.floorLevel);
    } else if (profile.postPeakPath === "rebound") {
      // Decline to mid then rebound toward 0.75-0.85 of peak
      const trough = profile.floorLevel;
      const rebound = Math.min(1, (trough + 0.4));
      const midTime = (profile.peakYear + floorTime) / 2;
      if (t <= midTime) {
        postPeak = decay(t, profile.peakYear, midTime, trough);
      } else {
        const p = Math.min(1, (t - midTime) / (2026 - midTime));
        postPeak = trough + (rebound - trough) * (1 - Math.pow(1 - p, 2));
      }
    }
  }

  const baseline = rise * postPeak * profile.peakLevel;

  // ── Seasonality: sinusoidal with phase controlled by peak month ───
  const phase = ((month - profile.seasonalityPeakMonth) / 12) * Math.PI * 2;
  const seasonal = Math.cos(phase) * profile.seasonalityAmp * baseline;

  // ── Viral spikes: add magnitude that decays over decay months ─────
  let viral = 0;
  for (const ev of profile.viralEvents) {
    const eventT = ev.year + (ev.month - 1) / 12;
    const delta = t - eventT;
    if (delta < 0) continue; // event hasn't happened yet
    const monthsSince = delta * 12;
    if (monthsSince > ev.decay * 2) continue; // event fully decayed
    // Triangle profile: ramp up 2 months, decay over `decay` months
    let shape;
    if (monthsSince < 2) shape = monthsSince / 2;
    else {
      const decayP = (monthsSince - 2) / ev.decay;
      shape = Math.max(0, 1 - decayP);
    }
    viral += ev.magnitude * shape;
  }

  // ── Noise: deterministic per sample ───────────────────────────────
  const noise = (rng() - 0.5) * 2 * profile.noiseAmp * Math.max(5, baseline);

  const value = baseline + seasonal + viral + noise;
  return Math.max(0, Math.min(100, value));
}

/* ═══════════════════════════════════════════════════════════════════
 * Sub-genre archetypes — classification-based curve generation
 *
 * 294 sub-genres is too many to hand-tune. But real popularity curves
 * cluster into a small number of distinct patterns:
 *   - emergent-tiktok: exploded 2020+ (Phonk, Hyperpop, Jersey Club)
 *   - emergent-2010s:  rose in streaming era (Afrobeats, Bedroom Pop)
 *   - nostalgic-revival: old style rediscovered (Nu-Disco, Emo Revival)
 *   - steady-classic: rooted in a decade, still played (Neo-Soul, Boom Bap)
 *   - crested-1980s / 1990s / 2000s: peaked then faded
 *   - regional: tied to a place, grew as its region grew (Reggaeton, K-Pop)
 *   - niche: low absolute volume but consistent (Free Jazz, Drone)
 *   - dead: purely historical (Doo-Wop, Cool Jazz, Italo Disco)
 *
 * We pattern-match the sub-genre name against keyword rules to assign
 * an archetype, then instantiate that archetype with parameters
 * inherited from the parent genre (so Hip-Hop subs share Hip-Hop's
 * 1979 emergence and Pop subs share Pop's high ceiling).
 *
 * This is more accurate than a flat "everything is a bell curve"
 * approach — the patterns ARE real. And it's honest: Trap didn't
 * exist in 1985, so its curve starts at ~2010 regardless of
 * Hip-Hop's 1979 start.
 * ═══════════════════════════════════════════════════════════════════ */

// Keywords → archetype. Order matters — first match wins. More
// specific rules before general ones.
const SUBGENRE_RULES = [
  // ── TikTok-era (2020+) ──────────────────────────────────────────
  { match: /(hyperpop|phonk|digicore|sigilkore|hexd|plugg|rage|jerk|drill|krushclub|glitchcore|recession pop|indie sleaze|3-step|gqom|bassline|hardcore revival|dance music revival|amapiano|afro drill|afroswing|corridos tumbados|electrocorridos|cumbia bélica|neoperreo|reggaeton mexa|reggaeton chileno|guaracha|aleteo|afro fusion|afro futurism|afro deep|afro tech|afro house|afro r&b|k-pop 5th gen|afropop crossover|pop country crossover|pluggnb|dark plugg|terror plugg|ambient plugg|phonk house|dark melodic techno|hard techno|baltimore club)/i,
    archetype: "emergent-tiktok" },

  // ── Streaming-era (2012-2019) ───────────────────────────────────
  { match: /(trap soul|afrobeats|afrofusion|latin trap|melodic rap|latin afrobeat|k-pop|afropop|bedroom pop|dark pop|lo-fi hip-hop|jersey club|jersey drill|sexy drill|cloud rap|afro r&b|conscious hip-hop|uk rap|french rap|latin rap|drum and bass latino|tropical house|trap|future bass|indie dance|indie house|melodic house|melodic techno|spiritual jazz|alt r&b|anti-folk|dark folk|cinematic folk|dark ambient|dark classical|blackgaze|post-metal|afro futurism|dancehall|reggaeton|dembow)/i,
    archetype: "emergent-2010s" },

  // ── Nostalgic revivals (old thing coming back) ──────────────────
  { match: /(revival|nu-|neo-|neo |retro|vintage|folk revival|grunge revival|emo revival|disco-house|post-classical|motown revival|trip-hop|synthwave|vaporwave|chillwave|britpop|post-punk|disco-punk|progressive bluegrass|indie folk|freak folk|psych folk|new age|art pop|chamber pop|baroque pop|dream pop|indie pop|post-rock|shoegaze|math rock|post-hardcore|industrial electronic|industrial metal)/i,
    archetype: "nostalgic-revival" },

  // ── 2000s-era EDM peak (emerged 1990s, peaked 2008-2014) ────────
  { match: /(dubstep|drum and bass|future bass|hardstyle|progressive house|tech-house|minimal techno|trance|electro house|big room)/i,
    archetype: "crested-2000s" },

  // ── Emo peak 2003-2007 ──────────────────────────────────────────
  { match: /(^emo$|emo pop)/i,
    archetype: "crested-2000s" },

  // ── 1970s funk/soul peak ────────────────────────────────────────
  { match: /(^funk$|gospel soul|uk soul|afro-disco|balearic|afrobeat\b)/i,
    archetype: "crested-1970s" },

  // ── Rave/House core — peaked late 80s/early 90s, steady presence ─
  { match: /(^house$|^techno$|dark techno|idm)/i,
    archetype: "crested-1990s" },

  // ── Pop sub-families that track parent Pop closely ──────────────
  { match: /(dance-pop|country-pop|latin pop|adult contemporary)/i,
    archetype: "parent-echo" },

  // ── Reggae/ska: Caribbean classics with persistent presence ─────
  { match: /(^reggae$|^ska$|^soca$|dancehall)/i,
    archetype: "regional" },

  // ── Country variants — track the Country parent ─────────────────
  { match: /(neotraditional country|country-rock|country-rap|red dirt|texas country)/i,
    archetype: "parent-echo" },

  // ── Jazz-hop / contemporary jazz (2010s lo-fi era) ──────────────
  { match: /(jazz-hop|contemporary jazz)/i,
    archetype: "emergent-2010s" },

  // ── Acoustic singer-songwriter — steady, no peak ────────────────
  { match: /(acoustic singer-songwriter)/i,
    archetype: "steady-long" },

  // ── Ambient base (distinct from dark ambient) ───────────────────
  { match: /(^ambient$)/i,
    archetype: "niche" },

  // ── Contemporary Christian / Worship / Black Gospel / Southern ──
  { match: /(contemporary christian|worship music|black gospel|southern gospel)/i,
    archetype: "parent-echo" },

  // ── 1990s-era (peaked 1990s, varied afterlife) ──────────────────
  { match: /(boom bap|alternative hip-hop|gangsta rap|grime|alt rock|alternative rock|indie rock|punk rock|hardcore punk|gothic rock|shoegaze|neo-soul|new jack swing|contemporary r&b|acid house|electro|breakbeat|uk garage|hard bop|smooth jazz|jazz fusion|nu-metal|metalcore|deathcore|thrash metal|death metal|black metal|doom metal|progressive metal|power metal|symphonic metal|folk metal|grindcore|alt-country|outlaw country|contemporary country|alt-country|americana)/i,
    archetype: "crested-1990s" },

  // ── 1980s era (peaked 1980s, declined) ──────────────────────────
  { match: /(hi-nrg|euro disco|italo disco|synth-pop|electropop|power pop|new age|cosmic disco|space disco|quiet storm|boogie|boogie disco|chicago blues|electric blues|blues rock|texas blues|hill country blues|soul blues|jump blues|acoustic blues|delta blues|prog rock|progressive rock|psychedelic rock|stoner rock|garage rock|hardcore punk)/i,
    archetype: "crested-1980s" },

  // ── Pre-1980s, often still played but low intensity ─────────────
  { match: /(doo-wop|swing|bebop|cool jazz|hard bop|vocal jazz|bossa nova|classic disco|baroque|opera|choral|romantic|chamber music|symphonic|contemporary classical|neoclassical|traditional gospel|sacred choral|honky-tonk|western swing|bluegrass|appalachian folk|celtic folk|nordic folk|flamenco fusion|fado|klezmer|tango|bolero|mariachi|polka|ragtime|vaudeville)/i,
    archetype: "historical-classic" },

  // ── Regional (tied to a place) ──────────────────────────────────
  { match: /(bollywood|bhangra|qawwali|arabic|turkish|indian classical|j-pop|city pop|mandopop|highlife|balkan|latin jazz|jazz colombiano|sertanejo|cumbia|samba|merengue|salsa|bachata|regional mexican|brazilian|funk carioca)/i,
    archetype: "regional" },

  // ── Niche (small but steady) ────────────────────────────────────
  { match: /(free jazz|modal jazz|noir jazz|avant-garde|noise|glitch|musique concrète|sound collage|algorave|drone|space music|tape ambient|dark ambient|experimental|chamber|minimalist|micro|ambient pop|ambient electronic|progressive bluegrass|sufi|devotional|trailer music|game ost|anime ost|horror score|documentary score|musical theater|film score|orchestral score|opera)/i,
    archetype: "niche" },

  // ── Catch-all: inherit parent's shape, slightly smaller ─────────
];

// Archetype definitions. Each defines the temporal pattern (when it
// emerged, where it peaked, what happened after) as relative
// parameters that get instantiated per sub-genre with the parent
// genre's context.
const ARCHETYPES = {
  "emergent-tiktok": {
    emergence: 2019, maturity: 2023, peakYear: 2025, peakLevel: 0.55,
    postPeakPath: "stable", floorLevel: 0.95,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 8,
    noiseAmp: 0.08,
    viral: (rng) => [
      { year: 2021 + Math.floor(rng() * 3), month: 1 + Math.floor(rng() * 12),
        magnitude: 4 + rng() * 6, decay: 6 + rng() * 12 },
    ],
  },
  "emergent-2010s": {
    emergence: 2010, maturity: 2017, peakYear: 2022, peakLevel: 0.65,
    postPeakPath: "stable", floorLevel: 0.88,
    seasonalityAmp: 0.05, seasonalityPeakMonth: 7,
    noiseAmp: 0.06,
    viral: (rng) => [
      { year: 2016 + Math.floor(rng() * 4), month: 1 + Math.floor(rng() * 12),
        magnitude: 3 + rng() * 5, decay: 10 + rng() * 14 },
    ],
  },
  "nostalgic-revival": {
    // Two-peak shape: small initial peak in the original era, faded,
    // then rediscovered 2000+ with second (usually bigger) peak.
    emergence: 1975, maturity: 1985, peakYear: 2015, peakLevel: 0.5,
    postPeakPath: "stable", floorLevel: 0.9,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 6,
    noiseAmp: 0.06,
    viral: (rng) => [
      { year: 2005 + Math.floor(rng() * 12), month: 1 + Math.floor(rng() * 12),
        magnitude: 4 + rng() * 6, decay: 18 + rng() * 18 },
    ],
  },
  "crested-1970s": {
    emergence: 1965, maturity: 1972, peakYear: 1977, peakLevel: 0.55,
    postPeakPath: "rebound", floorLevel: 0.35, floorTime: 1995,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 7,
    noiseAmp: 0.04,
    viral: (rng) => [
      { year: 2010 + Math.floor(rng() * 10), month: 1 + Math.floor(rng() * 12),
        magnitude: 3 + rng() * 4, decay: 18 + rng() * 18 },
    ],
  },
  "crested-2000s": {
    emergence: 1998, maturity: 2008, peakYear: 2012, peakLevel: 0.6,
    postPeakPath: "gentle-decline", floorLevel: 0.45, floorTime: 2026,
    seasonalityAmp: 0.06, seasonalityPeakMonth: 7,
    noiseAmp: 0.06,
    viral: (rng) => [
      { year: 2011 + Math.floor(rng() * 3), month: 1 + Math.floor(rng() * 12),
        magnitude: 4 + rng() * 4, decay: 18 + rng() * 18 },
    ],
  },
  "parent-echo": {
    // For sub-genres that have no distinct historical arc — they
    // track the parent's shape at a reduced scale. Inherits the
    // parent's emergence/peak so the curve looks like a dimmed echo.
    // We encode this as a near-stable long curve and let parent peakLevel
    // scaling keep it in proportion.
    emergence: 1965, maturity: 1975, peakYear: 1995, peakLevel: 0.42,
    postPeakPath: "stable", floorLevel: 0.88,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 6,
    noiseAmp: 0.04,
    viral: (rng) => [],
  },
  "steady-long": {
    // Ever-present, low-volume, no sharp peak. Like singer-songwriter
    // material that's always been around but never a trend.
    emergence: 1960, maturity: 1970, peakYear: 2000, peakLevel: 0.3,
    postPeakPath: "stable", floorLevel: 0.95,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 10,
    noiseAmp: 0.04,
    viral: (rng) => [],
  },
  "crested-1990s": {
    emergence: 1985, maturity: 1993, peakYear: 1998, peakLevel: 0.6,
    postPeakPath: "gentle-decline", floorLevel: 0.5, floorTime: 2026,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 5,
    noiseAmp: 0.05,
    viral: (rng) => [],
  },
  "crested-1980s": {
    emergence: 1976, maturity: 1983, peakYear: 1987, peakLevel: 0.55,
    postPeakPath: "gentle-decline", floorLevel: 0.4, floorTime: 2010,
    seasonalityAmp: 0.05, seasonalityPeakMonth: 7,
    noiseAmp: 0.05,
    viral: (rng) => [],
  },
  "historical-classic": {
    emergence: 1950, maturity: 1958, peakYear: 1965, peakLevel: 0.4,
    postPeakPath: "gentle-decline", floorLevel: 0.3, floorTime: 2000,
    seasonalityAmp: 0.03, seasonalityPeakMonth: 11,
    noiseAmp: 0.03,
    viral: (rng) => [],
  },
  "regional": {
    // Parent-inherited, steady growth with the region
    emergence: 1970, maturity: 1995, peakYear: 2020, peakLevel: 0.45,
    postPeakPath: "stable", floorLevel: 0.88,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 7,
    noiseAmp: 0.05,
    viral: (rng) => [],
  },
  "niche": {
    emergence: 1970, maturity: 1988, peakYear: 2005, peakLevel: 0.22,
    postPeakPath: "stable", floorLevel: 0.9,
    seasonalityAmp: 0.02, seasonalityPeakMonth: 10,
    noiseAmp: 0.06,
    viral: (rng) => [],
  },
  // Fallback when nothing matches — inherits parent closely
  "default": {
    emergence: 1990, maturity: 2005, peakYear: 2018, peakLevel: 0.45,
    postPeakPath: "gentle-decline", floorLevel: 0.7, floorTime: 2026,
    seasonalityAmp: 0.04, seasonalityPeakMonth: 6,
    noiseAmp: 0.05,
    viral: (rng) => [],
  },
};

function classifySubgenre(name) {
  for (const rule of SUBGENRE_RULES) {
    if (rule.match.test(name)) return rule.archetype;
  }
  return "default";
}

// Build a profile for a sub-genre by:
//   1. Classifying it into an archetype
//   2. Scaling its peakLevel by the parent genre's peakLevel
//      (so Electronic subs can go higher than Gospel subs)
//   3. Slightly perturbing emergence/maturity years with a seeded
//      offset so no two subs have identical curves
//   4. Generating 0-2 viral events via the archetype's viral factory
function buildSubgenreProfile(name, parentGenre) {
  const archetypeKey = classifySubgenre(name);
  const archetype = ARCHETYPES[archetypeKey];
  const parent = GENRE_PROFILES[parentGenre];
  const rng = mulberry32(stringHash(name + "|" + parentGenre));

  // Scaled peak — take archetype's peakLevel (0-1) and multiply by
  // parent's peakLevel (0-100). So a "niche" sub of Pop ends up
  // around 22, while a "niche" sub of Gospel ends up around 9.
  const parentPeakLevel = parent ? parent.peakLevel : 50;
  // Add slight variation (±10%) so no two subs have identical peaks
  const variation = 0.9 + rng() * 0.2;
  const peakLevel = Math.max(3, Math.min(85, archetype.peakLevel * parentPeakLevel * variation));

  // Slight temporal jitter (±1 year on emergence) for signature
  const emergenceJitter = (rng() - 0.5) * 2;
  const emergence = archetype.emergence + emergenceJitter;
  const maturity = archetype.maturity + emergenceJitter;
  // Keep peak year stable unless archetype explicitly moves it
  const peakYear = archetype.peakYear;

  // Peak month slightly randomized for flavor
  const peakMonth = ((archetype.seasonalityPeakMonth - 1 + Math.floor(rng() * 3) - 1) % 12) + 1;

  return {
    emergence,
    maturity,
    peakYear,
    peakLevel,
    postPeakPath: archetype.postPeakPath,
    floorLevel: archetype.floorLevel,
    floorTime: archetype.floorTime,
    seasonalityAmp: archetype.seasonalityAmp,
    seasonalityPeakMonth: peakMonth,
    viralEvents: archetype.viral(rng),
    noiseAmp: archetype.noiseAmp,
    _archetype: archetypeKey,
  };
}

/* ───────────── Sub-genre public API ───────────── */

// Sub-series cache — keyed by "ParentName/SubName" for uniqueness
// (Afro House could be under Electronic AND under World/Global, and
// they need separate curves).
const _subCache = new Map();

// Returns { name, parent, archetype, series } or null if no parent profile.
// NOTE: this does not know the catalog structure. The component
// passes (parentGenre, subName) in — derived from GENRE_TREE.
export function getSubgenreSeries(parentGenre, subName) {
  const key = `${parentGenre}/${subName}`;
  if (_subCache.has(key)) return _subCache.get(key);
  if (!GENRE_PROFILES[parentGenre]) return null;

  const profile = buildSubgenreProfile(subName, parentGenre);
  const rng = mulberry32(stringHash(key + "|sub"));
  const timeline = buildTimeline();
  const series = timeline.map(s => ({
    t: s.t, year: s.year, month: s.month,
    value: sampleProfile(profile, s, rng),
  }));
  const result = {
    name: subName,
    parent: parentGenre,
    archetype: profile._archetype,
    series,
  };
  _subCache.set(key, result);
  return result;
}

/* ═══════════════════════════════════════════════════════════════════
 * Micro-style generation
 *
 * Honest observation: 1180 micro-styles aren't 1180 distinct musical
 * movements. They're variants WITHIN a sub-genre's movement. "Atlanta
 * trap" isn't historically separate from "Trap" — same era, same
 * shape, just a regional/textural variant.
 *
 * So we don't build a 3rd archetype system. We inherit the parent
 * sub's profile and apply per-micro perturbations:
 *   - Peak year shifted ±2 years (some variants lead, some lag)
 *   - Peak level scaled 0.45-0.75 of parent (micro < sub < genre)
 *   - One small viral event seeded by the micro name
 *   - Different seasonality phase (distinguishes overlaid micros)
 *
 * The result: a micro's curve is clearly part of its sub's family,
 * but distinguishable when overlaid.
 * ═══════════════════════════════════════════════════════════════════ */

function buildMicrostyleProfile(name, parentGenre, parentSub) {
  const subProfile = buildSubgenreProfile(parentSub, parentGenre);
  const rng = mulberry32(stringHash(`${parentGenre}/${parentSub}/${name}|micro`));

  const peakShift = (rng() - 0.5) * 4;                              // ±2 years
  const peakScale = 0.45 + rng() * 0.3;                             // 0.45 - 0.75
  const monthShift = Math.floor((rng() - 0.5) * 6);                 // ±3 months
  const peakMonth = ((subProfile.seasonalityPeakMonth - 1 + monthShift + 12) % 12) + 1;

  // One micro-specific viral event — lightweight, within the era the
  // sub itself is relevant (between emergence and 2025).
  const subEmergence = subProfile.emergence;
  const subPeak = subProfile.peakYear;
  const rangeYears = Math.max(4, Math.floor(subPeak - subEmergence));
  const viralYear = Math.min(2025, Math.floor(subEmergence + 2 + rng() * rangeYears));
  const viralEvents = [{
    year: viralYear,
    month: 1 + Math.floor(rng() * 12),
    magnitude: 2 + rng() * 4,
    decay: 8 + rng() * 14,
  }];

  return {
    emergence: subProfile.emergence,
    maturity: subProfile.maturity,
    peakYear: subProfile.peakYear + peakShift,
    peakLevel: Math.max(2, subProfile.peakLevel * peakScale),
    postPeakPath: subProfile.postPeakPath,
    floorLevel: subProfile.floorLevel,
    floorTime: subProfile.floorTime,
    seasonalityAmp: subProfile.seasonalityAmp * 1.1,
    seasonalityPeakMonth: peakMonth,
    viralEvents,
    noiseAmp: subProfile.noiseAmp * 1.3,
    _archetype: subProfile._archetype + ":micro",
  };
}

const _microCache = new Map();

// Returns { name, parent, grandparent, archetype, series } or null.
export function getMicrostyleSeries(parentGenre, parentSub, microName) {
  const key = `${parentGenre}/${parentSub}/${microName}`;
  if (_microCache.has(key)) return _microCache.get(key);
  if (!GENRE_PROFILES[parentGenre]) return null;

  const profile = buildMicrostyleProfile(microName, parentGenre, parentSub);
  const rng = mulberry32(stringHash(key + "|series"));
  const timeline = buildTimeline();
  const series = timeline.map(s => ({
    t: s.t, year: s.year, month: s.month,
    value: sampleProfile(profile, s, rng),
  }));
  const result = {
    name: microName,
    parent: parentSub,
    grandparent: parentGenre,
    archetype: profile._archetype,
    series,
  };
  _microCache.set(key, result);
  return result;
}


const _cache = new Map();

// Build and cache the series for a genre name. Returns:
//   { name, series: [{t, year, month, value}] }
// If the genre has no profile, returns null.
export function getGenreSeries(name) {
  if (_cache.has(name)) return _cache.get(name);
  const profile = GENRE_PROFILES[name];
  if (!profile) return null;
  const rng = mulberry32(stringHash(name));
  const timeline = buildTimeline();
  const series = timeline.map(s => ({
    t: s.t, year: s.year, month: s.month,
    value: sampleProfile(profile, s, rng),
  }));
  const result = { name, series };
  _cache.set(name, result);
  return result;
}

// List every genre we have a profile for.
export function getAllGenres() {
  return Object.keys(GENRE_PROFILES);
}

// Find what the highest value in a given series is + when — used for
// rendering "PEAK · 1978 · 92" annotations.
export function findPeak(series) {
  let best = series[0];
  for (const s of series) {
    if (s.value > best.value) best = s;
  }
  return best;
}

// Find the most recent (latest month) value — used for current-level
// badge on the selector.
export function currentValue(series) {
  return series[series.length - 1].value;
}

/* ───────────── Cultural eras for the timeline scrubber ─────────────
 *
 * Hand-curated labels that anchor sections of the timeline to
 * recognizable cultural moments. The graph timeline will render these
 * as subtle vertical annotations.
 */
export const ERAS = [
  { start: 1970, end: 1979, label: "DISCO ERA" },
  { start: 1980, end: 1989, label: "MTV ERA" },
  { start: 1990, end: 1998, label: "CD BOOM" },
  { start: 1999, end: 2004, label: "NAPSTER CRASH" },
  { start: 2005, end: 2010, label: "iPOD ERA" },
  { start: 2011, end: 2016, label: "EDM + YOUTUBE" },
  { start: 2017, end: 2022, label: "STREAMING ERA" },
  { start: 2023, end: 2026, label: "TIKTOK ERA" },
];

export const TIME_RANGE = { startYear: START_YEAR, endYear: END_YEAR, endMonth: END_MONTH };
