create or replace function admin_table_sizes()
returns table(table_name text, size_bytes bigint, row_estimate bigint)
language sql security definer set search_path = public, pg_catalog
as $$
  select
    c.relname::text as table_name,
    pg_total_relation_size(c.oid) as size_bytes,
    coalesce(c.reltuples::bigint, 0) as row_estimate
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc;
$$;

revoke all on function admin_table_sizes() from public;
grant execute on function admin_table_sizes() to authenticated;

create or replace function admin_table_sizes_check()
returns table(table_name text, size_bytes bigint, row_estimate bigint)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from platform_admins where user_id = auth.uid()) then
    raise exception 'forbidden';
  end if;
  return query select * from admin_table_sizes();
end;
$$;

grant execute on function admin_table_sizes_check() to authenticated;
