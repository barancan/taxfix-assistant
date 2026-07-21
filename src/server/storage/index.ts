import "server-only";
import { getEnv, hasSupabase } from "@/config/env";
import { LocalStorageAdapter } from "./local";
import { SupabaseStorageAdapter } from "./supabase";
import type { StorageAdapter } from "./types";

let cached: StorageAdapter | null = null;

/** Returns the Supabase adapter when configured, otherwise the local fallback. */
export function getStorage(): StorageAdapter {
  if (cached) return cached;
  cached = hasSupabase(getEnv()) ? new SupabaseStorageAdapter() : new LocalStorageAdapter();
  return cached;
}

export function storageMode(): "supabase" | "local" {
  return hasSupabase(getEnv()) ? "supabase" : "local";
}

export type { StorageAdapter } from "./types";
