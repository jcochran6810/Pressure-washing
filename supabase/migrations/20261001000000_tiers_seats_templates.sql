-- =====================================================================
-- TIERS + SEATS + TEMPLATES ADD-ONS
-- Adds:
--   1. estimates.prepared_by
--   2. Plus + Pro tiers in subscription_plans
--   3. Seat support: additional_seats column + organization_invites table
--   4. Premium templates add-on flag + document_field_visibility config
-- =====================================================================

-- =====================================================================
-- 1. Estimate prepared-by field
-- =====================================================================
alter table estimates
  add column if not exists prepared_by text;

-- =====================================================================
-- 2. Subscription plan capabilities
-- =====================================================================
alter table subscription_plans
  add column if not exists seats_allowed boolean default false,
  add column if not exists premium_templates_allowed boolean default false,
  add column if not exists seat_amount numeric(10, 2) default 5,
  add column if not exists addon_seat_stripe_price_id text,
  add column if not exists addon_premium_templates_stripe_price_id text,
  add column if not exists premium_templates_amount numeric(10, 2) default 5;

-- Re-seed: starter unchanged, add Plus and Pro
insert into subscription_plans (slug, name, description, monthly_amount, features, is_featured, sort_order,
  seats_allowed, premium_templates_allowed)
values
  ('plus', 'Plus', 'For growing teams. Add seats and unlock template customization.', 79,
    '["Everything in Starter",
      "Add team members at $5/user/month",
      "Optional Premium Templates add-on ($5/month)",
      "Priority email support"]'::jsonb,
    true, 10, true, true),
  ('pro', 'Pro', 'Full-power. Best for established crews.', 149,
    '["Everything in Plus",
      "Premium Templates included",
      "Advanced reporting + segmentation",
      "Phone support",
      "Onboarding session"]'::jsonb,
    false, 20, true, true)
on conflict (slug) do update set
  description = excluded.description,
  monthly_amount = excluded.monthly_amount,
  features = excluded.features,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  seats_allowed = excluded.seats_allowed,
  premium_templates_allowed = excluded.premium_templates_allowed,
  updated_at = now();

-- Mark starter as no-seats / no-templates
update subscription_plans set is_featured = false where slug = 'starter';

-- =====================================================================
-- 3. Seat tracking on organizations + invites
-- =====================================================================
alter table organizations
  add column if not exists additional_seats integer not null default 0,
  add column if not exists seats_stripe_item_id text,
  add column if not exists premium_templates_enabled boolean not null default false,
  add column if not exists premium_templates_stripe_item_id text;

create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists organization_invites_token_idx on organization_invites(token);
create index if not exists organization_invites_org_idx on organization_invites(organization_id, accepted_at, revoked_at);

alter table organization_invites enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'organization_invites' and policyname = 'invites org member') then
    create policy "invites org member" on organization_invites for all
      using (is_org_member(organization_id)) with check (is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- 4. Per-org document field visibility
--
-- Default visibility for each document type lives in code. The org overrides
-- by setting keys here. Only Plus/Pro orgs with premium_templates_enabled
-- see this UI (enforced in app code, not DB).
-- =====================================================================
alter table organizations
  add column if not exists document_field_visibility jsonb not null default '{}'::jsonb;

-- =====================================================================
-- 5. Helpers
-- =====================================================================
-- Current seat usage = number of org members - 1 (the owner is included in base plan)
create or replace function org_seat_usage(org_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, count(*)::integer - 1)
  from organization_members
  where organization_id = org_id;
$$;
grant execute on function org_seat_usage(uuid) to authenticated;
