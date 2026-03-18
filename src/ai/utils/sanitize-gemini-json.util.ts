/**
 * Sanitize a raw string from Gemini before JSON.parse.
 *
 * Gemini occasionally emits literal control characters (bytes 0x00–0x1F, 0x7F)
 * inside JSON string values, which is invalid per the JSON spec.  A naïve
 * global strip loses content (e.g. newlines in scene descriptions).
 *
 * This function walks the raw string character-by-character and:
 *  - Inside a JSON string value  → escapes the control char (\\n, \\t, etc.)
 *    so the content is preserved and the JSON becomes valid.
 *  - Outside a JSON string value → strips the control char (it was only
 *    formatting whitespace; JSON is whitespace-insensitive).
 */
export function sanitizeGeminiJson(raw: string): string {
  const ESCAPE_MAP: Record<string, string> = {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
  };

  let result = '';
  let inString = false;
  let i = 0;

  while (i < raw.length) {
    const char = raw[i];
    const code = raw.charCodeAt(i);

    // Handle backslash escape sequences inside strings — skip next char as-is.
    if (inString && char === '\\') {
      result += char + (raw[i + 1] ?? '');
      i += 2;
      continue;
    }

    // Toggle string context on unescaped double-quote.
    if (char === '"') {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    // Control character (C0 range + DEL).
    if (code <= 0x1f || code === 0x7f) {
      if (inString) {
        // Preserve content by escaping; fall back to empty string for rare
        // non-printable control chars (SOH, STX, …) that have no JSON escape.
        result += ESCAPE_MAP[char] ?? '';
      }
      // Outside a string: just drop it (was only structural whitespace).
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}
