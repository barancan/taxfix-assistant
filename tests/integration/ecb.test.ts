import { describe, expect, it, vi } from "vitest";
import {
  buildFxMetadata,
  fetchReferenceRate,
  parseEcbCsv,
  EcbError,
} from "@/server/ecb";

const CSV = `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-07-16,1.1467,A
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-07-17,1.1435,A
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-07-20,1.1426,A`;

function mockFetch(body: string, status = 200): typeof fetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("ECB adapter", () => {
  it("parses csvdata observations in date order", () => {
    const obs = parseEcbCsv(CSV);
    expect(obs).toHaveLength(3);
    expect(obs[obs.length - 1]).toEqual({ date: "2026-07-20", rate: "1.1426" });
  });

  it("returns a unit rate for EUR without any network call", async () => {
    const fetchImpl = mockFetch("");
    const obs = await fetchReferenceRate("EUR", "2026-07-20", { fetchImpl });
    expect(obs.rate).toBe("1");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the latest observation on/before the invoice date (weekend fallback)", async () => {
    // Sunday 2026-07-19 has no rate; should fall back to Friday 2026-07-17.
    const obs = await fetchReferenceRate("USD", "2026-07-19", { fetchImpl: mockFetch(CSV) });
    expect(obs).toEqual({ date: "2026-07-17", rate: "1.1435" });
  });

  it("computes EUR accounting metadata (EUR = amount / rate)", () => {
    const fx = buildFxMetadata("1200000", "USD", "2026-07-20", { date: "2026-07-20", rate: "1.1426" });
    // 12000 USD / 1.1426 = 10502.36 EUR
    expect(fx.eurAmountMinor).toBe("1050236");
    expect(fx.rateDirection).toBe("UNITS_PER_EUR");
    expect(fx.actualRateDate).toBe("2026-07-20");
  });

  it("raises a typed error when the service is unavailable", async () => {
    const fetchImpl = mockFetch("err", 503);
    await expect(fetchReferenceRate("USD", "2026-07-20", { fetchImpl })).rejects.toBeInstanceOf(EcbError);
  });

  it("raises no_rate when no observation is on/before the date", async () => {
    await expect(
      fetchReferenceRate("USD", "2020-01-01", { fetchImpl: mockFetch(CSV) }),
    ).rejects.toMatchObject({ kind: "no_rate" });
  });
});
