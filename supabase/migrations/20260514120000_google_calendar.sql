-- Google Calendar integration: add columns to track which calendar is linked.
-- Same OAuth connection (refresh_token) is used; the user just picks which of
-- their calendars the app should read events from.

alter table google_drive_connections
  add column if not exists calendar_id text,
  add column if not exists calendar_name text;
