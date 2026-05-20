-- Setup wizard + nine additional trades.
--
-- A new user creates an account, then the wizard guides them through:
--   business → trades → tier → addons → billing → messaging → finish.
-- The current step lives on organizations so it survives a tab close.
-- onboarding_completed_at gets stamped at the end so middleware stops
-- redirecting them. onboarding_data is a scratch jsonb the wizard uses
-- for between-step state (selected tier draft, pending Stripe session,
-- pending sender email pre-verify, requested SMS area code, etc.).

alter table organizations
  add column if not exists onboarding_step text default 'business',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb;

-- Existing orgs already finished setup the old way — mark them complete
-- so the new middleware redirect doesn't trap them at /onboarding.
update organizations
   set onboarding_completed_at = coalesce(onboarding_completed_at, created_at, now()),
       onboarding_step = null
 where onboarding_completed_at is null;

-- Rewrite the new-user trigger. The old version unconditionally seeded
-- pressure-washing services, soft-wash chemicals and PW-flavoured lead
-- sources for every signup, no matter what trade they actually ran. The
-- wizard now collects trades first; service/chemical seeding happens at
-- the finish step using the per-trade defaults in src/lib/trade-defaults.ts.
-- Expense categories stay because they're universal across all trades.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name, onboarding_step)
    values (
      coalesce(new.raw_user_meta_data->>'company_name', 'My Business'),
      'business'
    )
    returning id into new_org_id;

  insert into profiles (id, full_name, default_organization_id)
    values (new.id, new.raw_user_meta_data->>'full_name', new_org_id);

  insert into organization_members (organization_id, user_id, role)
    values (new_org_id, new.id, 'owner');

  -- Universal expense categories — every trade has fuel, equipment,
  -- insurance, etc. These are safe to seed before trade selection.
  insert into expense_categories (organization_id, name) values
    (new_org_id, 'Fuel'),
    (new_org_id, 'Equipment'),
    (new_org_id, 'Vehicle'),
    (new_org_id, 'Insurance'),
    (new_org_id, 'Advertising'),
    (new_org_id, 'Payroll'),
    (new_org_id, 'Office'),
    (new_org_id, 'Repairs & Maintenance'),
    (new_org_id, 'Materials');

  -- Universal lead sources. No PW-specific entries here anymore.
  insert into lead_sources (organization_id, name) values
    (new_org_id, 'Google'),
    (new_org_id, 'Facebook'),
    (new_org_id, 'Referral'),
    (new_org_id, 'Yard Sign'),
    (new_org_id, 'Repeat Customer'),
    (new_org_id, 'Nextdoor');

  return new;
end;
$$;

-- Nine additional trades. Same id format / sort_order banding as the
-- original 21 so the picker stays sorted.
insert into business_types (id, name, description, icon, sort_order) values
  ('tree_service',    'Tree Service',           'Trimming, removal, stump grinding, emergency.',         'tree',     220),
  ('fencing',         'Fencing',                'Install + repair: wood, vinyl, chain link.',            'fence',    230),
  ('snow_removal',    'Snow Removal',           'Plowing, shoveling, salting, seasonal contracts.',      'snow',     240),
  ('garage_door',     'Garage Door',            'Repair, install, spring + opener.',                     'garage',   250),
  ('concrete',        'Concrete & Masonry',     'Driveways, patios, sidewalks, repair.',                 'concrete', 260),
  ('irrigation',      'Irrigation & Sprinklers','Install, blowouts, repairs.',                           'sprinkler',270),
  ('epoxy_flooring',  'Epoxy / Floor Coating',  'Garage, basement, polished concrete coatings.',         'shine',    280),
  ('solar_install',   'Solar Install',          'Panel install, service, repair.',                       'sun',      290),
  ('chimney_sweep',   'Chimney Sweep',          'Sweep, inspection, repair, cap install.',               'chimney',  300)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
