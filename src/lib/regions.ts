import type { Region } from "@/domain/schemas";

const EU = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export function regionForCountry(cc: string): Region {
  const c = cc.toUpperCase();
  if (c === "DE") return "DE";
  if (EU.has(c)) return "EU";
  return "NON_EU";
}

export const COUNTRY_OPTIONS = [
  { code: "DE", name: "Germany" },
  { code: "PT", name: "Portugal" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CH", name: "Switzerland" },
];
