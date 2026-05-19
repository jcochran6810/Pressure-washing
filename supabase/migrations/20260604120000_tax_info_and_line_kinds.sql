-- Tax info on organizations + labor/materials split + per-line tax toggle.
--
-- The setup wizard's business step now collects legal name + EIN + tax-id
-- type + state sales-tax id + business structure. We treat all of these as
-- optional in the schema — owners who are sole proprietors with no EIN
-- shouldn't be blocked.
--
-- For documents we want two things per the user's request:
--   1) Distinguish labor lines from material lines on every estimate /
--      invoice. We add a `kind` column on the line-item tables (default
--      'service' for back-compat) and roll up labor_subtotal and
--      materials_subtotal on the parent doc.
--   2) Per-line "charge tax" toggle. Existing flow applied one global
--      tax_rate to the whole subtotal; jurisdictions sometimes exempt
--      labor or tax materials at a different cadence. Each line now has
--      a `taxable` boolean (default true to preserve old behaviour) and
--      the doc-level tax_amount is computed as tax_rate × sum(taxable
--      line totals) — stored in taxable_subtotal so we don't have to
--      recompute it from rows on read.
-- services.default_kind / default_taxable let the catalog seed the
-- right values when an owner picks "House wash" → labor, "Bleach
-- gallon" → material, etc.

alter table organizations
  add column if not exists legal_business_name text,
  add column if not exists tax_id text,
  add column if not exists tax_id_type text check (tax_id_type in ('EIN','SSN','ITIN','none')),
  add column if not exists state_tax_id text,
  add column if not exists business_structure text check (business_structure in (
    'sole_prop','llc','scorp','ccorp','partnership','nonprofit','other'
  )),
  add column if not exists tax_year_start_month smallint default 1
    check (tax_year_start_month between 1 and 12);

-- Line-item kind + per-line taxable. Default 'service' / true so every
-- existing row stays mathematically identical to before this migration.
alter table estimate_line_items
  add column if not exists kind text not null default 'service'
    check (kind in ('labor','material','service','other')),
  add column if not exists taxable boolean not null default true;

alter table invoice_line_items
  add column if not exists kind text not null default 'service'
    check (kind in ('labor','material','service','other')),
  add column if not exists taxable boolean not null default true;

-- Doc-level rollups. Stored (not computed-on-read) so the totals on
-- the list page don't need a join + sum to render. The actions code
-- recomputes them on insert/update.
alter table estimates
  add column if not exists labor_subtotal numeric default 0,
  add column if not exists materials_subtotal numeric default 0,
  add column if not exists taxable_subtotal numeric default 0;

alter table invoices
  add column if not exists labor_subtotal numeric default 0,
  add column if not exists materials_subtotal numeric default 0,
  add column if not exists taxable_subtotal numeric default 0;

-- Service catalog defaults. When a user picks a service from the
-- dropdown in the line-item editor, we read these to pre-fill the row.
alter table services
  add column if not exists default_kind text default 'service'
    check (default_kind in ('labor','material','service','other')),
  add column if not exists default_taxable boolean default true;

-- Backfill rollups on existing docs so the new columns aren't all 0.
-- Old rows all have taxable=true and kind='service', so labor and
-- materials stay 0 and taxable_subtotal equals subtotal.
update estimates
   set taxable_subtotal = coalesce(subtotal, 0)
 where taxable_subtotal = 0 and coalesce(subtotal, 0) <> 0;

update invoices
   set taxable_subtotal = coalesce(subtotal, 0)
 where taxable_subtotal = 0 and coalesce(subtotal, 0) <> 0;
