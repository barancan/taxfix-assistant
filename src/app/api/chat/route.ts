import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionId } from "@/server/session-server";
import { byokEnabled, createByokProvider, resolveServerProvider } from "@/ai";
import { isModelAllowed } from "@/ai/models";
import { chatSystemPrompt } from "@/ai/prompts";
import { makeError } from "@/ai/errors";
import type { ProviderName } from "@/ai/provider";

export const runtime = "nodejs";

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1)
    .max(20),
  context: z.string().max(1000).optional(),
  byok: z
    .object({ provider: z.enum(["anthropic", "openai"]), model: z.string(), apiKey: z.string() })
    .optional(),
});

export async function POST(req: Request) {
  await getSessionId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const { messages, context, byok } = parsed.data;

  let provider = null;
  if (byok?.apiKey) {
    if (!byokEnabled()) return NextResponse.json(makeError("invalid_credentials"), { status: 200 });
    if (!isModelAllowed(byok.provider as ProviderName, byok.model)) {
      return NextResponse.json(makeError("unsupported_model"), { status: 200 });
    }
    provider = createByokProvider(byok);
  } else {
    provider = resolveServerProvider();
  }

  if (!provider) {
    return NextResponse.json({ ...makeError("insufficient_credits"), noServerKey: true }, { status: 200 });
  }

  const outcome = await provider.chat(chatSystemPrompt(context), messages);
  return NextResponse.json(outcome, { status: 200 });
}
