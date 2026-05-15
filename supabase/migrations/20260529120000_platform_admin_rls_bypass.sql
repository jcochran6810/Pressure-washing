-- Platform admins can read every org's data so impersonation + cross-org
-- views work without service-role keys. Mutations still flow through the
-- admin actions API (audited).

create or replace function is_platform_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

do $$
declare
  t text;
  tables text[] := array[
    'organizations','organization_members','profiles','customers','properties',
    'estimates','estimate_line_items','invoices','invoice_line_items','jobs',
    'payments','expenses','expense_categories','services','leads','lead_sources',
    'chemicals','chemical_transactions','equipment','recurring_jobs','follow_ups',
    'email_log','customer_messaging_prefs',
    'google_drive_connections','org_messaging_credentials','customer_reminders',
    'campaigns','custom_fields','custom_field_values','job_assignments',
    'measurements','photo_attachments','receipt_log','review_feedback',
    'chemical_recipes','business_types','public_galleries'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "platform admin read" on %I', t);
    execute format('create policy "platform admin read" on %I for select using (is_platform_admin())', t);
  end loop;
end $$;
