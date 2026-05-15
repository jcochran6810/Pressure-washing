-- Admin-granted "comped" access — free-tier override for friends, beta
-- testers, internal accounts, etc. Lives alongside the Stripe subscription
-- fields. resolveOrgAccess() reads both and decides who's allowed in.

alter table organizations
  add column if not exists access_source text not null default 'stripe',
  add column if not exists comped_until timestamptz,
  add column if not exists comped_reason text,
  add column if not exists comped_by uuid references auth.users(id) on delete set null,
  add column if not exists comped_at timestamptz;

create table if not exists access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('basic','plus','pro')),
  access_source text not null default 'admin_grant',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  reason text,
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table access_grants enable row level security;

drop policy if exists "admins read access grants" on access_grants;
create policy "admins read access grants"
  on access_grants for select
  using (is_platform_admin());

drop policy if exists "admins write access grants" on access_grants;
create policy "admins write access grants"
  on access_grants for all
  using (is_platform_admin())
  with check (is_platform_admin());

create index if not exists access_grants_org_idx on access_grants(organization_id, starts_at desc);
