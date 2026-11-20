/**
 * Hand-written types mirroring supabase/migrations/0001_initial_schema.sql.
 * Replace with generated types once the project ref is available:
 *   pnpm dlx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 * Mirrors the columns the legacy Python app (auth/db.py) reads and writes.
 */

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
  is_admin: number; // 0 | 1
  /** null = workspace owner (admin); else the admin whose workspace this member shares. */
  owner_id: number | null;
};

export type SessionRow = {
  token: string;
  user_id: number;
  created_at: string;
  expires_at: string;
};

export type ClientRow = {
  id: number;
  user_id: number;
  ad_account_id: string | null;
  page_id: string | null;
  business_name: string | null;
  created_at: string;
  service_model: "self_service" | "agency_managed";
  billing_arrangement: "management_fee_only" | "management_plus_ad_budget" | null;
  client_status: "pending_access" | "active" | "paused";
  is_self: boolean;
  meta_connection_id: number | null;
  ad_account_name: string | null;
  page_name: string | null;
  instagram_actor_id: string | null;
  instagram_username: string | null;
  pixel_id: string | null;
  pixel_name: string | null;
  assets_updated_at: string | null;
  candidate_name: string | null;
  /** Empty = Independent. */
  party: string | null;
  symbol: string | null;
  ac_no: number | null;
  paid_for_by: string | null;
  political_ready_at: string | null;
};

export type MetaConnectionRow = {
  id: number;
  user_id: number;
  client_id: number | null;
  meta_user_id: string | null;
  meta_user_name: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  access_token_encrypted: string;
  token_expires_at: string | null;
  connected_at: string;
  updated_at: string;
  connection_status: "connected" | "expired" | "revoked" | "error";
  source: "owner" | "invite" | "business";
  token_type: "user" | "system_user";
  granted_scopes: string[] | null;
  meta_business_id: string | null;
};

export type ClientInviteRow = {
  id: number;
  token_hash: string;
  user_id: number;
  client_id: number;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

export type MetaOAuthStateRow = {
  id: number;
  state_hash: string;
  user_id: number;
  client_id: number | null;
  created_at: string;
  expires_at: string;
  flow: "owner" | "invite" | "business";
  invite_id: number | null;
};

export type MetaOAuthPendingRow = {
  id: number;
  ticket_hash: string;
  user_id: number;
  client_id: number;
  meta_user_id: string | null;
  meta_user_name: string | null;
  accounts: unknown;
  access_token_encrypted: string;
  token_expires_at: string | null;
  created_at: string;
  expires_at: string;
};

/** 0004 · Campaigns created in Shryxa: drafts + launched (text only, no media). */
export type CampaignRow = {
  id: number;
  user_id: number;
  client_id: number;
  state: "draft" | "launched";
  name: string;
  objective: string | null;
  destination: string | null;
  currency: string | null;
  budget_type: "daily" | "lifetime" | null;
  budget_minor: number | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_ad_id: string | null;
  meta_form_id: string | null;
  summary: Record<string, unknown>;
  draft: unknown;
  created_at: string;
  updated_at: string;
  launched_at: string | null;
  mcmc_certificate_id: number | null;
};

export type McmcCertificateRow = {
  id: number;
  user_id: number;
  client_id: number;
  cert_no: string;
  committee: string;
  issued_on: string;
  title: string;
  file_path: string | null;
  created_at: string;
};

export type PollScheduleRow = {
  user_id: number;
  ac_no: number;
  phase: number | null;
  poll_date: string;
  /** "HH:MM:SS", IST. */
  poll_end: string;
  updated_at: string;
};

export type Database = {
  polyad: {
    Tables: {
      users: Row<UserRow>;
      sessions: Row<SessionRow>;
      clients: Row<ClientRow>;
      meta_connections: Row<MetaConnectionRow>;
      meta_oauth_states: Row<MetaOAuthStateRow>;
      meta_oauth_pending: Row<MetaOAuthPendingRow>;
      client_invites: Row<ClientInviteRow>;
      campaigns: Row<CampaignRow>;
      mcmc_certificates: Row<McmcCertificateRow>;
      poll_schedule: Row<PollScheduleRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
