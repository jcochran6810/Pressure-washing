# Database backups & data protection

## Supabase&apos;s automatic backups

| Plan | Backup type | Retention | Granularity |
| --- | --- | --- | --- |
| **Free** | Daily snapshot | 1 day (latest only) | Day-level |
| **Pro** | Daily snapshot + PITR | 7 days | Up to the second |
| **Team** | PITR | 14 days | Up to the second |

**PITR = Point-In-Time Recovery.** You can restore the database to any second
in the past N days. Critical for "oh no I just deleted everything" moments.

**As soon as you go live, upgrade Supabase to Pro ($25/mo).** Don&apos;t skip this
step. Free tier is one daily snapshot only.

## Manual backups

In addition to Supabase&apos;s automatic backups, take manual snapshots before
big changes:

1. Supabase Dashboard → Database → Backups → "Create snapshot now."
2. Label it: "Pre-migration-005-billing", etc.
3. Manual snapshots cost $0 to create. Storage is included.

When to take a manual backup:
- Before any migration
- Before bulk data operations (deletes, mass updates)
- Before major architectural changes

## Restoring from backup

### PITR (Pro plan)

Supabase Dashboard → Database → Backups → "Restore" → choose a timestamp.

This creates a new Supabase project with the data at that point. You then:
1. Switch your env vars to point at the new project.
2. Verify data is correct.
3. Run a smoke test.
4. (Eventually) delete the old project.

This takes ~5–15 minutes depending on DB size. Plan for downtime during restore.

### Restoring a single table or row

If you only need to recover a few rows (e.g., user deleted a customer by accident):

1. Spin up a temporary restored database from PITR.
2. Connect to it via psql.
3. `pg_dump --table customers --data-only -t customers > customers_at_restore.sql`
4. Extract just the rows you need.
5. Insert them back into production.
6. Tear down the temporary database.

This is fiddly. Document it once you&apos;ve done it the first time.

## Off-site backups (additional layer)

Supabase backups live in Supabase&apos;s infrastructure. For extra safety against
"Supabase as a company has a catastrophic failure" (low-probability but
high-impact), set up weekly off-site backups:

### Weekly logical backup to S3 / Backblaze

1. Sign up for Backblaze B2 ($0.005/GB/mo — cheap).
2. Create a service-role API key.
3. Set up a GitHub Action that runs weekly:

```yaml
# .github/workflows/db-backup.yml
name: Weekly DB backup
on:
  schedule:
    - cron: "0 3 * * 0"  # 3am UTC Sundays
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install pg_dump
        run: sudo apt-get install -y postgresql-client
      - name: Dump DB
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          pg_dump "$SUPABASE_DB_URL" \
            --no-owner --no-acl --clean --if-exists \
            > "backup-$(date +%Y-%m-%d).sql"
      - name: Upload to B2
        env:
          B2_KEY_ID: ${{ secrets.B2_KEY_ID }}
          B2_APP_KEY: ${{ secrets.B2_APP_KEY }}
        run: |
          # use b2 CLI or rclone
          ...
```

(Full implementation: see https://github.com/supabase/supabase/discussions/1554)

### Retention policy for off-site backups

- Last 4 weekly backups
- Last 12 monthly backups (first of each month)
- Annual backups indefinitely

Total storage: ~52 backups × 50MB ≈ 2.5GB ≈ $0.01/mo. Trivial.

## Test restores quarterly

A backup you&apos;ve never restored from is a backup that doesn&apos;t exist.

Every quarter:
1. Pick a random PITR point from the last 7 days.
2. Restore into a new Supabase project.
3. Run a smoke test.
4. Confirm key tables have data: customers, invoices, payments, audit_log.
5. Document the restore time.
6. Tear down the test project.

Put this on your calendar.

## Data integrity checks

Some bugs corrupt data subtly. Daily check (cheap to run):

```sql
-- Invoices where amount_paid doesn't match sum of payments
SELECT i.id, i.invoice_number, i.amount_paid, COALESCE(SUM(p.amount), 0) AS payment_sum
FROM invoices i
LEFT JOIN payments p ON p.invoice_id = i.id
GROUP BY i.id, i.invoice_number, i.amount_paid
HAVING ABS(i.amount_paid - COALESCE(SUM(p.amount), 0)) > 0.01;

-- Orphaned line items (estimate/invoice deleted but line item remained)
-- (Cascade on the foreign key should prevent this, but verify.)
SELECT * FROM estimate_line_items
WHERE estimate_id NOT IN (SELECT id FROM estimates);

-- Subscriptions out of sync with Stripe
-- Run a script that fetches subscription IDs from Stripe and compares against the DB.
```

Schedule these as a weekly pg_cron job that emails you results. Implementation
can wait until customer #100.

## What happens during a Supabase outage

Supabase&apos;s uptime SLA is 99.9% (on Pro+). That&apos;s ~9 hours of allowed
downtime per year.

During an outage:
1. Check status.supabase.com.
2. Your app will show database connection errors. Users see 500s.
3. UptimeRobot alerts you.
4. Wait. There&apos;s nothing to do until Supabase recovers — your data is safe in their backups even if their service is offline.
5. Once recovered, smoke test thoroughly.

For longer outages (> 4 hours), consider posting on your future /status page.

## Disaster recovery (Supabase project lost entirely)

Worst-case: someone (you, an attacker, Supabase) deletes the project.

Recovery steps:
1. Create a new Supabase project.
2. Restore the latest off-site backup (assuming you set those up — see above).
3. Update Vercel env vars to point at the new project.
4. Redeploy.
5. Communicate to customers about any data loss between last backup and the incident.

RTO target (recovery time objective): 4 hours
RPO target (recovery point objective): 7 days (with off-site backups), 24 hours (with PITR)

These are aggressive targets. Aim higher only once you have paying customers
who&apos;d demand better.

## Secrets backup

Vercel env vars are the source of truth for secrets. Back them up:

1. Vercel dashboard → Settings → Environment Variables → export.
2. Store the export in 1Password / Bitwarden / similar.
3. Update the backup any time you add/change a secret.

Without your secrets backed up, you can&apos;t restore the app even if you have the DB.
