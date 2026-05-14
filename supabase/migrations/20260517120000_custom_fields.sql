-- Custom fields system: per-org user-defined fields that attach to a target
-- entity (customer, lead, estimate, job, invoice, property). Phase 3 of the
-- multi-trade pivot.

create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  applies_to text not null check (applies_to in ('customer','lead','estimate','job','invoice','property')),
  field_key text not null,
  field_label text not null,
  field_type text not null check (field_type in ('text','long_text','number','currency','dropdown','checkbox','date','phone','email','url')),
  options jsonb default '[]'::jsonb,
  required boolean default false,
  customer_visible boolean default false,
  sort_order int default 100,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, applies_to, field_key)
);

create index if not exists custom_fields_org_idx on custom_fields (organization_id, applies_to, sort_order);

alter table custom_fields enable row level security;

drop policy if exists "members read custom fields" on custom_fields;
create policy "members read custom fields"
  on custom_fields for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "owners manage custom fields" on custom_fields;
create policy "owners manage custom fields"
  on custom_fields for all
  using (organization_id in (
    select organization_id from organization_members
    where user_id = auth.uid() and role in ('owner','admin')
  ))
  with check (organization_id in (
    select organization_id from organization_members
    where user_id = auth.uid() and role in ('owner','admin')
  ));

create table if not exists custom_field_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  field_id uuid not null references custom_fields(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (field_id, entity_id)
);

create index if not exists custom_field_values_entity_idx on custom_field_values (entity_type, entity_id);

alter table custom_field_values enable row level security;

drop policy if exists "members read custom field values" on custom_field_values;
create policy "members read custom field values"
  on custom_field_values for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "members manage custom field values" on custom_field_values;
create policy "members manage custom field values"
  on custom_field_values for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));
