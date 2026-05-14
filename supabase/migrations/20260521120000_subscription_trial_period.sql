-- Subscription pricing/trial overhaul
--
-- Tiers move from {free, solo, pro} to {basic, plus, pro} at $5/$15/$45.
-- Every org gets a 10-day free trial — Stripe also enforces it via
-- trial_period_days on checkout for picked tiers. trial_ends_at is the
-- single source of truth for "is this org still in their free window".

alter table organizations
  add column if not exists trial_ends_at timestamptz;

update organizations
   set subscription_tier = 'basic'
 where subscription_tier in ('free', 'solo');

alter table organizations
  alter column subscription_tier set default 'basic';

update organizations
   set trial_ends_at = case
        when coalesce(created_at, now()) + interval '10 days' > now()
          then coalesce(created_at, now()) + interval '10 days'
        else now() + interval '10 days'
      end
 where trial_ends_at is null;

alter table organizations
  alter column trial_ends_at set default (now() + interval '10 days');

comment on column organizations.trial_ends_at is
  '10-day free trial window. Access is granted while now() < trial_ends_at OR subscription_status = ''active''.';
