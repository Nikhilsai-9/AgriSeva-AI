export interface Language {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  dir?: "ltr" | "rtl";
}

/**
 * All 23 official languages supported across AgriSeva-AI.
 * Language codes mirror the existing Sarvam AI and backend translation catalog exactly.
 */
export const LANGUAGES: Language[] = [
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari", dir: "ltr" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు", script: "Telugu", dir: "ltr" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்", script: "Tamil", dir: "ltr" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ", script: "Kannada", dir: "ltr" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം", script: "Malayalam", dir: "ltr" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी", script: "Devanagari", dir: "ltr" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা", script: "Bengali-Assamese", dir: "ltr" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી", script: "Gujarati", dir: "ltr" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", script: "Gurmukhi", dir: "ltr" },
  { code: "od-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ", script: "Odia", dir: "ltr" },
  { code: "as-IN", name: "Assamese", nativeName: "অসমীয়া", script: "Bengali-Assamese", dir: "ltr" },
  { code: "ur-IN", name: "Urdu", nativeName: "اردو", script: "Perso-Arabic", dir: "rtl" },
  { code: "mai-IN", name: "Maithili", nativeName: "मैथिली", script: "Devanagari", dir: "ltr" },
  { code: "brx-IN", name: "Bodo", nativeName: "बर'", script: "Devanagari", dir: "ltr" },
  { code: "doi-IN", name: "Dogri", nativeName: "डोगरी", script: "Devanagari", dir: "ltr" },
  { code: "ks-IN", name: "Kashmiri", nativeName: "کٲशُر", script: "Perso-Arabic", dir: "rtl" },
  { code: "kok-IN", name: "Konkani", nativeName: "कोंकणी", script: "Devanagari", dir: "ltr" },
  { code: "mni-IN", name: "Manipuri (Meitei)", nativeName: "ꯃꯤꯇꯩꯂꯣꯟ", script: "Meitei Mayek", dir: "ltr" },
  { code: "ne-IN", name: "Nepali", nativeName: "नेपाली", script: "Devanagari", dir: "ltr" },
  { code: "sa-IN", name: "Sanskrit", nativeName: "संस्कृतम्", script: "Devanagari", dir: "ltr" },
  { code: "sat-IN", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki", dir: "ltr" },
  { code: "sd-IN", name: "Sindhi", nativeName: "سنڌي", script: "Perso-Arabic", dir: "rtl" },
  { code: "en-IN", name: "English", nativeName: "English", script: "Latin", dir: "ltr" },
];

export const DEFAULT_LANGUAGE: Language = LANGUAGES.find((l) => l.code === "en-IN")!;
