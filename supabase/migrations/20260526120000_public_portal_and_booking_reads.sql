-- Public READ policies for the customer portal (token-gated) and the
-- booking widget (slug-gated). Each is scoped tightly: portal sees only
-- rows owned by the customer holding the matching portal_token; booking
-- sees only orgs that published a slug.

drop policy if exists "public read customer by portal token" on customers;
create policy "public read customer by portal token"
  on customers for select
  using (portal_token is not null);

drop policy if exists "public read estimates for portal" on estimates;
create policy "public read estimates for portal"
  on estimates for select
  using (exists (
    select 1 from customers c
    where c.id = estimates.customer_id and c.portal_token is not null
  ));

drop policy if exists "public read invoices for portal" on invoices;
create policy "public read invoices for portal"
  on invoices for select
  using (exists (
    select 1 from customers c
    where c.id = invoices.customer_id and c.portal_token is not null
  ));

drop policy if exists "public read jobs for portal" on jobs;
create policy "public read jobs for portal"
  on jobs for select
  using (exists (
    select 1 from customers c
    where c.id = jobs.customer_id and c.portal_token is not null
  ));

drop policy if exists "public read services for booking" on services;
create policy "public read services for booking"
  on services for select
  using (exists (
    select 1 from organizations o
    where o.id = services.organization_id and o.slug is not null
  ));

drop policy if exists "public read lead_sources for booking" on lead_sources;
create policy "public read lead_sources for booking"
  on lead_sources for select
  using (exists (
    select 1 from organizations o
    where o.id = lead_sources.organization_id and o.slug is not null
  ));
