import "server-only";
import { Decimal } from "decimal.js";
import { minorDigits } from "@/domain/money/money";
import type { FxMetadata } from "@/domain/invoice/schema";

/**
 * ECB euro foreign-exchange reference-rate adapter. Rates are units of foreign
 * currency per 1 EUR, so the EUR value of a foreign amount is amount / rate.
 * We request a window ending at the invoice date and take the latest available
 * observation on/before it — this handles weekends, holidays and missing dates.
 */

const BASE = "https://data-api.ecb.europa.eu/service/data/EXR";

export type EcbErrorKind =
  | "unsupported_currency"
  | "no_rate"
  | "unavailable"
  | "malformed";

export class EcbError extends Error {
  constructor(
    public kind: EcbErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "EcbError";
  }
}

export interface EcbObservation {
  date: string; // YYYY-MM-DD
  rate: string; // units of currency per 1 EUR
}

export function seriesKey(currency: string): string {
  return `D.${currency.toUpperCase()}.EUR.SP00.A`;
}

/** Parse ECB `format=csvdata` output into observations, latest last. */
export function parseEcbCsv(csv: string): EcbObservation[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",");
  const iDate = header.indexOf("TIME_PERIOD");
  const iVal = header.indexOf("OBS_VALUE");
  if (iDate === -1 || iVal === -1) throw new EcbError("malformed", "Unexpected ECB CSV header");
  const out: EcbObservation[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    const date = cols[iDate];
    const rate = cols[iVal];
    if (date && rate) out.push({ date, rate });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface EcbClientOptions {
  fetchImpl?: typeof fetch;
  windowDays?: number;
  timeoutMs?: number;
}

/**
 * Fetch the applicable reference rate for `currency` on/before `invoiceDate`.
 * EUR returns a unit rate without a network call.
 */
export async function fetchReferenceRate(
  currency: string,
  invoiceDate: string,
  opts: EcbClientOptions = {},
): Promise<EcbObservation> {
  const ccy = currency.toUpperCase();
  if (ccy === "EUR") return { date: invoiceDate, rate: "1" };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const windowDays = opts.windowDays ?? 10;
  const start = shiftDays(invoiceDate, -windowDays);
  const url = `${BASE}/${seriesKey(ccy)}?startPeriod=${start}&endPeriod=${invoiceDate}&format=csvdata`;

  let res: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    res = await fetchImpl(url, { signal: ctrl.signal });
    clearTimeout(timer);
  } catch {
    throw new EcbError("unavailable", "ECB service unavailable or timed out");
  }
  if (res.status === 404) throw new EcbError("no_rate", `No ECB series for ${ccy}`);
  if (!res.ok) throw new EcbError("unavailable", `ECB responded ${res.status}`);

  const csv = await res.text();
  const observations = parseEcbCsv(csv);
  const applicable = observations.filter((o) => o.date <= invoiceDate);
  const latest = applicable[applicable.length - 1];
  if (!latest) throw new EcbError("no_rate", `No rate on/before ${invoiceDate} for ${ccy}`);
  return latest;
}

/** Build the stored FX accounting metadata for a foreign-currency invoice. */
export function buildFxMetadata(
  originalAmountMinor: string,
  quoteCurrency: string,
  invoiceDate: string,
  observation: EcbObservation,
): FxMetadata {
  const ccy = quoteCurrency.toUpperCase();
  const rate = new Decimal(observation.rate);
  const originalMajor = new Decimal(originalAmountMinor).div(new Decimal(10).pow(minorDigits(ccy)));
  const eurMajor = originalMajor.div(rate);
  const eurMinor = eurMajor.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
  return {
    baseCurrency: "EUR",
    quoteCurrency: ccy,
    originalAmountMinor,
    eurAmountMinor: eurMinor,
    rate: observation.rate,
    rateDirection: "UNITS_PER_EUR",
    ecbSeriesKey: seriesKey(ccy),
    sourceUrl: `${BASE}/${seriesKey(ccy)}?format=csvdata`,
    requestedDate: invoiceDate,
    actualRateDate: observation.date,
    retrievedAt: new Date().toISOString(),
  };
}
