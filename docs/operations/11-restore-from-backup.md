# Restoring from an off-site backup

The weekly GitHub Action drops an encrypted SQL dump into Backblaze B2 every Sunday. This document explains how to restore one when needed.

## When you'd do this

- **Supabase project is gone or locked** (rare, but: billing dispute, account compromise, total catastrophe). Supabase's own PITR is gone too in that scenario.
- **Catastrophic data corruption** that PITR can't fix.
- **Legal request** for a point-in-time historical snapshot from > 7 days ago (PITR's retention window on the Pro plan).

For most "I deleted the wrong row" problems, **Supabase PITR is faster** — restore within the last 7 days from the dashboard. Use these off-site backups only when PITR isn't an option.

## What you need before the disaster

1. **`BACKUP_ENCRYPTION_KEY`** stored in 1Password / Bitwarden. Without it, the encrypted dumps are useless. **Confirm you have this key before you need it.**
2. **B2 keys** stored alongside the encryption key.
3. **A test restore done at least once.** A backup you've never restored from is not a backup.

## Restore procedure

```bash
# 1. Pick which dump to restore (latest, or a specific date)
b2 authorize-account "$B2_KEY_ID" "$B2_APP_KEY"
b2 ls --recursive "$B2_BUCKET" db-backups/

# 2. Download the encrypted file
b2 download-file-by-name "$B2_BUCKET" "db-backups/suds-2026-10-01.sql.gz.enc" /tmp/restore.sql.gz.enc

# 3. Decrypt
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in /tmp/restore.sql.gz.enc \
  -out /tmp/restore.sql.gz \
  -pass env:BACKUP_ENCRYPTION_KEY

# 4. Inspect
gunzip /tmp/restore.sql.gz
head -50 /tmp/restore.sql

# 5. Create a fresh Supabase project (in the dashboard)
#    or wipe an existing staging project. NEVER restore over production
#    without explicit confirmation — restoring is destructive.

# 6. Get the new project's connection string
#    Supabase Dashboard → Settings → Database → Connection string → URI

# 7. Restore
psql "postgresql://...?sslmode=require" < /tmp/restore.sql

# 8. Verify
psql "postgresql://...?sslmode=require" -c "select count(*) from customers;"
```

## Switching production over to the restored database

If you're recovering from a destroyed project:

1. Update Vercel env vars:
   - `NEXT_PUBLIC_SUPABASE_URL` → new project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → new project key
   - `SUPABASE_SERVICE_ROLE_KEY` → new project's service role
2. Redeploy.
3. Reconfigure Stripe webhook URL (no change needed if domain is same).
4. Re-enable cron in Supabase → Database → Extensions → pg_cron / pg_net.
5. Re-set `app_config` for cron callbacks.
6. Run a smoke test as a user.
7. Communicate the outage to customers.

## Caveats

- **Storage buckets are NOT in the SQL dump.** Photos, signatures, receipts, logos. If you also need those restored, set up a separate `rclone` job that syncs the Supabase storage buckets to B2 weekly. Not implemented by default.
- **Auth users live in `auth.users`** which IS included in pg_dump by default. Restored users keep their original IDs, so RLS relations work. Passwords are hashed; users can keep using them.
- **Stripe data lives at Stripe**, not in your database. Restoring resyncs the customer & subscription IDs you have stored. You don't lose subscription history from a DB restore.
- **Encryption key loss = backup loss.** Print it on paper. Lock it in a safe. Tell your lawyer.

## Annual fire drill

Put a calendar reminder for the same week each year:
- Pick a recent dump
- Restore into a throwaway Supabase project
- Verify key tables have data
- Document elapsed time
- Update this doc if anything changed
- Tear down the test project
