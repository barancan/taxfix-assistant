import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, newSid, signSid, verifySid } from "@/server/session";

/**
 * Ensure every request carries a valid signed session cookie. When minting a
 * new one we also inject it into the forwarded request headers so the same
 * request's handler can read it immediately (not only on the next request).
 */
export default async function proxy(req: NextRequest) {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySid(existing)) return NextResponse.next();

  const signed = await signSid(newSid());
  const headers = new Headers(req.headers);
  const priorCookie = headers.get("cookie");
  headers.set("cookie", `${priorCookie ? priorCookie + "; " : ""}${SESSION_COOKIE}=${signed}`);

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(SESSION_COOKIE, signed, cookieOptions);
  return res;
}

export const config = {
  // Run on app routes, skip static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
