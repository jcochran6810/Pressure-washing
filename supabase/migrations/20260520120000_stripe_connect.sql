-- Phase 9: Stripe Connect for per-business payments.
--
-- organizations.stripe_account_id is repurposed as the connected account ID
-- (acct_...). Adds bookkeeping columns so the UI can render connection state.

alter table organizations
  add column if not exists stripe_connect_status text,
  add column if not exists stripe_connect_email text,
  add column if not exists stripe_connect_country text,
  add column if not exists stripe_connect_connected_at timestamptz;
