import "server-only";
import seed from "../../fixtures/profile.json";
import type { ProfileFacts } from "@/domain/schemas";
import type { BankDetails, Party } from "@/pdf/model";
import type { InvoiceLanguage } from "@/domain/invoice/wording";

export interface AppProfile {
  legalName: string;
  businessName: string;
  address: { line1: string; postalCode: string; city: string; country: string };
  taxNumber: string;
  vatId: string;
  kleinunternehmer: boolean;
  vatRegistered: boolean;
  invoiceLanguage: InvoiceLanguage;
  bank: BankDetails;
  defaultPaymentTermsDays: number;
  invoiceNumberPrefix: string;
  preferredCurrency: string;
  contact: { email: string; phone: string };
}

const SEED = seed as unknown as AppProfile;

// Session-scoped overrides live for the process lifetime (POC; no auth).
const g = globalThis as unknown as { __tfxProfiles?: Map<string, Partial<AppProfile>> };
const overrides = g.__tfxProfiles ?? (g.__tfxProfiles = new Map());

export function getProfile(sessionId: string): AppProfile {
  return { ...SEED, ...(overrides.get(sessionId) ?? {}) };
}

export function updateProfile(sessionId: string, patch: Partial<AppProfile>): AppProfile {
  overrides.set(sessionId, { ...(overrides.get(sessionId) ?? {}), ...patch });
  return getProfile(sessionId);
}

export function toProfileFacts(p: AppProfile): ProfileFacts {
  return {
    establishmentCountry: "DE",
    taxResidence: "DE",
    kleinunternehmer: p.kleinunternehmer,
    vatRegistered: p.vatRegistered,
    taxNumberPresent: Boolean(p.taxNumber),
    vatIdPresent: Boolean(p.vatId),
  };
}

export function toSupplierParty(p: AppProfile): Party {
  return {
    name: p.businessName || p.legalName,
    addressLines: [p.legalName, p.address.line1, `${p.address.postalCode} ${p.address.city}`, p.address.country],
    taxNumber: p.taxNumber,
    vatId: p.vatId,
    email: p.contact.email,
  };
}
