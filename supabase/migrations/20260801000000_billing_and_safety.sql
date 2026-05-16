-- =====================================================================
-- SAAS BILLING + OPERATIONAL SAFETY NETS
-- Adds:
--   1. SaaS subscription columns on organizations (you billing your customers)
--   2. pg_cron + pg_net to back up Vercel cron jobs in case Vercel misses
--   3. Audit log retention (auto-cleanup of entries > 2 years old)
--   4. Atomic claim on reminder processing to prevent duplicate sends
--      when Vercel cron and Supabase cron overlap.
-- =====================================================================

-- =====================================================================
-- 1. Subscription tracking on organizations (the SaaS layer)
-- =====================================================================
alter table organizations
  add column if not exists subscription_plan text default 'starter',
  add column if not exists subscription_status text default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled')),
  add column if not exists subscription_stripe_id text,
  add column if not exists subscription_customer_id text,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists past_due_since timestamptz,
  add column if not exists past_due_notified_at timestamptz;

-- Existing orgs (and new ones) get a 14-day trial.
update organizations set trial_ends_at = coalesce(trial_ends_at, created_at + interval '14 days')
  where trial_ends_at is null;

-- Update handle_new_user to set trial_ends_at on new orgs.
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

  insert into organizations (name, email, trial_ends_at, subscription_status)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', v_full_name || '''s Business'),
    v_email,
    now() + interval '14 days',
    'trialing'
  )
  returning id into v_org_id;

  insert into profiles (id, full_name, default_organization_id)
  values (new.id, v_full_name, v_org_id);

  insert into organization_members (organization_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  insert into services (organization_id, name, description, pricing_unit, default_price) values
    (v_org_id, 'House Wash', 'Full exterior soft wash', 'flat', 350),
    (v_org_id, 'Driveway Cleaning', 'Concrete driveway + walkway cleaning', 'sqft', 0.15),
    (v_org_id, 'Roof Wash (Soft)', 'Asphalt/tile roof soft wash', 'sqft', 0.35),
    (v_org_id, 'Deck/Fence Cleaning', 'Wood deck or fence cleaning', 'sqft', 0.85),
    (v_org_id, 'Concrete Sealing', 'Concrete seal + protect', 'sqft', 0.65),
    (v_org_id, 'Gutter Cleaning', 'Gutter + downspout cleaning', 'linear_ft', 1.75);

  insert into expense_categories (organization_id, name) values
    (v_org_id, 'Chemicals'),
    (v_org_id, 'Fuel'),
    (v_org_id, 'Equipment'),
    (v_org_id, 'Vehicle/Insurance'),
    (v_org_id, 'Marketing'),
    (v_org_id, 'Office/Software'),
    (v_org_id, 'Labor'),
    (v_org_id, 'Other');

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

-- =====================================================================
-- 2. Atomic reminder claim: stop duplicate sends when both Vercel and
--    Supabase cron run concurrently. Set status='processing' before send,
--    only transition 'scheduled' -> 'processing' atomically.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname like '%customer_reminders_status_check%'
      and pg_get_constraintdef(oid) like '%processing%'
  ) then
    -- Drop and recreate the check constraint to include 'processing'
    alter table customer_reminders drop constraint if exists customer_reminders_status_check;
    alter table customer_reminders add constraint customer_reminders_status_check
      check (status in ('scheduled', 'processing', 'sent', 'failed', 'cancelled'));
  end if;
end$$;

-- Helper RPC: claim up to N due reminders for processing (skip locked rows so
-- two concurrent crons don't fight). Returns the claimed rows.
create or replace function claim_due_reminders(p_limit integer default 50)
returns setof customer_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update customer_reminders
    set status = 'processing'
    where id in (
      select id from customer_reminders
      where status = 'scheduled'
        and scheduled_for <= now()
      order by scheduled_for
      limit p_limit
      for update skip locked
    )
    returning *;
end;
$$;

grant execute on function claim_due_reminders(integer) to anon, authenticated, service_role;

-- =====================================================================
-- 3. Audit log retention — keep ~2 years (730 days) of history.
--    Long enough for any compliance + dispute resolution; short enough
--    that the table doesn't grow unbounded.
-- =====================================================================
create or replace function purge_old_audit_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from audit_log where created_at < now() - interval '730 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Also purge abandoned drafts (> 30 days old, never converted to real entity)
create or replace function purge_old_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from drafts where updated_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Also purge expired portal sessions (already past expires_at + 7 days)
create or replace function purge_expired_portal_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from customer_portal_sessions where expires_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =====================================================================
-- 4. pg_cron + pg_net for Vercel cron backup
--    Vercel cron is "best effort" — if it misses, these jobs catch up.
--    All cron jobs share an idempotency check (status='scheduled')
--    so running both Vercel and Supabase cron is safe.
-- =====================================================================
-- pg_cron must be enabled in Supabase Dashboard → Database → Extensions
-- pg_net (HTTP from Postgres) likewise. If they're not enabled, the
-- CREATE EXTENSION calls below will fail — enable them via dashboard.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cron jobs need to know the app URL + cron secret. We stash those in
-- a tiny config table so the migration is portable (no hardcoded URLs).
create table if not exists app_config (
  key text primary key,
  value text not null
);

-- Seed defaults — admin must update via Supabase dashboard or psql:
--   update app_config set value='https://yourdomain.com' where key='app_url';
--   update app_config set value='your-cron-secret' where key='cron_secret';
insert into app_config (key, value) values
  ('app_url', ''),
  ('cron_secret', '')
on conflict (key) do nothing;

-- Schedule the reminders backup — runs every 3 hours, offset from Vercel's
-- every-2-hours so they don't collide. Idempotent via atomic claim.
do $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from app_config where key = 'app_url';
  select value into v_secret from app_config where key = 'cron_secret';

  -- Only schedule if we have a URL configured
  if v_url is not null and v_url != '' then
    -- Reminders: every 3 hours
    perform cron.unschedule('reminders-backup');
    perform cron.schedule(
      'reminders-backup',
      '17 */3 * * *',
      format($job$
        select net.http_post(
          url := '%s/api/cron/reminders',
          headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'),
          body := '{}'::jsonb
        );
      $job$, v_url, v_secret)
    );

    -- Contracts: once daily at 09:13 UTC (Vercel runs at 08:00)
    perform cron.unschedule('contracts-backup');
    perform cron.schedule(
      'contracts-backup',
      '13 9 * * *',
      format($job$
        select net.http_post(
          url := '%s/api/cron/contracts',
          headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'),
          body := '{}'::jsonb
        );
      $job$, v_url, v_secret)
    );
  end if;

exception when others then
  -- Don't fail the migration if cron extension isn't enabled yet
  raise notice 'Cron scheduling skipped: %', sqlerrm;
end$$;

-- Maintenance jobs — direct SQL, no HTTP needed.
-- Sunday 02:00 UTC: purge old audit logs, drafts, portal sessions.
do $$
begin
  perform cron.unschedule('weekly-maintenance');
  perform cron.schedule(
    'weekly-maintenance',
    '0 2 * * 0',
    $job$
      select purge_old_audit_logs();
      select purge_old_drafts();
      select purge_expired_portal_sessions();
    $job$
  );
exception when others then
  raise notice 'Maintenance scheduling skipped: %', sqlerrm;
end$$;

-- =====================================================================
-- 5. Cron run audit table — track every backup-cron invocation so you can
--    see in /audit when the safety net was needed.
-- =====================================================================
create table if not exists cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  source text not null check (source in ('vercel', 'supabase', 'manual')),
  succeeded boolean not null default true,
  result jsonb,
  error text,
  ran_at timestamptz default now()
);
create index if not exists cron_runs_recent_idx on cron_runs(job_name, ran_at desc);

alter table cron_runs enable row level security;
-- Cron logs are visible to all members of every org (no org_id, system-wide)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'cron_runs' and policyname = 'cron_runs all members') then
    create policy "cron_runs all members" on cron_runs for select to authenticated using (true);
  end if;
end$$;
