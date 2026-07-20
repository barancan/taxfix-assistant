/**
 * Deterministic EU VAT identification number FORMAT validation only.
 * This never contacts VIES. A `true` result means the string is syntactically
 * plausible for the country — not that the number is registered or valid.
 */

// Country prefix → body pattern (after the two-letter country code).
const PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^0\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/, // Greece uses EL as VAT prefix
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^\d{7}[A-Z]{1,2}$|^\d[A-Z0-9+*]\d{5}[A-Z]$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

export function normalizeVatId(raw: string): string {
  return raw.replace(/[\s.-]/g, "").toUpperCase();
}

export function vatIdCountry(raw: string): string | null {
  const v = normalizeVatId(raw);
  const cc = v.slice(0, 2);
  return PATTERNS[cc] ? cc : null;
}

/**
 * True when `raw` is a syntactically plausible VAT id. If `expectedCountry` is
 * given, the id's own country prefix must match it.
 */
export function isVatIdFormatValid(raw: string | undefined, expectedCountry?: string): boolean {
  if (!raw) return false;
  const v = normalizeVatId(raw);
  const cc = v.slice(0, 2);
  const body = v.slice(2);
  const pattern = PATTERNS[cc];
  if (!pattern) return false;
  if (expectedCountry && cc !== expectedCountry.toUpperCase() && !(expectedCountry === "GR" && cc === "EL")) {
    return false;
  }
  return pattern.test(body);
}
