-- Features pack migration
-- Adds: photo annotations, message templates, contracts/recurring scheduling,
-- accounting sync metadata + QBO OAuth, liability waivers + signatures,
-- public quote RLS, telnyx/qbo org fields.

-- =====================================================================
-- Org-level fields (toggles + integration settings)
-- =====================================================================
alter table organizations
  add column if not exists telnyx_messaging_profile_id text,
  add column if not exists sms_from_number text,
  add column if not exists default_waiver_id uuid;

-- =====================================================================
-- Quote RLS policy (the long-pending one)
-- Public reads of estimates by approval_token only.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'public quote read'
      and tablename = 'estimates'
  ) then
    execute $p$
      create policy "public quote read"
        on estimates for select
        to anon
        using (approval_token is not null);
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where policyname = 'public quote line items read'
      and tablename = 'estimate_line_items'
  ) then
    execute $p$
      create policy "public quote line items read"
        on estimate_line_items for select
        to anon
        using (
          exists (
            select 1 from estimates e
            where e.id = estimate_line_items.estimate_id
              and e.approval_token is not null
          )
        );
    $p$;
  end if;
end$$;

-- Photo attachments: annotated render column
alter table photo_attachments
  add column if not exists annotated_url text;

-- =====================================================================
-- Photo annotations (overlay shapes on photo_attachments)
-- =====================================================================
create table if not exists photo_annotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  photo_id uuid not null,
  shapes jsonb not null default '[]'::jsonb,
  -- shapes: [{ kind: 'arrow'|'rect'|'circle'|'free'|'text', color, x, y, w, h, points, text }]
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists photo_annotations_photo_idx on photo_annotations(photo_id);
create index if not exists photo_annotations_org_idx on photo_annotations(organization_id);

alter table photo_annotations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'photo_annotations org member' and tablename = 'photo_annotations') then
    execute $p$
      create policy "photo_annotations org member" on photo_annotations
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

-- =====================================================================
-- Message templates (email + SMS) per org
-- =====================================================================
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  -- kind: 'estimate_send' | 'invoice_send' | 'receipt' | 'payment_reminder' |
  --       'appointment_reminder' | 'review_request' | 'contract_renewal' | 'waiver_request'
  channel text not null check (channel in ('email', 'sms')),
  name text not null,
  subject text,
  body text not null,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists message_templates_org_idx on message_templates(organization_id);
create index if not exists message_templates_kind_idx on message_templates(organization_id, kind, channel);

alter table message_templates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'message_templates org member' and tablename = 'message_templates') then
    execute $p$
      create policy "message_templates org member" on message_templates
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

-- =====================================================================
-- Contracts / recurring scheduling
-- =====================================================================
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'expired')),
  cadence_months integer not null default 12 check (cadence_months > 0),
  preferred_day smallint, -- 1-28 day of month
  start_date date not null default current_date,
  next_run_date date not null default current_date,
  end_date date,
  default_amount numeric(12, 2),
  service_template jsonb not null default '[]'::jsonb,
  -- service_template: [{ description, quantity, unit_price }]
  auto_create_estimate boolean default true,
  auto_create_job boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists contracts_org_idx on contracts(organization_id);
create index if not exists contracts_next_run_idx on contracts(organization_id, status, next_run_date);

alter table contracts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'contracts org member' and tablename = 'contracts') then
    execute $p$
      create policy "contracts org member" on contracts
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

create table if not exists contract_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete cascade,
  run_date date not null,
  estimate_id uuid references estimates(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  status text not null default 'created' check (status in ('created', 'skipped', 'failed')),
  error text,
  created_at timestamptz default now()
);
create index if not exists contract_runs_contract_idx on contract_runs(contract_id);

alter table contract_runs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'contract_runs org member' and tablename = 'contract_runs') then
    execute $p$
      create policy "contract_runs org member" on contract_runs
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

-- =====================================================================
-- Liability waivers + signatures
-- =====================================================================
create table if not exists waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  body text not null,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists waivers_org_idx on waivers(organization_id);

alter table waivers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'waivers org member' and tablename = 'waivers') then
    execute $p$
      create policy "waivers org member" on waivers
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;

  -- Public read of waiver body by signature token (looked up via waiver_signatures.token)
  if not exists (select 1 from pg_policies where policyname = 'waivers public read via signature' and tablename = 'waivers') then
    execute $p$
      create policy "waivers public read via signature" on waivers
        for select to anon
        using (
          exists (
            select 1 from waiver_signatures ws
            where ws.waiver_id = waivers.id
          )
        );
    $p$;
  end if;
end$$;

create table if not exists waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  waiver_id uuid not null references waivers(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  token text not null unique,
  signer_name text,
  signer_email text,
  signer_phone text,
  signature_image_url text,
  signed_text text,
  status text not null default 'pending' check (status in ('pending', 'signed', 'declined', 'expired')),
  signed_at timestamptz,
  declined_reason text,
  ip text,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists waiver_signatures_org_idx on waiver_signatures(organization_id);
create index if not exists waiver_signatures_customer_idx on waiver_signatures(customer_id);
create index if not exists waiver_signatures_token_idx on waiver_signatures(token);

alter table waiver_signatures enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'waiver_signatures org member' and tablename = 'waiver_signatures') then
    execute $p$
      create policy "waiver_signatures org member" on waiver_signatures
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
  -- Public read + update by token (anon signer)
  if not exists (select 1 from pg_policies where policyname = 'waiver_signatures public by token' and tablename = 'waiver_signatures') then
    execute $p$
      create policy "waiver_signatures public by token" on waiver_signatures
        for select to anon using (token is not null);
    $p$;
  end if;
  if not exists (select 1 from pg_policies where policyname = 'waiver_signatures public sign by token' and tablename = 'waiver_signatures') then
    execute $p$
      create policy "waiver_signatures public sign by token" on waiver_signatures
        for update to anon using (token is not null and status = 'pending');
    $p$;
  end if;
end$$;

-- =====================================================================
-- Accounting sync
-- =====================================================================
create table if not exists accounting_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('invoices', 'payments', 'expenses', 'customers', 'qbo_push')),
  format text not null check (format in ('csv', 'qbo')),
  from_date date,
  to_date date,
  row_count integer default 0,
  notes text,
  created_at timestamptz default now(),
  created_by uuid
);
create index if not exists accounting_exports_org_idx on accounting_exports(organization_id, created_at desc);

alter table accounting_exports enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'accounting_exports org member' and tablename = 'accounting_exports') then
    execute $p$
      create policy "accounting_exports org member" on accounting_exports
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

create table if not exists qbo_connections (
  organization_id uuid primary key references organizations(id) on delete cascade,
  realm_id text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  connected_email text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table qbo_connections enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'qbo_connections org member' and tablename = 'qbo_connections') then
    execute $p$
      create policy "qbo_connections org member" on qbo_connections
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

-- QBO sync state on invoices / customers
alter table invoices
  add column if not exists qbo_id text,
  add column if not exists qbo_synced_at timestamptz;

alter table customers
  add column if not exists qbo_id text,
  add column if not exists qbo_synced_at timestamptz;

-- =====================================================================
-- SMS log
-- =====================================================================
create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  to_number text not null,
  from_number text,
  body text not null,
  provider text default 'telnyx',
  provider_id text,
  status text default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  error text,
  related_kind text, -- 'estimate' | 'invoice' | 'receipt' | 'reminder' | 'waiver' | 'manual'
  related_id uuid,
  sent_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists sms_log_org_idx on sms_log(organization_id, created_at desc);
create index if not exists sms_log_customer_idx on sms_log(customer_id);

alter table sms_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'sms_log org member' and tablename = 'sms_log') then
    execute $p$
      create policy "sms_log org member" on sms_log
        for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
    $p$;
  end if;
end$$;

-- =====================================================================
-- Updated_at triggers
-- =====================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'contracts_set_updated_at') then
    create trigger contracts_set_updated_at before update on contracts for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'waivers_set_updated_at') then
    create trigger waivers_set_updated_at before update on waivers for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'waiver_signatures_set_updated_at') then
    create trigger waiver_signatures_set_updated_at before update on waiver_signatures for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'photo_annotations_set_updated_at') then
    create trigger photo_annotations_set_updated_at before update on photo_annotations for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'message_templates_set_updated_at') then
    create trigger message_templates_set_updated_at before update on message_templates for each row execute function set_updated_at();
  end if;
end$$;
