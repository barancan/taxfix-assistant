import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySid } from "./session";

/** Read-only session accessor for route handlers / server components. */
export async function getSessionId(): Promise<string> {
  const jar = await cookies();
  const id = await verifySid(jar.get(SESSION_COOKIE)?.value);
  return id ?? "anonymous";
}
