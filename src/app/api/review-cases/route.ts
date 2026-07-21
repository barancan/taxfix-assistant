import { NextResponse } from "next/server";
import { getSessionId } from "@/server/session-server";
import { getStorage } from "@/server/storage";

export async function GET() {
  const sessionId = await getSessionId();
  const reviewCases = await getStorage().listReviewCases(sessionId);
  return NextResponse.json({ reviewCases });
}
