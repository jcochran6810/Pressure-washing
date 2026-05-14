-- Multi-trade pivot Phase 1 + subscription tiers + messaging mode
--
-- Adds the foundational columns and lookup table for converting the
-- pressure-washing app into a multi-trade home services platform. Existing
-- orgs default to 'pressure_washing' so behavior is unchanged.

alter table organizations
  add column if not exists subscription_tier text default 'solo' not null,
  add column if not exists business_type_id text default 'pressure_washing' not null;

alter table org_messaging_credentials
  add column if not exists messaging_mode text default 'platform' not null;

create table if not exists business_types (
  id text primary key,
  name text not null,
  description text,
  icon text,
  sort_order int default 100,
  active boolean default true,
  created_at timestamptz default now()
);

alter table business_types enable row level security;

drop policy if exists "everyone can read business types" on business_types;
create policy "everyone can read business types"
  on business_types for select
  using (true);

insert into business_types (id, name, description, icon, sort_order) values
  ('pressure_washing',  'Pressure Washing',          'Driveways, houses, decks, soft wash.',                'spray',     10),
  ('lawn_care',         'Lawn Care',                 'Mowing, edging, trimming, leaf cleanup.',             'leaf',      20),
  ('landscaping',       'Landscaping',               'Beds, mulch, plant install, seasonal color.',         'tree',      30),
  ('house_cleaning',    'House Cleaning',            'Standard, deep, move in/out, recurring.',             'sparkles',  40),
  ('window_cleaning',   'Window Cleaning',           'Interior + exterior, screens, hard water.',           'window',    50),
  ('gutter_cleaning',   'Gutter Cleaning',           'Cleaning, brightening, guards, repair.',              'gutter',    60),
  ('painting',          'Painting & Staining',       'Interior, exterior, trim, fence, deck.',              'brush',     70),
  ('handyman',          'Handyman',                  'Drywall, doors, mounting, small repairs.',            'wrench',    80),
  ('hvac',              'HVAC',                      'Diagnostic, repair, maintenance, install.',           'thermo',    90),
  ('plumbing',          'Plumbing',                  'Leaks, drains, fixtures, water heaters.',             'droplet',  100),
  ('electrical',        'Electrical',                'Outlets, switches, fixtures, panels.',                'bolt',     110),
  ('pool_service',      'Pool Service',              'Weekly cleaning, chemicals, pump, opening.',          'pool',     120),
  ('pest_control',      'Pest Control',              'Treatments, recurring plans, inspections.',           'bug',      130),
  ('junk_removal',      'Junk Removal',              'Single items, cleanouts, hauling, dump.',             'truck',    140),
  ('carpet_cleaning',   'Carpet Cleaning',           'Carpet, upholstery, rugs, tile + grout.',             'rug',      150),
  ('mobile_detailing',  'Mobile Detailing',          'Wash, interior, wax, ceramic, headlights.',           'car',      160),
  ('roofing',           'Roofing',                   'Inspection, repair, shingle, storm, replace.',        'roof',     170),
  ('appliance_repair',  'Appliance Repair',          'Washer/dryer, fridge, dishwasher, oven.',             'appliance',180),
  ('dryer_vent',        'Dryer Vent Cleaning',       'Cleaning, inspection, bird nests, ducts.',            'vent',     190),
  ('holiday_lights',    'Holiday Light Installation','Roofline, trees, wreaths, install + removal.',        'star',     200),
  ('general_home',      'General Home Services',     'Multi-trade or maintenance handyman work.',           'home',     210)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
