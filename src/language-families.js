// ═══════════════════════════════════════════════════════════════════════
// LANGUAGE FAMILIES — static metadata for the Languages family/stats view.
// ═══════════════════════════════════════════════════════════════════════
//
// Two independent taxonomies. Each language (by ISO code) appears in
// exactly one group per taxonomy.
//
// LINGUISTIC = academically correct. Groups languages by shared
//   ancestry and grammatical structure.
//
// MUSIC_CONTEXT = utility-driven. Groups languages by how they cluster
//   in modern pop/regional music scenes — what a producer would think
//   of as "the Latin bucket" or "the East Asian pop bucket."
//
// Codes correspond to LANGUAGES[].code in Hit Engine's App.jsx. Adding
// a new language to Hit Engine means adding it here too (the Overview
// will show it as "uncategorized" until it's placed).
// ═══════════════════════════════════════════════════════════════════════

export const LINGUISTIC_FAMILIES = {
  "Indo-European — Germanic":       ["en", "de"],
  "Indo-European — Romance":        ["es", "pt", "fr", "it"],
  "Indo-European — Slavic":         ["ru"],
  "Indo-European — Indo-Aryan":     ["hi", "bn", "ur", "pa"],
  "Indo-European — Iranian":        ["fa"],
  "Sino-Tibetan":                   ["zh"],
  "Afro-Asiatic — Semitic":         ["he", "ar"],
  "Japonic":                        ["ja"],
  "Koreanic":                       ["ko"],
  "Turkic":                         ["tr"],
  "Austronesian":                   ["id"],
  "Austroasiatic":                  ["vi"],
  "Niger-Congo":                    ["sw"],
  "Tai-Kadai":                      ["th"],
};

export const MUSIC_CONTEXT_CLUSTERS = {
  "Western pop & rock":             ["en", "de", "fr", "it"],
  "Latin":                          ["es", "pt"],
  "East Asian pop":                 ["zh", "ja", "ko"],
  "South Asian":                    ["hi", "bn", "ur", "pa"],
  "Middle Eastern & Turkic":        ["he", "ar", "fa", "tr"],
  "Slavic & Eastern European":      ["ru"],
  "African":                        ["sw"],
  "Southeast Asian":                ["id", "vi", "th"],
};
