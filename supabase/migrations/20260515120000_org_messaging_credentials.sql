-- Per-org messaging credentials (BYOC) — each business brings their own
-- Resend / Telnyx accounts so the platform doesn't carry their send cost.
-- Messaging add-on flag is reserved for billing gating later.

create table if not exists org_messaging_credentials (
  organization_id uuid primary key references organizations(id) on delete cascade,
  resend_api_key text,
  resend_from text,
  telnyx_api_key text,
  telnyx_from_number text,
  messaging_addon_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table org_messaging_credentials enable row level security;

drop policy if exists "members can view own org credentials" on org_messaging_credentials;
create policy "members can view own org credentials"
  on org_messaging_credentials for select
  using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "owners can manage own org credentials" on org_messaging_credentials;
create policy "owners can manage own org credentials"
  on org_messaging_credentials for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  )
  with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );
