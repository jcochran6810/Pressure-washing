-- Phase 6: recurring jobs + follow-ups
--
-- recurring_jobs is the template ("mow Sarah's lawn every 2 weeks at $45")
-- and a cron tick materialises a new job from it whenever next_service_date
-- is due. follow_ups is a simple per-org task list of "remember to call X".

create table if not exists recurring_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  title text not null,
  description text,
  recurrence_kind text not null default 'weekly'
    check (recurrence_kind in ('daily','weekly','biweekly','triweekly','monthly','quarterly','semiannual','annual','seasonal','custom_days')),
  recurrence_interval int default 1,
  next_service_date date not null,
  last_service_date date,
  default_price numeric default 0,
  duration_minutes int default 60,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists recurring_jobs_org_idx on recurring_jobs (organization_id, active, next_service_date);

alter table recurring_jobs enable row level security;

drop policy if exists "members read recurring jobs" on recurring_jobs;
create policy "members read recurring jobs"
  on recurring_jobs for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "members manage recurring jobs" on recurring_jobs;
create policy "members manage recurring jobs"
  on recurring_jobs for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

alter table jobs
  add column if not exists recurring_job_id uuid references recurring_jobs(id) on delete set null;

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  estimate_id uuid references estimates(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  kind text not null default 'general'
    check (kind in ('general','call','text','email','site_visit','quote_followup','review_request','collection')),
  due_date date not null default current_date,
  notes text,
  completed boolean default false,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists follow_ups_org_due_idx on follow_ups (organization_id, completed, due_date);

alter table follow_ups enable row level security;

drop policy if exists "members read follow ups" on follow_ups;
create policy "members read follow ups"
  on follow_ups for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "members manage follow ups" on follow_ups;
create policy "members manage follow ups"
  on follow_ups for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));
