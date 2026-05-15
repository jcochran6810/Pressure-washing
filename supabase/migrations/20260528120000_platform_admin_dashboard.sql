-- Platform admin dashboard tables:
--   * platform_admins   — who can access /admin
--   * admin_actions     — audit log of every admin operation
--   * app_errors        — runtime error log surfaced in the dashboard
--   * organizations.disabled_at — flag to suspend abusive accounts

create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  notes text
);

alter table platform_admins enable row level security;

drop policy if exists "admins read" on platform_admins;
create policy "admins read"
  on platform_admins for select
  using (auth.uid() in (select user_id from platform_admins));

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete set null,
  action text not null,
  target_kind text,
  target_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table admin_actions enable row level security;

drop policy if exists "admins read actions" on admin_actions;
create policy "admins read actions"
  on admin_actions for select
  using (auth.uid() in (select user_id from platform_admins));

drop policy if exists "admins insert actions" on admin_actions;
create policy "admins insert actions"
  on admin_actions for insert
  with check (auth.uid() in (select user_id from platform_admins));

create index if not exists admin_actions_created_idx on admin_actions(created_at desc);
create index if not exists admin_actions_target_idx on admin_actions(target_kind, target_id);

create table if not exists app_errors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  route text,
  message text not null,
  stack text,
  severity text default 'error' check (severity in ('warn','error','fatal')),
  context jsonb,
  created_at timestamptz not null default now()
);

alter table app_errors enable row level security;

drop policy if exists "admins read errors" on app_errors;
create policy "admins read errors"
  on app_errors for select
  using (auth.uid() in (select user_id from platform_admins));

drop policy if exists "authenticated log errors" on app_errors;
create policy "authenticated log errors"
  on app_errors for insert
  with check (auth.uid() is not null);

create index if not exists app_errors_created_idx on app_errors(created_at desc);
create index if not exists app_errors_severity_idx on app_errors(severity, created_at desc);

alter table organizations
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text;

insert into platform_admins (user_id, granted_by, notes)
values ('4d195401-67c9-4891-a8fe-ff108f18b7db', '4d195401-67c9-4891-a8fe-ff108f18b7db', 'bootstrap')
on conflict (user_id) do nothing;
