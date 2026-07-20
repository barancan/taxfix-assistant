export function minorToMajor(minor: string, digits = 2): string {
  const neg = minor.startsWith("-");
  const s = (neg ? minor.slice(1) : minor).padStart(digits + 1, "0");
  const whole = s.slice(0, s.length - digits) || "0";
  const frac = digits ? "." + s.slice(s.length - digits) : "";
  return `${neg ? "-" : ""}${whole}${frac}`;
}

export function majorToMinor(major: string, digits = 2): string {
  const cleaned = major.trim().replace(/,/g, "");
  if (!cleaned) return "0";
  const neg = cleaned.startsWith("-");
  const [whole, frac = ""] = (neg ? cleaned.slice(1) : cleaned).split(".");
  const fracPadded = (frac + "0".repeat(digits)).slice(0, digits);
  const combined = `${whole || "0"}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return `${neg ? "-" : ""}${combined || "0"}`;
}

export function money(minor: string, currency: string): string {
  const digits = currency === "JPY" ? 0 : 2;
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: digits }).format(Number(minorToMajor(minor, digits)))} ${currency}`;
}
