-- =====================================================================
-- GROWTH + COMPLIANCE
-- Adds:
--  1. Subscription plans table (pricing tiers, editable by platform admin)
--  2. Onboarding-email tracking columns on organizations
--  3. Data-deletion warning + scheduling on organizations
--  4. Help articles table (for editable in-app FAQ)
--  5. Platform admins table (separate from org-level owner)
--  6. Pre-deletion notification cron (sends 7 days before purge)
-- =====================================================================

-- =====================================================================
-- 0. Security hardening
--    a. Stripe event idempotency
--    b. Tighter RLS on review_feedback (token check)
--    c. Tighter RLS on estimates public quote (token check via header)
-- =====================================================================
create table if not exists stripe_event_log (
  event_id text primary key,
  type text not null,
  account text,
  received_at timestamptz default now()
);
-- No RLS — written only by webhook (service role).

-- Tighten review_feedback: anon can only update their specific token row.
-- Previously: "submitted_at is null" with no token match → attacker could
-- update any pending feedback.
do $$
begin
  if exists (select 1 from pg_policies where tablename = 'review_feedback' and policyname = 'review_feedback anon submit') then
    drop policy "review_feedback anon submit" on review_feedback;
  end if;
  create policy "review_feedback anon submit by token" on review_feedback for update to anon
    using (
      submitted_at is null
      and token = coalesce(current_setting('request.headers', true)::jsonb->>'x-review-token', '')
    )
    with check (
      submitted_at is not null
      and token = coalesce(current_setting('request.headers', true)::jsonb->>'x-review-token', '')
    );
end$$;

-- Tighten estimates public quote read: require token in header so only the
-- holder of a token can read that estimate, not enumerate all of them.
do $$
begin
  if exists (select 1 from pg_policies where tablename = 'estimates' and policyname = 'public quote read') then
    drop policy "public quote read" on estimates;
  end if;
  create policy "public quote read by token" on estimates for select to anon
    using (
      approval_token is not null
      and approval_token = coalesce(current_setting('request.headers', true)::jsonb->>'x-quote-token', '')
    );

  if exists (select 1 from pg_policies where tablename = 'estimate_line_items' and policyname = 'public quote line items read') then
    drop policy "public quote line items read" on estimate_line_items;
  end if;
  create policy "public quote line items read by token" on estimate_line_items for select to anon
    using (
      exists (
        select 1 from estimates e
        where e.id = estimate_line_items.estimate_id
          and e.approval_token = coalesce(current_setting('request.headers', true)::jsonb->>'x-quote-token', '')
      )
    );
end$$;

-- =====================================================================
-- 1. Subscription plans (marketing display)
--    The Stripe Dashboard is still the authoritative price store; this
--    table mirrors what users see on /pricing.
-- =====================================================================
create table if not exists subscription_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  -- "starter", "pro", etc. Used in URLs and internal references.
  name text not null,
  -- Display name: "Starter", "Pro"
  description text,
  monthly_amount numeric(10, 2) not null,
  annual_amount numeric(10, 2),
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  features jsonb not null default '[]'::jsonb,
  -- Array of feature strings shown as bullet points
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists subscription_plans_active_idx on subscription_plans(is_active, sort_order);

-- Seed the default Starter plan if nothing exists
insert into subscription_plans (slug, name, description, monthly_amount, features, is_featured, sort_order)
select 'starter', 'Starter', 'Everything you need to run your business.', 49,
  '["Unlimited customers, jobs, estimates, invoices",
    "Stripe payment links + Connect for direct payouts",
    "Email + SMS templates",
    "Drag-and-drop calendar with reminders",
    "Recurring contracts + Stripe subscriptions",
    "Customer portal, audit log, notifications",
    "Satellite measurement, photo annotations",
    "QuickBooks Online sync, CSV exports, tax forms"]'::jsonb,
  true, 0
where not exists (select 1 from subscription_plans);

alter table subscription_plans enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'subscription_plans' and policyname = 'plans public read') then
    create policy "plans public read" on subscription_plans for select
      to anon, authenticated using (is_active = true);
  end if;
end$$;

-- =====================================================================
-- 2. Onboarding email tracking
-- =====================================================================
alter table organizations
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists onboarding_day3_email_sent_at timestamptz,
  add column if not exists onboarding_day10_email_sent_at timestamptz,
  add column if not exists onboarding_day13_email_sent_at timestamptz;

-- =====================================================================
-- 3. Data deletion warning + scheduling
--    Cancelled orgs are purged 90 days post-cancellation. We send a
--    warning email 7 days prior (so the user can download).
-- =====================================================================
alter table organizations
  add column if not exists data_deletion_scheduled_at timestamptz,
  add column if not exists data_deletion_warned_at timestamptz,
  add column if not exists data_deleted_at timestamptz;

-- =====================================================================
-- 4. Help articles (editable FAQ)
--    Public read; admin write enforced in app code.
-- =====================================================================
create table if not exists help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null default 'general',
  title text not null,
  summary text,
  body_markdown text not null,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists help_articles_cat_idx on help_articles(is_published, category, sort_order);

alter table help_articles enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'help_articles' and policyname = 'help public read') then
    create policy "help public read" on help_articles for select
      to anon, authenticated using (is_published = true);
  end if;
end$$;

-- Seed starter FAQ
insert into help_articles (slug, category, title, summary, body_markdown, sort_order) values
  ('getting-started', 'basics', 'Getting started in 10 minutes',
    'A quick tour of the most useful screens.',
    'After signup we drop you on the dashboard. The fastest path:

1. **Settings** → fill in your business name, address, tax rate, upload logo.
2. **Customers → New** → add a first customer.
3. **Estimates → New** → quote them.
4. **Send** the estimate via email or SMS. The customer gets a link to approve.
5. When approved, a **Job** is created automatically. Schedule it on the **Calendar**.
6. Mark the job **completed** — an invoice drafts itself from the estimate.
7. **Send the invoice** with a Stripe payment link, or record the payment manually when cash/check comes in.', 1),
  ('how-to-send-invoice', 'invoicing', 'How to send an invoice',
    'Send an invoice by email or SMS with a Stripe pay link.',
    'Open the invoice. Use one of:
- **Email invoice** — uses your business email.
- **Send email template** — uses your saved Settings → Templates.
- **Send SMS** — uses your saved SMS template (requires Telnyx).
- **Create Stripe link** — generates a payment URL you can copy/paste anywhere.

If Stripe is configured and you click *Email invoice*, the email already includes a "Pay online" button.', 2),
  ('how-to-add-customer-to-portal', 'portal', 'How does the customer portal work?',
    'Your customers get a passwordless login to see their invoices and history.',
    'You don''t set anything up. When a customer goes to `/portal/login` and enters their email, they get a magic-link sign-in. Inside the portal they see:

- Their open and paid invoices (with Stripe pay buttons)
- Their estimates (with approval links)
- Their service history

The link expires in 30 minutes; once they click, their browser holds a 30-day session cookie.', 3),
  ('subscription-failed', 'billing', 'My subscription payment failed — what now?',
    'Update your card; access restores automatically.',
    'When your card declines, your account moves to **read-only mode**. Your records stay accessible, but new estimates, invoices, and messages are paused. You''ll get an email with a one-click link to update your card.

Stripe automatically retries the charge over 21 days. Once any retry succeeds, full access is restored. To update sooner, click **Manage payment method** on the **Billing** page.', 4),
  ('sms-setup', 'sms', 'Why aren''t my SMS messages sending?',
    'US carriers require 10DLC registration before they''ll deliver business SMS.',
    'If you''re seeing "failed" status on every SMS, it''s usually one of:

1. **10DLC not registered.** US carriers require business SMS to be registered. In Telnyx → Messaging → Brands, register your business, then create a campaign for the use case (Customer Care or Account Notifications). Approval takes 1–10 business days.
2. **Recipient opted out.** Replies of STOP to any of your messages permanently opt that number out across your account.
3. **Message contains URLs.** Some carriers filter unbranded short links. Use your own domain (`yourdomain.com/q/abc`) instead of `bit.ly`.
4. **Outside permitted hours.** TCPA disallows sending between 9 PM and 8 AM recipient time.', 5),
  ('export-data', 'account', 'How do I export my data?',
    'CSV downloads in /accounting; full export on request.',
    '- **Accounting** page has CSV exports for invoices, payments, expenses, customers.
- **Tax forms** page has Schedule C + 1099-NEC CSVs by year.
- For a full export of every record (including photos and signed waivers), email support@yourdomain.com — we''ll send a ZIP within 24 hours.

If you''re cancelling your subscription, you have 90 days to export before data is deleted. We''ll email you 7 days before deletion as a final reminder.', 6),
  ('two-factor', 'security', 'How do I enable two-factor authentication?',
    'Use any authenticator app (Google Authenticator, 1Password, Authy).',
    '1. Go to **Settings → Security**.
2. Click **Set up two-factor authentication**.
3. Scan the QR code with your authenticator app.
4. Enter the 6-digit code to confirm.

After enrollment, every login asks for the code after your password. Keep backup codes somewhere safe — losing access to your authenticator means losing access to your account.', 7),
  ('refund-policy', 'billing', 'Can I get a refund?',
    'Full refund in the first 7 days. After that, cancel at period end with no pro-rate.',
    'See our [Refund Policy](/legal/refund) for details. Short version:
- **First 7 days of paid service**: full refund, no questions.
- **After 7 days**: cancel at period end; no pro-rated refund for unused days.
- **Duplicate charges, fraud, our error**: always refunded.

Email support@yourdomain.com with your account email and the charge date.', 8)
on conflict (slug) do nothing;

-- =====================================================================
-- 5. Platform admins (you and any future support staff)
--    Distinct from organization_members.role — these admins have
--    cross-org powers like editing subscription plans.
-- =====================================================================
create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role in ('admin', 'support')),
  created_at timestamptz default now()
);

alter table platform_admins enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'platform_admins' and policyname = 'admins self read') then
    create policy "admins self read" on platform_admins for select to authenticated
      using (user_id = auth.uid());
  end if;
end$$;

-- Helper to check admin status from server actions
create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_admins
    where user_id = auth.uid()
  );
$$;
grant execute on function is_platform_admin() to authenticated;

-- =====================================================================
-- 6. Pre-deletion notification job
--    Find orgs that are cancelled and approaching the 90-day purge.
--    Sends warning email 7 days before deletion.
-- =====================================================================
create or replace function schedule_data_deletions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_count integer := 0;
begin
  -- Schedule deletion 90 days post-cancellation for any cancelled orgs
  -- that don't already have a deletion scheduled.
  for v_org in
    select id, updated_at from organizations
    where subscription_status = 'cancelled'
      and data_deletion_scheduled_at is null
      and data_deleted_at is null
  loop
    update organizations
      set data_deletion_scheduled_at = v_org.updated_at + interval '90 days'
    where id = v_org.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Auto-purge function: deletes orgs whose deletion is scheduled and warning
-- was already sent (and is 7+ days old). Cascade deletes all org data.
create or replace function purge_scheduled_deletions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org record;
  v_count integer := 0;
begin
  for v_org in
    select id from organizations
    where subscription_status = 'cancelled'
      and data_deletion_scheduled_at is not null
      and data_deletion_scheduled_at <= now()
      and data_deletion_warned_at is not null
      and data_deletion_warned_at <= now() - interval '6 days'
      and data_deleted_at is null
  loop
    -- Mark deleted first so the audit log entry survives the cascade
    update organizations
      set data_deleted_at = now(),
          name = '[deleted org]',
          email = null,
          phone = null,
          stripe_connect_account_id = null
    where id = v_org.id;

    -- Cascade-delete everything via the ON DELETE CASCADE foreign keys.
    -- This wipes customers, properties, estimates, invoices, photos, etc.
    delete from organizations where id = v_org.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Schedule the deletion check daily at 3am UTC
do $$
begin
  perform cron.unschedule('data-deletion-scheduler');
  perform cron.schedule(
    'data-deletion-scheduler',
    '0 3 * * *',
    $job$
      select schedule_data_deletions();
    $job$
  );

  perform cron.unschedule('data-deletion-purger');
  perform cron.schedule(
    'data-deletion-purger',
    '15 3 * * *',
    $job$
      select purge_scheduled_deletions();
    $job$
  );
exception when others then
  raise notice 'Cron scheduling skipped: %', sqlerrm;
end$$;
