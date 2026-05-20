-- Materials cost on line items + timezone + cancel-at-period-end on trades.
-- All columns are nullable / defaulted so the migration is safe to apply on
-- an already-populated database without breaking existing reads.

-- 1) Materials cost per line item ----------------------------------------
alter table if exists estimate_line_items
  add column if not exists materials_cost numeric(12, 2) default 0,
  add column if not exists materials_description text;

alter table if exists invoice_line_items
  add column if not exists materials_cost numeric(12, 2) default 0,
  add column if not exists materials_description text;

-- 2) Per-org timezone ----------------------------------------------------
alter table if exists organizations
  add column if not exists timezone text default 'America/New_York',
  add column if not exists billing_period_end timestamptz;

-- 3) Trade add-on lifecycle: keep the join row but mark it as
-- "cancelled, ride out the month" so the operator retains access to the
-- trade's services + custom fields until billing_period_end, after which
-- a cron / manual sweep removes the row.
alter table if exists organization_business_types
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists added_at timestamptz default now(),
  add column if not exists drops_at timestamptz;
