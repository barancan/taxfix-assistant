import { NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { getSessionId } from "@/server/session-server";
import { getProfile } from "@/server/profile";
import { byokEnabled, createByokProvider, resolveServerProvider } from "@/ai";
import { isModelAllowed, modelSupportsFiles } from "@/ai/models";
import type { AiFile, ProviderName } from "@/ai/provider";
import { makeError } from "@/ai/errors";
import { agentModelQuery, agentModelResponse, skillOf } from "@/server/agent-log";

export const runtime = "nodejs";

const MAX_FILES = 4;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file
const ALLOWED: Record<string, "image" | "pdf"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
};

function profileSummary(sessionId: string): string {
  const p = getProfile(sessionId);
  return [
    `Freelancer: ${p.businessName} (established in Germany)`,
    `Kleinunternehmer: ${p.kleinunternehmer ? "yes" : "no"}`,
    `Preferred invoice language: ${p.invoiceLanguage}`,
  ].join("; ");
}

interface ByokBody {
  provider?: ProviderName;
  model?: string;
  apiKey?: string;
}

export async function POST(req: Request) {
  const sessionId = await getSessionId();
  const contentType = req.headers.get("content-type") ?? "";

  let text = "";
  const files: AiFile[] = [];
  let byok: ByokBody | undefined;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = String(form.get("text") ?? "");
      const byokRaw = form.get("byok");
      if (typeof byokRaw === "string" && byokRaw) byok = JSON.parse(byokRaw);
      const uploaded = form.getAll("files").filter((f): f is File => f instanceof File);
      if (uploaded.length > MAX_FILES) {
        return NextResponse.json(makeError("file_rejected"), { status: 200 });
      }
      for (const file of uploaded) {
        const buf = Buffer.from(await file.arrayBuffer());
        if (buf.byteLength > MAX_BYTES) return NextResponse.json(makeError("file_rejected"), { status: 200 });
        const sniff = await fileTypeFromBuffer(buf); // magic bytes, not the filename
        const kind = sniff ? ALLOWED[sniff.mime] : undefined;
        if (!kind) return NextResponse.json(makeError("file_rejected"), { status: 200 });
        files.push({ kind, mediaType: sniff!.mime, dataBase64: buf.toString("base64") });
      }
    } else {
      const body = (await req.json()) as { text?: string; byok?: ByokBody };
      text = String(body.text ?? "");
      byok = body.byok;
    }
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!text.trim() && files.length === 0) {
    return NextResponse.json({ error: "empty_input" }, { status: 400 });
  }

  // Provider selection: BYOK (if enabled + valid) else server-funded.
  let provider = null;
  if (byok?.apiKey && byok.provider && byok.model) {
    if (!byokEnabled()) return NextResponse.json(makeError("invalid_credentials"), { status: 200 });
    if (!isModelAllowed(byok.provider, byok.model)) return NextResponse.json(makeError("unsupported_model"), { status: 200 });
    if (files.length && !modelSupportsFiles(byok.provider, byok.model)) {
      return NextResponse.json(makeError("unsupported_model"), { status: 200 });
    }
    provider = createByokProvider({ provider: byok.provider, model: byok.model, apiKey: byok.apiKey });
  } else {
    provider = resolveServerProvider();
  }

  if (!provider) {
    // No server key configured → guide the user toward BYOK.
    return NextResponse.json({ ...makeError("insufficient_credits"), noServerKey: true }, { status: 200 });
  }

  const skill = skillOf(req);
  agentModelQuery(
    skill,
    "extract",
    provider.name,
    provider.model,
    text || "(document only)",
    files.map((f) => ({ mediaType: f.mediaType, bytes: Math.round((f.dataBase64.length * 3) / 4) })),
  );
  const started = Date.now();
  const outcome = await provider.extract({ text, profileSummary: profileSummary(sessionId), files });
  if (outcome.ok) {
    const d = outcome.data;
    agentModelResponse(
      skill,
      "extract",
      Date.now() - started,
      `customer="${d.customerName ?? "?"}" (${d.customerCountryCode ?? "?"}${d.customerVatId ? `, VAT ${d.customerVatId}` : ""}), category=${d.suggestedCategory ?? "?"}, currency=${d.currency ?? "?"}, ${d.lineItems.length} line item(s)`,
    );
  } else {
    agentModelResponse(skill, "extract", Date.now() - started, `failed: ${outcome.kind}`);
  }
  return NextResponse.json(outcome, { status: 200 });
}
