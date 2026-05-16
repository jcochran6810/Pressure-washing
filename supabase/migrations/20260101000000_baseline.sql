-- =====================================================================
-- BASELINE SCHEMA
-- All tables, functions, triggers, and storage buckets required for the
-- core app. The 20260513120000_features_pack.sql migration assumes this
-- one has already run.
-- =====================================================================

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists pgcrypto;

-- =====================================================================
-- Profiles + organizations + memberships
-- =====================================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  website text,
  logo_url text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text default 'US',
  currency text default 'USD',
  tax_rate numeric(8, 6) default 0,
  invoice_prefix text default 'INV',
  estimate_prefix text default 'EST',
  next_invoice_number integer default 1000,
  next_estimate_number integer default 1000,
  stripe_account_id text,
  google_review_url text,
  review_request_enabled boolean default true,
  appointment_reminder_hours integer default 24,
  recurring_reminder_months integer default 12,
  global_min_job_price numeric(12, 2) default 0,
  deposit_threshold numeric(12, 2) default 0,
  deposit_percentage numeric(5, 4) default 0.25,
  is_demo boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  default_organization_id uuid references organizations(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz default now(),
  primary key (organization_id, user_id)
);
create index if not exists organization_members_user_idx on organization_members(user_id);

-- =====================================================================
-- is_org_member: foundation of all RLS. Inline SECURITY DEFINER to avoid
-- recursion on the organization_members table when RLS policies call it.
-- =====================================================================
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

grant execute on function is_org_member(uuid) to anon, authenticated;

-- =====================================================================
-- RLS on profiles/orgs/members
-- =====================================================================
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'profiles self read' and tablename = 'profiles') then
    create policy "profiles self read" on profiles for select using (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'profiles self write' and tablename = 'profiles') then
    create policy "profiles self write" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where policyname = 'organizations members read' and tablename = 'organizations') then
    create policy "organizations members read" on organizations for select using (is_org_member(id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'organizations members write' and tablename = 'organizations') then
    create policy "organizations members write" on organizations for update using (is_org_member(id)) with check (is_org_member(id));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'organization_members self read' and tablename = 'organization_members') then
    create policy "organization_members self read" on organization_members for select using (user_id = auth.uid() or is_org_member(organization_id));
  end if;
end$$;

-- =====================================================================
-- Customers + properties
-- =====================================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  mobile_phone text,
  customer_type text default 'residential',
  lead_source text,
  tags text[],
  notes text,
  qbo_id text,
  qbo_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists customers_org_idx on customers(organization_id);
create index if not exists customers_email_idx on customers(organization_id, email);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  nickname text,
  address_line1 text not null,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text default 'US',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  square_footage integer,
  stories integer,
  gate_code text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists properties_org_idx on properties(organization_id);
create index if not exists properties_customer_idx on properties(customer_id);

-- =====================================================================
-- Services catalog
-- =====================================================================
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  category text,
  pricing_unit text default 'flat' check (pricing_unit in ('flat', 'sqft', 'linear_ft', 'hour', 'each')),
  default_price numeric(12, 2),
  min_charge numeric(12, 2),
  material_modifiers jsonb default '{}'::jsonb,
  height_modifier numeric(5, 4) default 0,
  is_addon boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);
create index if not exists services_org_idx on services(organization_id);

-- =====================================================================
-- Lead sources + leads + campaigns
-- =====================================================================
create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  active boolean default true,
  cost_per_month numeric(12, 2),
  created_at timestamptz default now()
);
create index if not exists lead_sources_org_idx on lead_sources(organization_id);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  address text,
  status text default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'lost', 'nurture')),
  source_id uuid references lead_sources(id) on delete set null,
  estimated_value numeric(12, 2),
  notes text,
  contacted_at timestamptz,
  converted_to_customer_id uuid references customers(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists leads_org_idx on leads(organization_id);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  channel text,
  status text default 'active',
  start_date date,
  end_date date,
  budget numeric(12, 2),
  spent numeric(12, 2) default 0,
  impressions integer default 0,
  clicks integer default 0,
  conversions integer default 0,
  leads_generated integer default 0,
  notes text,
  created_at timestamptz default now()
);
create index if not exists campaigns_org_idx on campaigns(organization_id);

-- =====================================================================
-- Estimates + invoices + line items + payments
-- =====================================================================
create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  estimate_number text not null,
  status text default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  issue_date date default current_date,
  expires_at date,
  subtotal numeric(12, 2) default 0,
  discount_amount numeric(12, 2) default 0,
  tax_rate numeric(8, 6) default 0,
  tax_amount numeric(12, 2) default 0,
  total numeric(12, 2) default 0,
  deposit_amount numeric(12, 2),
  duration_minutes integer,
  buffer_minutes integer default 30,
  notes text,
  terms text,
  approval_token text unique,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  declined_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists estimates_org_idx on estimates(organization_id);
create index if not exists estimates_customer_idx on estimates(customer_id);
create index if not exists estimates_token_idx on estimates(approval_token);

create table if not exists estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  description text not null,
  quantity numeric(12, 4) default 1,
  unit_price numeric(12, 2) default 0,
  total numeric(12, 2) default 0,
  sort_order integer default 0,
  photo_urls text[] default '{}'
);
create index if not exists estimate_line_items_estimate_idx on estimate_line_items(estimate_id);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  estimate_id uuid references estimates(id) on delete set null,
  job_id uuid,
  invoice_number text not null,
  status text default 'draft' check (status in ('draft', 'sent', 'partial', 'paid', 'overdue', 'void')),
  issue_date date default current_date,
  due_date date,
  subtotal numeric(12, 2) default 0,
  discount_amount numeric(12, 2) default 0,
  tax_rate numeric(8, 6) default 0,
  tax_amount numeric(12, 2) default 0,
  total numeric(12, 2) default 0,
  amount_paid numeric(12, 2) default 0,
  balance_due numeric(12, 2) default 0,
  stripe_payment_link text,
  qbo_id text,
  qbo_synced_at timestamptz,
  notes text,
  terms text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists invoices_org_idx on invoices(organization_id);
create index if not exists invoices_customer_idx on invoices(customer_id);
create index if not exists invoices_status_idx on invoices(organization_id, status);

create table if not exists invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  description text not null,
  quantity numeric(12, 4) default 1,
  unit_price numeric(12, 2) default 0,
  total numeric(12, 2) default 0,
  sort_order integer default 0,
  photo_urls text[] default '{}'
);
create index if not exists invoice_line_items_invoice_idx on invoice_line_items(invoice_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  amount numeric(12, 2) not null,
  payment_method text default 'cash',
  payment_date date default current_date,
  reference_number text,
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists payments_org_idx on payments(organization_id);
create index if not exists payments_invoice_idx on payments(invoice_id);

-- =====================================================================
-- Jobs + assignments
-- =====================================================================
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  job_number text,
  title text not null,
  description text,
  status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  duration_minutes integer,
  buffer_minutes integer,
  total_amount numeric(12, 2) default 0,
  before_photos text[] default '{}',
  after_photos text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists jobs_org_idx on jobs(organization_id);
create index if not exists jobs_customer_idx on jobs(customer_id);
create index if not exists jobs_status_idx on jobs(organization_id, status);
create index if not exists jobs_scheduled_idx on jobs(organization_id, scheduled_start);

-- Now that jobs exists, link invoices.job_id properly
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_job_id_fkey'
  ) then
    alter table invoices add constraint invoices_job_id_fkey
      foreign key (job_id) references jobs(id) on delete set null;
  end if;
end$$;

create table if not exists job_assignments (
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'crew',
  primary key (job_id, user_id)
);

-- =====================================================================
-- Photo attachments + public galleries
-- =====================================================================
create table if not exists photo_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  job_id uuid references jobs(id) on delete cascade,
  estimate_id uuid references estimates(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  url text not null,
  storage_path text,
  kind text default 'reference',
  caption text,
  created_at timestamptz default now()
);
create index if not exists photo_attachments_org_idx on photo_attachments(organization_id);
create index if not exists photo_attachments_job_idx on photo_attachments(job_id);
create index if not exists photo_attachments_estimate_idx on photo_attachments(estimate_id);
create index if not exists photo_attachments_invoice_idx on photo_attachments(invoice_id);

-- "photos" alias view some pages reference directly — not a separate table
-- but we expose it as a view for backwards-compat with any code path that
-- selects from "photos".
create or replace view photos as
  select id, organization_id, customer_id, property_id, job_id, estimate_id, invoice_id,
         url, storage_path, kind, caption, created_at
  from photo_attachments;

create table if not exists public_galleries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  token text not null unique,
  title text,
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists public_galleries_token_idx on public_galleries(token);

-- =====================================================================
-- Expenses + categories
-- =====================================================================
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);
create index if not exists expense_categories_org_idx on expense_categories(organization_id);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category_id uuid references expense_categories(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  vendor text,
  amount numeric(12, 2) not null,
  description text,
  expense_date date default current_date,
  payment_method text,
  receipt_url text,
  tax_deductible boolean default true,
  created_at timestamptz default now()
);
create index if not exists expenses_org_idx on expenses(organization_id);
create index if not exists expenses_date_idx on expenses(organization_id, expense_date);

-- =====================================================================
-- Chemicals + recipes + transactions + equipment
-- =====================================================================
create table if not exists chemicals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  brand text,
  category text,
  description text,
  unit text default 'gallon',
  current_stock numeric(12, 4) default 0,
  reorder_level numeric(12, 4),
  cost_per_unit numeric(12, 4),
  supplier text,
  sku text,
  sds_url text,
  hazard_class text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists chemicals_org_idx on chemicals(organization_id);

create table if not exists chemical_recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  components jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists chemical_recipes_org_idx on chemical_recipes(organization_id);

create table if not exists chemical_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  chemical_id uuid not null references chemicals(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  transaction_type text not null check (transaction_type in ('purchase', 'usage', 'waste', 'adjustment')),
  quantity numeric(12, 4) not null,
  cost numeric(12, 2),
  transaction_date date default current_date,
  notes text,
  created_at timestamptz default now()
);
create index if not exists chemical_transactions_org_idx on chemical_transactions(organization_id);
create index if not exists chemical_transactions_chemical_idx on chemical_transactions(chemical_id);

create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type text,
  serial_number text,
  purchase_date date,
  purchase_price numeric(12, 2),
  current_value numeric(12, 2),
  hours_used numeric(12, 2),
  status text default 'active' check (status in ('active', 'maintenance', 'inactive', 'retired')),
  last_service_date date,
  next_service_date date,
  notes text,
  created_at timestamptz default now()
);
create index if not exists equipment_org_idx on equipment(organization_id);

-- =====================================================================
-- Reminders + receipt log + review feedback
-- =====================================================================
create table if not exists customer_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  kind text not null check (kind in ('appointment', 'recurring_service', 'invoice_due', 'review_request', 'custom')),
  channel text default 'email' check (channel in ('email', 'sms')),
  scheduled_for timestamptz not null,
  message text,
  status text default 'scheduled' check (status in ('scheduled', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);
create index if not exists customer_reminders_due_idx on customer_reminders(status, scheduled_for);
create index if not exists customer_reminders_org_idx on customer_reminders(organization_id);

create table if not exists receipt_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  email_to text,
  provider text default 'resend',
  provider_id text,
  status text default 'sent',
  sent_at timestamptz default now()
);
create index if not exists receipt_log_org_idx on receipt_log(organization_id);

create table if not exists review_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  token text not null unique,
  rating smallint check (rating between 1 and 5),
  comments text,
  submitted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists review_feedback_token_idx on review_feedback(token);

-- =====================================================================
-- Satellite measurements
-- =====================================================================
create table if not exists measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  estimate_id uuid references estimates(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  label text,
  material text,
  notes text,
  polygon jsonb not null,
  area_sqft numeric(14, 2),
  perimeter_ft numeric(14, 2),
  center_lat numeric(10, 7),
  center_lng numeric(10, 7),
  created_at timestamptz default now()
);
create index if not exists measurements_org_idx on measurements(organization_id);

-- =====================================================================
-- Google Drive connections (Drive integration tokens)
-- =====================================================================
create table if not exists google_drive_connections (
  organization_id uuid primary key references organizations(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  drive_folder_id text,
  invoices_folder_id text,
  estimates_folder_id text,
  photos_folder_id text,
  receipts_folder_id text,
  scopes text[],
  connected_email text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================================================================
-- RLS for everything — org-scoped
-- =====================================================================
do $$
declare
  t text;
  tables text[] := array[
    'customers', 'properties', 'services',
    'lead_sources', 'leads', 'campaigns',
    'estimates', 'estimate_line_items',
    'invoices', 'invoice_line_items', 'payments',
    'jobs', 'job_assignments',
    'photo_attachments', 'public_galleries',
    'expense_categories', 'expenses',
    'chemicals', 'chemical_recipes', 'chemical_transactions', 'equipment',
    'customer_reminders', 'receipt_log', 'review_feedback',
    'measurements', 'google_drive_connections'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end$$;

-- Helper macro emitted per-table. Skips tables joined-through (line items)
-- which inherit org isolation via the parent.
do $$
declare
  t text;
  org_tables text[] := array[
    'customers', 'properties', 'services',
    'lead_sources', 'leads', 'campaigns',
    'estimates', 'invoices', 'payments',
    'jobs', 'photo_attachments', 'public_galleries',
    'expense_categories', 'expenses',
    'chemicals', 'chemical_recipes', 'chemical_transactions', 'equipment',
    'customer_reminders', 'receipt_log', 'review_feedback',
    'measurements', 'google_drive_connections'
  ];
begin
  foreach t in array org_tables loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = t || ' org member'
    ) then
      execute format(
        'create policy "%s org member" on %I for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));',
        t, t
      );
    end if;
  end loop;
end$$;

-- Line items inherit isolation via their parent table
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'estimate_line_items' and policyname = 'estimate_line_items org member') then
    create policy "estimate_line_items org member" on estimate_line_items for all
      using (exists (select 1 from estimates e where e.id = estimate_line_items.estimate_id and is_org_member(e.organization_id)))
      with check (exists (select 1 from estimates e where e.id = estimate_line_items.estimate_id and is_org_member(e.organization_id)));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'invoice_line_items' and policyname = 'invoice_line_items org member') then
    create policy "invoice_line_items org member" on invoice_line_items for all
      using (exists (select 1 from invoices i where i.id = invoice_line_items.invoice_id and is_org_member(i.organization_id)))
      with check (exists (select 1 from invoices i where i.id = invoice_line_items.invoice_id and is_org_member(i.organization_id)));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'job_assignments' and policyname = 'job_assignments org member') then
    create policy "job_assignments org member" on job_assignments for all
      using (exists (select 1 from jobs j where j.id = job_assignments.job_id and is_org_member(j.organization_id)))
      with check (exists (select 1 from jobs j where j.id = job_assignments.job_id and is_org_member(j.organization_id)));
  end if;
end$$;

-- =====================================================================
-- Public token policies (anon access scoped by random token)
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'public_galleries' and policyname = 'public_galleries anon by token') then
    create policy "public_galleries anon by token" on public_galleries for select to anon
      using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'review_feedback' and policyname = 'review_feedback anon by token') then
    create policy "review_feedback anon by token" on review_feedback for select to anon
      using (submitted_at is null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'review_feedback' and policyname = 'review_feedback anon submit') then
    create policy "review_feedback anon submit" on review_feedback for update to anon
      using (submitted_at is null) with check (true);
  end if;
end$$;

-- =====================================================================
-- accept_estimate_by_token RPC (called from public quote flow)
-- =====================================================================
create or replace function accept_estimate_by_token(p_token text, p_signer text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estimate_id uuid;
  v_org uuid;
  v_customer uuid;
  v_property uuid;
  v_estimate_number text;
  v_total numeric;
  v_duration integer;
  v_buffer integer;
  v_notes text;
  v_existing uuid;
  v_job_id uuid;
begin
  select id, organization_id, customer_id, property_id, estimate_number,
         total, duration_minutes, buffer_minutes, notes
    into v_estimate_id, v_org, v_customer, v_property, v_estimate_number,
         v_total, v_duration, v_buffer, v_notes
  from estimates
  where approval_token = p_token
    and (expires_at is null or expires_at >= current_date)
    and status in ('draft', 'sent');

  if v_estimate_id is null then
    raise exception 'Estimate not found, expired, or already responded to';
  end if;

  update estimates
    set status = 'accepted', accepted_at = now()
    where id = v_estimate_id;

  -- Auto-create a scheduled job if there isn't one already
  select id into v_existing from jobs where estimate_id = v_estimate_id limit 1;
  if v_existing is null then
    insert into jobs (
      organization_id, customer_id, property_id, estimate_id,
      title, description, status, total_amount, duration_minutes, buffer_minutes
    ) values (
      v_org, v_customer, v_property, v_estimate_id,
      'Job from ' || v_estimate_number, v_notes, 'scheduled', v_total, v_duration, coalesce(v_buffer, 30)
    ) returning id into v_job_id;
  else
    v_job_id := v_existing;
  end if;

  return v_estimate_id;
end;
$$;

grant execute on function accept_estimate_by_token(text, text) to anon, authenticated;

-- =====================================================================
-- handle_new_user trigger: seeds an org + memberships + defaults
-- =====================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_full_name text;
  v_email text;
begin
  v_email := new.email;
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(v_email, ''), '@', 1));

  insert into organizations (name, email)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', v_full_name || '''s Business'),
    v_email
  )
  returning id into v_org_id;

  insert into profiles (id, full_name, default_organization_id)
  values (new.id, v_full_name, v_org_id);

  insert into organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  -- Default services
  insert into services (organization_id, name, description, pricing_unit, default_price) values
    (v_org_id, 'House Wash', 'Full exterior soft wash', 'flat', 350),
    (v_org_id, 'Driveway Cleaning', 'Concrete driveway + walkway cleaning', 'sqft', 0.15),
    (v_org_id, 'Roof Wash (Soft)', 'Asphalt/tile roof soft wash', 'sqft', 0.35),
    (v_org_id, 'Deck/Fence Cleaning', 'Wood deck or fence cleaning', 'sqft', 0.85),
    (v_org_id, 'Concrete Sealing', 'Concrete seal + protect', 'sqft', 0.65),
    (v_org_id, 'Gutter Cleaning', 'Gutter + downspout cleaning', 'linear_ft', 1.75);

  -- Default expense categories
  insert into expense_categories (organization_id, name) values
    (v_org_id, 'Chemicals'),
    (v_org_id, 'Fuel'),
    (v_org_id, 'Equipment'),
    (v_org_id, 'Vehicle/Insurance'),
    (v_org_id, 'Marketing'),
    (v_org_id, 'Office/Software'),
    (v_org_id, 'Labor'),
    (v_org_id, 'Other');

  -- Default lead sources
  insert into lead_sources (organization_id, name) values
    (v_org_id, 'Google'),
    (v_org_id, 'Facebook'),
    (v_org_id, 'Referral'),
    (v_org_id, 'Yard sign'),
    (v_org_id, 'Door hanger'),
    (v_org_id, 'Other');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- Storage buckets (signed-URL files: photos, signatures, receipts, logos)
-- =====================================================================
insert into storage.buckets (id, name, public)
  values
    ('photos', 'photos', false),
    ('signatures', 'signatures', false),
    ('receipts', 'receipts', false),
    ('logos', 'logos', true)
  on conflict (id) do nothing;

-- Photos bucket: org members can RW their own org's folder (path starts with org id)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'photos org member access') then
    create policy "photos org member access" on storage.objects for all
      using (
        bucket_id = 'photos'
        and is_org_member((storage.foldername(name))[1]::uuid)
      ) with check (
        bucket_id = 'photos'
        and is_org_member((storage.foldername(name))[1]::uuid)
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'signatures org member access') then
    create policy "signatures org member access" on storage.objects for all
      using (
        bucket_id = 'signatures'
        and is_org_member((storage.foldername(name))[1]::uuid)
      ) with check (
        bucket_id = 'signatures'
        and is_org_member((storage.foldername(name))[1]::uuid)
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'receipts org member access') then
    create policy "receipts org member access" on storage.objects for all
      using (
        bucket_id = 'receipts'
        and is_org_member((storage.foldername(name))[1]::uuid)
      ) with check (
        bucket_id = 'receipts'
        and is_org_member((storage.foldername(name))[1]::uuid)
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'logos public read') then
    create policy "logos public read" on storage.objects for select to anon, authenticated
      using (bucket_id = 'logos');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'logos org write') then
    create policy "logos org write" on storage.objects for insert
      with check (bucket_id = 'logos' and is_org_member((storage.foldername(name))[1]::uuid));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'logos org update') then
    create policy "logos org update" on storage.objects for update
      using (bucket_id = 'logos' and is_org_member((storage.foldername(name))[1]::uuid))
      with check (bucket_id = 'logos' and is_org_member((storage.foldername(name))[1]::uuid));
  end if;
end$$;

-- =====================================================================
-- updated_at triggers for tables that have the column
-- =====================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
  tables_with_updated_at text[] := array[
    'organizations', 'profiles', 'customers', 'properties',
    'estimates', 'invoices', 'jobs', 'chemicals', 'leads'
  ];
begin
  foreach t in array tables_with_updated_at loop
    if not exists (select 1 from pg_trigger where tgname = t || '_set_updated_at') then
      execute format('create trigger %I before update on %I for each row execute function set_updated_at();', t || '_set_updated_at', t);
    end if;
  end loop;
end$$;
