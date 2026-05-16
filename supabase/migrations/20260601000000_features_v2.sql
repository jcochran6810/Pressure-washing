-- =====================================================================
-- FEATURES V2
-- Adds: audit log, in-app notifications, drafts, customer portal sessions,
-- chemical usage on jobs, Stripe subscription column on contracts.
-- =====================================================================

-- =====================================================================
-- Audit log
-- =====================================================================
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  -- common: 'create' | 'update' | 'delete' | 'send' | 'pay' | 'void' | 'connect' | 'disconnect'
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  before_data jsonb,
  after_data jsonb,
  ip text,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists audit_log_org_idx on audit_log(organization_id, created_at desc);
create index if not exists audit_log_entity_idx on audit_log(entity_type, entity_id);

alter table audit_log enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'audit_log' and policyname = 'audit_log org member') then
    create policy "audit_log org member" on audit_log for all
      using (is_org_member(organization_id)) with check (is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- Notifications (in-app bell)
-- =====================================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- null user_id = broadcast to all org members; specific user_id = personal
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  url text,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_org_user_idx on notifications(organization_id, user_id, read_at, created_at desc);

alter table notifications enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications read') then
    create policy "notifications read" on notifications for select
      using (is_org_member(organization_id) and (user_id is null or user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'notifications update own') then
    create policy "notifications update own" on notifications for update
      using (is_org_member(organization_id) and (user_id is null or user_id = auth.uid()))
      with check (is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- Drafts (auto-save for estimates / invoices)
-- =====================================================================
create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('estimate', 'invoice')),
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, entity_type, entity_id)
);
create index if not exists drafts_user_idx on drafts(user_id, entity_type, updated_at desc);

alter table drafts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'drafts' and policyname = 'drafts own') then
    create policy "drafts own" on drafts for all
      using (user_id = auth.uid() and is_org_member(organization_id))
      with check (user_id = auth.uid() and is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- Customer portal: a "portal session" is a long-lived token mapped to a
-- customer email. Customer enters email, gets magic link; link sets a
-- session cookie that the portal middleware validates against this table.
-- =====================================================================
create table if not exists customer_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  token text not null unique,
  email text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_ip text,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists customer_portal_sessions_token_idx on customer_portal_sessions(token);
create index if not exists customer_portal_sessions_customer_idx on customer_portal_sessions(customer_id);

-- Portal sessions are validated by an api route using the service-role key
-- (no user session at portal entry). No RLS policy intentionally — only
-- service role or anon-by-token access from the portal middleware.
alter table customer_portal_sessions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'customer_portal_sessions' and policyname = 'portal_sessions service only') then
    -- Org members can view sessions for their customers (e.g. to revoke).
    create policy "portal_sessions service only" on customer_portal_sessions for select
      using (is_org_member(organization_id));
    create policy "portal_sessions org delete" on customer_portal_sessions for delete
      using (is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- Job chemical usage (auto-deduct on completion)
-- =====================================================================
create table if not exists job_chemical_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  chemical_id uuid not null references chemicals(id) on delete cascade,
  quantity numeric(12, 4) not null,
  applied boolean default false,
  applied_at timestamptz,
  transaction_id uuid references chemical_transactions(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists job_chemical_usage_job_idx on job_chemical_usage(job_id);
create index if not exists job_chemical_usage_org_idx on job_chemical_usage(organization_id);

alter table job_chemical_usage enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'job_chemical_usage' and policyname = 'job_chemical_usage org member') then
    create policy "job_chemical_usage org member" on job_chemical_usage for all
      using (is_org_member(organization_id)) with check (is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- Stripe Connect + recurring subscription support
-- =====================================================================
alter table organizations
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_status text,
  add column if not exists stripe_connect_connected_at timestamptz;

alter table contracts
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text;

alter table customers
  add column if not exists stripe_customer_id text;

-- =====================================================================
-- MFA tracking (Supabase Auth handles the actual TOTP storage; we just
-- expose a convenience column on profiles so the UI can show enrollment.)
-- =====================================================================
alter table profiles
  add column if not exists mfa_enrolled boolean default false;
