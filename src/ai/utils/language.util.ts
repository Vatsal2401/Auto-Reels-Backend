const LANGUAGE_CODE_MAP: Record<string, string> = {
  Hindi: 'hi-IN',
  'English (US)': 'en-IN',
  Bengali: 'bn-IN',
  Tamil: 'ta-IN',
  Telugu: 'te-IN',
  Gujarati: 'gu-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
  Marathi: 'mr-IN',
  Punjabi: 'pa-IN',
  Odia: 'od-IN',
};

/**
 * Extra aliases that must resolve to a Sarvam language code: ISO codes with or
 * without a region suffix, native-script language names, and common spellings.
 * These are merged with the display names above so that variants like "gu",
 * "gu-IN", "Gujarati (India)" or "ગુજરાતી" all map to the correct `*-IN` code
 * instead of silently falling back to English.
 */
const LANGUAGE_ALIAS_ENTRIES: ReadonlyArray<readonly [readonly string[], string]> = [
  [['hi', 'hi-in', 'hindi', 'हिन्दी', 'हिंदी'], 'hi-IN'],
  [['en', 'en-in', 'en-us', 'english'], 'en-IN'],
  [['bn', 'bn-in', 'bengali', 'বাংলা'], 'bn-IN'],
  [['ta', 'ta-in', 'tamil', 'தமிழ்'], 'ta-IN'],
  [['te', 'te-in', 'telugu', 'తెలుగు'], 'te-IN'],
  [['gu', 'gu-in', 'gujarati', 'ગુજરાતી'], 'gu-IN'],
  [['kn', 'kn-in', 'kannada', 'ಕನ್ನಡ'], 'kn-IN'],
  [['ml', 'ml-in', 'malayalam', 'മലയാളം'], 'ml-IN'],
  [['mr', 'mr-in', 'marathi', 'मराठी'], 'mr-IN'],
  [['pa', 'pa-in', 'punjabi', 'ਪੰਜਾਬੀ'], 'pa-IN'],
  [['od', 'or', 'od-in', 'or-in', 'odia', 'oriya', 'ଓଡ଼ିଆ'], 'od-IN'],
];

function normalizeLanguageKey(language: string): string {
  return language.trim().toLowerCase();
}

/** Normalized (trimmed + lowercased) alias -> Sarvam `*-IN` code lookup. */
const NORMALIZED_LANGUAGE_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const add = (key: string, code: string): void => {
    const norm = normalizeLanguageKey(key);
    if (norm) map[norm] = code;
  };
  // Display names plus their region-suffixed form (e.g. "Gujarati (India)").
  for (const [display, code] of Object.entries(LANGUAGE_CODE_MAP)) {
    add(display, code);
    add(`${display} (India)`, code);
  }
  // ISO codes, native-script names, and common spelling variants.
  for (const [aliases, code] of LANGUAGE_ALIAS_ENTRIES) {
    for (const alias of aliases) add(alias, code);
  }
  return map;
})();

/**
 * Resolve any reasonable language identifier to a Sarvam `*-IN` language code.
 * Accepts display names ("Gujarati"), region-suffixed names ("Gujarati (India)"),
 * ISO codes with/without region ("gu", "gu-IN") and native-script names ("ગુજરાતી").
 * Falls back to `en-IN` only when the language is genuinely unknown.
 */
export function toSarvamLanguageCode(language: string): string {
  if (!language) return 'en-IN';
  const norm = normalizeLanguageKey(language);
  return (
    NORMALIZED_LANGUAGE_ALIASES[norm] ??
    // Tolerate "_"/whitespace separators, e.g. "gu_in" or "gu in".
    NORMALIZED_LANGUAGE_ALIASES[norm.replace(/[_\s]+/g, '-')] ??
    'en-IN'
  );
}

/**
 * Sarvam language codes that are well-supported by the bulbul:v2 model, which
 * accepts `enable_preprocessing` (normalizes embedded English words + numbers so
 * they are spoken in a natural Indic accent). English (en-IN) is intentionally
 * excluded — it uses the higher-quality bulbul:v3 without preprocessing.
 */
export const SARVAM_INDIC_LANGUAGE_CODES: ReadonlySet<string> = new Set([
  'hi-IN',
  'mr-IN',
  'gu-IN',
  'bn-IN',
  'ta-IN',
  'te-IN',
  'kn-IN',
  'ml-IN',
  'pa-IN',
  'od-IN',
]);

/** True for Indic languages that should use bulbul:v2 + enable_preprocessing. */
export function isSupportedIndicLanguage(langCode: string): boolean {
  return SARVAM_INDIC_LANGUAGE_CODES.has(langCode);
}

export function isHindi(language: string): boolean {
  return /hindi|hi|हिंदी/i.test(language);
}

// Complete Hindi words for 0–99. Each number has its own unique word.
const HINDI_ONES: string[] = [
  /* 0  */ '',
  /* 1  */ 'एक',
  /* 2  */ 'दो',
  /* 3  */ 'तीन',
  /* 4  */ 'चार',
  /* 5  */ 'पाँच',
  /* 6  */ 'छह',
  /* 7  */ 'सात',
  /* 8  */ 'आठ',
  /* 9  */ 'नौ',
  /* 10 */ 'दस',
  /* 11 */ 'ग्यारह',
  /* 12 */ 'बारह',
  /* 13 */ 'तेरह',
  /* 14 */ 'चौदह',
  /* 15 */ 'पंद्रह',
  /* 16 */ 'सोलह',
  /* 17 */ 'सत्रह',
  /* 18 */ 'अठारह',
  /* 19 */ 'उन्नीस',
  /* 20 */ 'बीस',
  /* 21 */ 'इक्कीस',
  /* 22 */ 'बाईस',
  /* 23 */ 'तेईस',
  /* 24 */ 'चौबीस',
  /* 25 */ 'पच्चीस',
  /* 26 */ 'छब्बीस',
  /* 27 */ 'सत्ताईस',
  /* 28 */ 'अट्ठाईस',
  /* 29 */ 'उनतीस',
  /* 30 */ 'तीस',
  /* 31 */ 'इकतीस',
  /* 32 */ 'बत्तीस',
  /* 33 */ 'तैंतीस',
  /* 34 */ 'चौंतीस',
  /* 35 */ 'पैंतीस',
  /* 36 */ 'छत्तीस',
  /* 37 */ 'सैंतीस',
  /* 38 */ 'अड़तीस',
  /* 39 */ 'उनचालीस',
  /* 40 */ 'चालीस',
  /* 41 */ 'इकतालीस',
  /* 42 */ 'बयालीस',
  /* 43 */ 'तैंतालीस',
  /* 44 */ 'चवालीस',
  /* 45 */ 'पैंतालीस',
  /* 46 */ 'छियालीस',
  /* 47 */ 'सैंतालीस',
  /* 48 */ 'अड़तालीस',
  /* 49 */ 'उनचास',
  /* 50 */ 'पचास',
  /* 51 */ 'इक्यावन',
  /* 52 */ 'बावन',
  /* 53 */ 'तिरपन',
  /* 54 */ 'चौवन',
  /* 55 */ 'पचपन',
  /* 56 */ 'छप्पन',
  /* 57 */ 'सत्तावन',
  /* 58 */ 'अट्ठावन',
  /* 59 */ 'उनसठ',
  /* 60 */ 'साठ',
  /* 61 */ 'इकसठ',
  /* 62 */ 'बासठ',
  /* 63 */ 'तिरसठ',
  /* 64 */ 'चौंसठ',
  /* 65 */ 'पैंसठ',
  /* 66 */ 'छियासठ',
  /* 67 */ 'सड़सठ',
  /* 68 */ 'अड़सठ',
  /* 69 */ 'उनहत्तर',
  /* 70 */ 'सत्तर',
  /* 71 */ 'इकहत्तर',
  /* 72 */ 'बहत्तर',
  /* 73 */ 'तिहत्तर',
  /* 74 */ 'चौहत्तर',
  /* 75 */ 'पचहत्तर',
  /* 76 */ 'छिहत्तर',
  /* 77 */ 'सतहत्तर',
  /* 78 */ 'अठहत्तर',
  /* 79 */ 'उनासी',
  /* 80 */ 'अस्सी',
  /* 81 */ 'इक्यासी',
  /* 82 */ 'बयासी',
  /* 83 */ 'तिरासी',
  /* 84 */ 'चौरासी',
  /* 85 */ 'पचासी',
  /* 86 */ 'छियासी',
  /* 87 */ 'सत्तासी',
  /* 88 */ 'अट्ठासी',
  /* 89 */ 'नवासी',
  /* 90 */ 'नब्बे',
  /* 91 */ 'इक्यानवे',
  /* 92 */ 'बानवे',
  /* 93 */ 'तिरानवे',
  /* 94 */ 'चौरानवे',
  /* 95 */ 'पचानवे',
  /* 96 */ 'छियानवे',
  /* 97 */ 'सत्तानवे',
  /* 98 */ 'अट्ठानवे',
  /* 99 */ 'निन्यानवे',
];

export function numberToHindiWords(n: number): string {
  if (n === 0) return 'शून्य';
  if (n < 0) return 'ऋण ' + numberToHindiWords(-n);

  const parts: string[] = [];

  if (n >= 10_000_000) {
    parts.push(numberToHindiWords(Math.floor(n / 10_000_000)) + ' करोड़');
    n %= 10_000_000;
  }
  if (n >= 100_000) {
    parts.push(numberToHindiWords(Math.floor(n / 100_000)) + ' लाख');
    n %= 100_000;
  }
  if (n >= 1_000) {
    parts.push(numberToHindiWords(Math.floor(n / 1_000)) + ' हज़ार');
    n %= 1_000;
  }
  if (n >= 100) {
    const h = Math.floor(n / 100);
    parts.push((h === 1 ? '' : HINDI_ONES[h] + ' ') + 'सौ');
    n %= 100;
  }
  if (n > 0) {
    parts.push(HINDI_ONES[n]);
  }

  return parts.join(' ');
}

/**
 * Replace Arabic numerals with spoken words before sending to Sarvam TTS.
 * Applies to Devanagari-script languages (hi-IN, mr-IN) where Sarvam reads
 * digits like "two zero two six" instead of "दो हज़ार छब्बीस".
 */
export function preprocessTextForSarvam(text: string, langCode: string): string {
  if (langCode === 'hi-IN' || langCode === 'mr-IN') {
    return text.replace(/\b\d+\b/g, (match) => {
      const n = parseInt(match, 10);
      return isNaN(n) ? match : numberToHindiWords(n);
    });
  }
  return text;
}
