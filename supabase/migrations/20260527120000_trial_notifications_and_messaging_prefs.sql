-- Phase 3 prep:
--   * Track which trial-lifecycle emails we've sent so the cron is idempotent.
--   * Customer messaging prefs for unsubscribe handling.

alter table organizations
  add column if not exists trial_reminder_7d_at timestamptz,
  add column if not exists trial_reminder_1d_at timestamptz,
  add column if not exists trial_expired_email_at timestamptz;

create table if not exists customer_messaging_prefs (
  customer_id uuid primary key references customers(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  email_opt_out boolean not null default false,
  sms_opt_out boolean not null default false,
  email_opt_out_reason text,
  sms_opt_out_reason text,
  updated_at timestamptz default now()
);

alter table customer_messaging_prefs enable row level security;

drop policy if exists "members read messaging prefs" on customer_messaging_prefs;
create policy "members read messaging prefs"
  on customer_messaging_prefs for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "members write messaging prefs" on customer_messaging_prefs;
create policy "members write messaging prefs"
  on customer_messaging_prefs for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

drop policy if exists "public read prefs by portal token" on customer_messaging_prefs;
create policy "public read prefs by portal token"
  on customer_messaging_prefs for select
  using (exists (select 1 from customers c where c.id = customer_messaging_prefs.customer_id and c.portal_token is not null));

drop policy if exists "public update prefs by portal token" on customer_messaging_prefs;
create policy "public update prefs by portal token"
  on customer_messaging_prefs for update
  using (exists (select 1 from customers c where c.id = customer_messaging_prefs.customer_id and c.portal_token is not null));

drop policy if exists "public insert prefs by portal token" on customer_messaging_prefs;
create policy "public insert prefs by portal token"
  on customer_messaging_prefs for insert
  with check (exists (select 1 from customers c where c.id = customer_messaging_prefs.customer_id and c.portal_token is not null));
