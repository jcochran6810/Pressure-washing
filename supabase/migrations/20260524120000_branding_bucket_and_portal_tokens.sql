-- Phase 1-2 prep:
--   * branding storage bucket for logos (public read, members write)
--   * portal_token on customers for the customer portal magic-link login
--   * org slug for the public booking widget URL

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "branding public read" on storage.objects;
create policy "branding public read"
  on storage.objects for select
  using (bucket_id = 'branding');

drop policy if exists "branding members write" on storage.objects;
create policy "branding members write"
  on storage.objects for insert
  with check (
    bucket_id = 'branding'
    and (split_part(name, '/', 1))::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "branding members update" on storage.objects;
create policy "branding members update"
  on storage.objects for update
  using (
    bucket_id = 'branding'
    and (split_part(name, '/', 1))::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

drop policy if exists "branding members delete" on storage.objects;
create policy "branding members delete"
  on storage.objects for delete
  using (
    bucket_id = 'branding'
    and (split_part(name, '/', 1))::uuid in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

alter table customers
  add column if not exists portal_token text unique default gen_random_uuid()::text;

update customers set portal_token = gen_random_uuid()::text where portal_token is null;

alter table organizations
  add column if not exists slug text unique;

update organizations
   set slug = lower(regexp_replace(coalesce(name, 'org-' || left(id::text, 8)), '[^a-z0-9]+', '-', 'g'))
 where slug is null;

drop policy if exists "public read org public profile" on organizations;
create policy "public read org public profile"
  on organizations for select
  using (slug is not null);
