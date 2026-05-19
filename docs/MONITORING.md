# Monitoring & on-call plan

Two layers:

1. **Sentry** — captures exceptions from server actions, API routes, and the client
2. **UptimeRobot** — pings public endpoints; alerts you when something is down

Set these up once. Total time: ~20 minutes.

## 1. Sentry setup

Already wired in code (`sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`).

### Sign up
- https://sentry.io — free tier covers 5k errors/month, plenty for early customers
- Create an organization. Project type: **Next.js**

### Get your DSN
- Project Settings → Client Keys (DSN)
- Copy the DSN (starts with `https://...@o....ingest.sentry.io/...`)

### Set env vars in Vercel
| Var | Value | Required? |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | your DSN | yes (without it Sentry is inert) |
| `SENTRY_AUTH_TOKEN` | from Settings → Auth Tokens | only for source map upload |
| `SENTRY_ORG` | your org slug | only for source map upload |
| `SENTRY_PROJECT` | your project slug | only for source map upload |

Source maps make stack traces readable. Skip them initially if you want — it'll still work, just with minified names.

### Test it
After deploying:
1. Trigger an intentional error: visit `/api/test-error` (you don't have this route; you can `throw new Error("sentry test")` somewhere temporarily)
2. Check Sentry → Issues — the error should appear within seconds

### Alert routing
- Sentry → Alerts → Create Alert Rule
- Recommended starter alert: **email me when an issue is seen by 5+ users in 1 hour**
- More specific: **email me immediately for any error from `/api/stripe/webhook`** (payment failures must be investigated fast)

### Filtered noise
The config already ignores:
- `SubscriptionRequiredError` (expected when subscription is past due)
- `ValidationError` (expected when user inputs bad data)
- `NEXT_REDIRECT`, `NEXT_NOT_FOUND` (Next.js control-flow, not errors)

If your inbox fills with a particular error type, add it to `ignoreErrors` in `sentry.server.config.ts`.

## 2. UptimeRobot setup

### Sign up
- https://uptimerobot.com — free tier covers 50 monitors at 5-min intervals

### Endpoints to monitor

| Monitor | URL | Type | Interval | Expected response |
|---|---|---|---|---|
| **Home page** | `https://yourdomain.com` | HTTP(s) | 5 min | 200 |
| **Login** | `https://yourdomain.com/login` | HTTP(s) | 5 min | 200 |
| **Reminders cron** | `https://yourdomain.com/api/cron/reminders` | HTTP(s) Keyword | 30 min | contains `"processed"` |
| **Contracts cron** | `https://yourdomain.com/api/cron/contracts` | HTTP(s) Keyword | 1 day | contains `"orgs"` |
| **Stripe webhook reachable** | `https://yourdomain.com/api/stripe/webhook` | HTTP(s) | 30 min | 400 (no signature is fine — confirms route exists) |

For the cron endpoints, add a custom header so UptimeRobot's pings authorize:
```
Authorization: Bearer <your CRON_SECRET>
```

### Alert routing
- Alert contacts: your phone (SMS) + a secondary (spouse, partner, employee)
- Notification: trigger after **2 consecutive failures** (avoids one-off blips)
- Recovery alert: ON (so you know when it comes back)

## 3. The "is something wrong right now?" loop

When an alert fires, check in this order:

1. **Vercel dashboard → Deployments** — was a deploy just rolled out? Could be a regression. Roll back.
2. **Vercel dashboard → Logs** — any spike in 5xx or errors in the last 10 minutes?
3. **Sentry → Issues** — any new issue spiking?
4. **Supabase dashboard → Reports** — is the database under load? CPU > 80%? Connections maxed?
5. **Stripe dashboard → Developers → Events** — any failing webhook deliveries (retry queue building up)?

Most outages fall into one of three buckets:
- Your last deploy broke something → roll back
- Supabase auto-paused (free tier) or hit a limit → upgrade
- Stripe / Resend / Telnyx had an outage → wait, status pages will confirm

## 4. Status pages to bookmark

- Vercel: https://www.vercel-status.com/
- Supabase: https://status.supabase.com/
- Stripe: https://status.stripe.com/
- Resend: https://resend-status.com/
- Telnyx: https://status.telnyx.com/

Open them BEFORE you panic — if a provider is having an incident, the answer is "wait."

## 5. Operational hygiene

- **Weekly**: review Sentry top issues. Fix or silence the top 3.
- **Monthly**: check audit log for unusual activity, check cron run rate (`cron_runs` table), review subscription churn.
- **Quarterly**: rotate `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`. Re-test backups.

## 6. Cost summary

| Service | Cost | Why |
|---|---|---|
| Sentry Developer | $0 | 5k events/mo, 1 user |
| Sentry Team (if you outgrow) | $26/mo | 50k events, error grouping, dashboards |
| UptimeRobot Free | $0 | 50 monitors @ 5min |
| UptimeRobot Pro (if you want SMS alerts) | $7/mo | 1-min interval + SMS |

Free tier is fine through ~100 customers.
