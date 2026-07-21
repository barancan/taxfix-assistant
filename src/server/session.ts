/**
 * Opaque, HMAC-signed session id in an HTTP-only cookie. Uses Web Crypto so the
 * same code runs in edge middleware and node route handlers. The server stores
 * only the id (never anything sensitive) and associates invoices with it.
 *
 * This module is import-safe from edge middleware — it must NOT import
 * `next/headers`. Cookie reading lives in `session-server.ts`.
 */
export const SESSION_COOKIE = "tfx_sid";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-insecure-session-secret-change-me";
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

export async function signSid(id: string): Promise<string> {
  return `${id}.${await hmac(id)}`;
}

export async function verifySid(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmac(id);
  // constant-time-ish compare
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? id : null;
}

export function newSid(): string {
  return crypto.randomUUID();
}

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};
