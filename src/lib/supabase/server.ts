import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Server-only Supabase client using the service-role key.
 * Bypasses RLS — never import this from a Client Component.
 * All tables live in Postgres schema `polyad` (the Supabase project is shared
 * with Shryxa Ads, whose tables are in `public`).
 */
let client: SupabaseClient<Database, "polyad"> | null = null;

export function db(): SupabaseClient<Database, "polyad"> {
  if (client) return client;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env();
  client = createClient<Database, "polyad">(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "polyad" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
