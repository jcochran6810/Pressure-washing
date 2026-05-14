-- Pro-tier add-on quota packs
--
-- Each pack adds +5,000 platform emails and +1,500 SMS to the Pro tier base.
-- Synced from Stripe subscription items via the billing webhook (matches the
-- STRIPE_PRICE_ID_PRO_ADDON line item's quantity). Only meaningful on Pro.

alter table organizations
  add column if not exists quota_addons int not null default 0;

comment on column organizations.quota_addons is
  'Number of active Pro-tier quota add-on packs (+5,000 email / +1,500 SMS each).';
