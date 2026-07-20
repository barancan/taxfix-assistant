import { Decimal } from "decimal.js";

/**
 * Decimal-safe money. Amounts are stored as INTEGER MINOR UNITS (string) plus a
 * currency code. All arithmetic goes through decimal.js; JavaScript floating
 * point is never used for invoice totals. Rounding is half-up at each defined
 * boundary (per-line, discount, VAT, total).
 */

// Configure a local Decimal constructor with banker-free half-up rounding.
const D = Decimal.clone({ rounding: Decimal.ROUND_HALF_UP, precision: 40 });

/** Minor-unit exponent per currency (default 2). Extend as needed. */
const MINOR_DIGITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  ISK: 0,
  BHD: 3,
  KWD: 3,
  TND: 3,
};

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency.toUpperCase()] ?? 2;
}

export function minorFactor(currency: string): Decimal {
  return new D(10).pow(minorDigits(currency));
}

export interface Money {
  /** integer minor units, as a string (e.g. "1200000" for 12,000.00) */
  amountMinor: string;
  currency: string;
}

export function money(amountMinor: string | number | bigint, currency: string): Money {
  return { amountMinor: String(amountMinor), currency };
}

/** Parse a human major-unit amount ("12000", "1234.56") into minor units. */
export function fromMajor(major: string | number, currency: string): Money {
  const minor = new D(major).times(minorFactor(currency)).toDecimalPlaces(0).toFixed(0);
  return { amountMinor: minor, currency };
}

/** Minor units → Decimal in major units (for display/rate math). */
export function toMajorDecimal(m: Money): Decimal {
  return new D(m.amountMinor).div(minorFactor(m.currency));
}

export function formatMajor(m: Money): string {
  return toMajorDecimal(m).toFixed(minorDigits(m.currency));
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: new D(a.amountMinor).plus(b.amountMinor).toFixed(0), currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: new D(a.amountMinor).minus(b.amountMinor).toFixed(0), currency: a.currency };
}

export function sumMoney(items: Money[], currency: string): Money {
  return items.reduce((acc, m) => addMoney(acc, m), money(0, currency));
}

/** Multiply a money amount by a decimal quantity, rounding to whole minor units. */
export function mulMoney(m: Money, factor: string | number): Money {
  const minor = new D(m.amountMinor).times(factor).toDecimalPlaces(0).toFixed(0);
  return { amountMinor: minor, currency: m.currency };
}

/** Apply a percentage (e.g. 19 for 19%), rounding to whole minor units. */
export function percentOf(m: Money, percent: string | number): Money {
  const minor = new D(m.amountMinor).times(percent).div(100).toDecimalPlaces(0).toFixed(0);
  return { amountMinor: minor, currency: m.currency };
}

export function isNegative(m: Money): boolean {
  return new D(m.amountMinor).isNegative();
}

export { D as DecimalMoney };
