drop policy if exists "admins read" on platform_admins;
create policy "admins read"
  on platform_admins for select
  using (auth.uid() = user_id or is_platform_admin());
