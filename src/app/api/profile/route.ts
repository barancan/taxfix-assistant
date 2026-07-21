import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionId } from "@/server/session-server";
import { getProfile, updateProfile } from "@/server/profile";
import { storageMode } from "@/server/storage";
import { getEnv } from "@/config/env";

export async function GET() {
  const sessionId = await getSessionId();
  return NextResponse.json({
    profile: getProfile(sessionId),
    storageMode: storageMode(),
    demoMode: getEnv().DEMO_MODE,
  });
}

const PatchSchema = z.object({
  businessName: z.string().min(1).optional(),
  kleinunternehmer: z.boolean().optional(),
  vatRegistered: z.boolean().optional(),
  invoiceLanguage: z.enum(["en", "de"]).optional(),
  defaultPaymentTermsDays: z.number().int().min(0).max(120).optional(),
  preferredCurrency: z.string().length(3).optional(),
});

export async function PUT(req: Request) {
  const sessionId = await getSessionId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_patch", issues: parsed.error.issues }, { status: 400 });
  }
  return NextResponse.json({ profile: updateProfile(sessionId, parsed.data) });
}
