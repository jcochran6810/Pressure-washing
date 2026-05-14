-- Phase 8: subscription billing + usage tracking
--
-- Stripe customer / subscription IDs live on organizations so we can recognise
-- webhook events and route the customer portal. email_log mirrors sms_log so
-- platform-tier sends can be metered against tier quotas.

alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  to_email text not null,
  subject text,
  provider text default 'resend',
  provider_id text,
  status text default 'sent',
  error text,
  related_kind text,
  related_id uuid,
  sent_at timestamptz default now()
);

create index if not exists email_log_org_month_idx
  on email_log (organization_id, sent_at);

alter table email_log enable row level security;

drop policy if exists "members read email log" on email_log;
create policy "members read email log"
  on email_log for select
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));
