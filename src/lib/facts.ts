import { regionForCountry } from "./regions";
import { majorToMinor } from "./format";

/** Everything the conversation collects before assessment. */
export interface Collected {
  intent: string;
  customerName: string;
  countryCode: string;
  customerType: "business" | "private" | "unknown";
  businessConfirmed: boolean;
  vatId: string;
  demoVies: boolean;
  serviceCategory: string;
  serviceDescription: string;
  currency: string;
  addressLines: string[];
  lines: { description: string; quantity: string; unit: string; unitPriceMajor: string }[];
}

export function emptyCollected(): Collected {
  return {
    intent: "",
    customerName: "",
    countryCode: "US",
    customerType: "unknown",
    businessConfirmed: false,
    vatId: "",
    demoVies: false,
    serviceCategory: "consulting",
    serviceDescription: "",
    currency: "EUR",
    addressLines: [],
    lines: [],
  };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build the client-supplied facts payload (profile is injected server-side). */
export function buildClientFacts(c: Collected) {
  const region = regionForCountry(c.countryCode);
  return {
    customer: {
      name: c.customerName || "Customer",
      countryCode: c.countryCode,
      region,
      type: c.customerType,
      ...(c.vatId ? { vatId: c.vatId } : {}),
    },
    evidence: {
      vatIdCheck: region === "EU" && c.vatId ? (c.demoVies ? "demo_vies" : "format_only") : "none",
      ...(c.demoVies ? { vatIdFormatValid: true } : {}),
      businessStatusConfirmedByUser: c.businessConfirmed,
      source: "manual",
    },
    service: {
      category: c.serviceCategory,
      normalizedDescription: c.serviceDescription || c.lines[0]?.description || "Professional service",
      isGoods: false,
      supported: c.serviceCategory !== "unsupported",
    },
    transaction: {
      invoiceDate: today(),
      currency: c.currency,
      intermediaryInvolved: false,
      specialEstablishment: false,
      exceptionFlags: [],
    },
  };
}

export function buildInvoicePayload(c: Collected) {
  const digits = c.currency === "JPY" ? 0 : 2;
  return {
    facts: buildClientFacts(c),
    draft: {
      currency: c.currency,
      invoiceDate: today(),
      paymentTermsDays: 14,
      lines: c.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceMinor: majorToMinor(l.unitPriceMajor, digits),
        isReimbursable: false,
      })),
    },
    customerAddressLines: c.addressLines,
  };
}

/** Rough subtotal (major units) for the collected header — display only. */
export function collectedSubtotal(c: Collected): number {
  return c.lines.reduce((sum, l) => sum + Number(l.quantity || "0") * Number(l.unitPriceMajor || "0"), 0);
}
