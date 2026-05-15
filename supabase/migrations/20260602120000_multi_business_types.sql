-- Multi-trade orgs. The single organizations.business_type_id stays as the
-- "primary" trade (used for things that need one canonical answer like the
-- welcome banner copy or the default form config), but additional trades
-- live in this join table. First 2 trades are included; 3rd and beyond
-- cost the per-trade add-on (priced via STRIPE_PRICE_ID_BUSINESS_TYPE_ADDON).

create table if not exists organization_business_types (
  organization_id uuid not null references organizations(id) on delete cascade,
  business_type_id text not null references business_types(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id, business_type_id)
);

alter table organization_business_types enable row level security;

drop policy if exists "members read org business types" on organization_business_types;
create policy "members read org business types"
  on organization_business_types for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()) or is_platform_admin());

drop policy if exists "members write org business types" on organization_business_types;
create policy "members write org business types"
  on organization_business_types for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "public read org business types for booking" on organization_business_types;
create policy "public read org business types for booking"
  on organization_business_types for select
  using (exists (select 1 from organizations o where o.id = organization_business_types.organization_id and o.slug is not null));

insert into organization_business_types (organization_id, business_type_id, is_primary)
select id, business_type_id, true
  from organizations
 where business_type_id is not null
on conflict do nothing;
