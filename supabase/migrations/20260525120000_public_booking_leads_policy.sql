-- Public booking widget at /book/<slug> writes to leads anonymously. Allow
-- INSERT only when organization_id corresponds to an org that has published a
-- slug (i.e., opted into the public booking page). Honeypot + future rate
-- limiting handle abuse.

drop policy if exists "public insert lead via booking" on leads;
create policy "public insert lead via booking"
  on leads for insert
  with check (
    organization_id in (select id from organizations where slug is not null)
    and status = 'new'
  );
