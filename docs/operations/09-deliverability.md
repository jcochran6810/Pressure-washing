# Email & SMS deliverability

When emails land in spam or SMS gets blocked, here&apos;s how to debug and fix it.

## Email (Resend)

### Initial domain setup (do this once before sending any email)

1. **Buy and verify your sending domain.**
   - Don&apos;t use `@gmail.com`, `@outlook.com`, or `onboarding@resend.dev` for production.
   - Use a subdomain: `noreply@suds.yourdomain.com` (keeps your main domain&apos;s reputation isolated).

2. **Configure DNS records** (Resend gives you these):
   - **SPF**: `TXT @ "v=spf1 include:_spf.resend.com ~all"`
   - **DKIM**: `TXT resend._domainkey "..."`  (Resend provides the key)
   - **DMARC**: `TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"`

3. **Wait for verification.**
   - SPF + DKIM: a few minutes
   - DMARC: 24 hours to start receiving aggregate reports

4. **Warm up the domain.**
   - Don&apos;t blast 1000 emails on day 1.
   - Send to known-engaged recipients (yourself, friends) for the first week.
   - Gradually ramp volume.

### Troubleshooting: emails going to spam

**Symptoms**: customer says "I never got the email" — but logs show it sent.

**Diagnosis tree**:

1. **Check Resend logs.** Resend Dashboard → Emails → search by recipient.
   - Status `delivered`? It reached their server. It&apos;s sitting in their spam folder.
   - Status `bounced`? Permanent failure. Address is invalid.
   - Status `complained`? Recipient hit "Spam" — remove them from sending.

2. **Check Gmail&apos;s "Show original"** if recipient is Gmail.
   - SPF: PASS / DKIM: PASS / DMARC: PASS?
   - If any fail: DNS issue. Fix the failed record.

3. **Check sender reputation.**
   - Postmark&apos;s SpamAssassin score: paste your email at https://spamassessment.com (free).
   - Score should be < 5. If higher, simplify the HTML, remove image-heavy content, remove all-caps and exclamation marks.

4. **Check blacklists.**
   - https://mxtoolbox.com/blacklists.aspx → enter your sending IP / domain.
   - If listed: request delisting from each blacklist (most accept self-service requests).

5. **Engagement signals.**
   - Gmail and Outlook learn from your customers&apos; behavior. If your emails get marked as spam often, your reputation tanks.
   - Bake a feedback loop: "Was this useful? [Yes] [No]" link. Lots of clicks = good signal.

### Common pitfalls

- **From address mismatch**: if `RESEND_FROM` doesn&apos;t match a verified domain, Resend won&apos;t send.
- **Reply-To missing**: always set `replyTo` so customers can hit "Reply." Mailbox providers downrank emails with no reply path.
- **HTML-only without text fallback**: bad for accessibility and deliverability. Consider adding a text version.
- **Image-only emails**: spam filters distrust them.

### Production email subjects to monitor

In Resend Dashboard, watch the open rate of these emails:

| Email | Target open rate |
| --- | --- |
| Invoice sent | > 60% |
| Receipt | > 70% |
| Payment failed (SaaS) | > 80% |
| Estimate sent | > 50% |
| Review request | > 40% |

Below target = subject line or sender domain issue.

## SMS (Telnyx)

### Initial setup

1. **Buy a phone number** through Telnyx.
   - **For US: must be a 10DLC (long code) number, NOT a toll-free.**
   - For Canada: similar process (mainstream long codes).
   - Toll-free numbers are easier to register but more expensive per message and increasingly mistrusted.

2. **Register your business with TCR (The Campaign Registry)**.
   - Telnyx Dashboard → Messaging → Brands → Create brand.
   - Provide: legal business name, EIN/tax ID, brand contact info, sample messages.
   - Cost: $4 one-time + $2/month per brand (currently — verify).

3. **Create a Campaign**.
   - Telnyx → Messaging → Campaigns → Create campaign.
   - Use case: "Customer Care" or "Account Notifications" (these are the most permissive).
   - Provide: sample messages, opt-in mechanism (link to your customer-facing consent form), opt-out instructions.
   - Cost: $0.10–$10/month depending on use case.
   - Approval: 1–10 business days.

4. **Assign campaign to messaging profile.**
   - Telnyx → Messaging → Profiles → your profile → Campaign → select approved campaign.

5. **Test.**
   - Send to a known number you control.
   - Verify delivery + that STOP/HELP work.

### Troubleshooting: SMS not delivered

1. **Check Telnyx logs.** Dashboard → Messaging → search by recipient.
   - Status `delivered` → it went through. Carrier may have silently filtered.
   - Status `failed` with error code → look up the code in Telnyx docs. Common ones:
     - `30005` Destination unknown → number doesn&apos;t exist
     - `30006` Landline → can&apos;t SMS to landlines
     - `30007` Carrier filter → message blocked for content
     - `30008` Unknown → carrier didn&apos;t accept, often spam classification

2. **Carrier filtering.**
   - URLs in messages get carriers&apos; attention. Use a branded short link service (e.g., a redirect on your own domain like `https://suds.app/q/abc123`) rather than `bit.ly` or raw long URLs.
   - All-caps and excessive exclamation marks trigger filters.
   - "Free", "winner", "act now" — classic spam triggers.
   - Messages that don&apos;t identify the sender business may be filtered.

3. **Throughput limits.**
   - Long codes are typically limited to **1 message per second per number**.
   - For high-volume sends, you need multiple long codes or a short code (expensive, $1,000/mo).

4. **Opt-outs.**
   - Once a recipient replies STOP to your sender, Telnyx auto-suppresses future messages to that number.
   - This is invisible to your code — the message will appear "sent" but the recipient won&apos;t get it.
   - Check Telnyx → Messaging → Opt-outs to see suppressed numbers.

### Compliance refresher

See `/legal/sms-consent` for the full policy. Most-violated rules:

- Sending without prior express consent → TCPA $500–$1,500 per message
- Sending outside 8 AM – 9 PM recipient local time → TCPA
- Sending to non-registered 10DLC → carriers throttle / block
- Failing to honor STOP within 24 hours → TCPA + Telnyx ToS

## Monitoring deliverability

### Daily checks (manual until you scale)

- Resend dashboard: bounce rate < 2%? complaint rate < 0.1%?
- Telnyx dashboard: any throttling alerts?
- Sample customer email: did the last receipt land in your inbox or spam?

### Weekly
- Pull bounced emails → update or remove those customers.
- Pull opt-out SMS list → ensure your CRM marks those customers as no-SMS.

### When metrics degrade

Specific actions in order of cost:

1. Pause sends temporarily, investigate.
2. Check DNS records (might have drifted).
3. Reduce send volume to known-engaged recipients only.
4. Warm up reputation again.
5. Move to a different sending domain or subdomain.
6. Last resort: switch ESP (Resend → SendGrid / Postmark / etc.).

## Alternative providers (just in case)

If Resend has an extended outage:

- **Postmark** — excellent for transactional, slightly pricier.
- **SendGrid** — biggest, very configurable.
- **Mailgun** — comparable to SendGrid.

If Telnyx has an extended outage:

- **Twilio** — bigger, more expensive.
- **MessageBird / Bird** — international focus.
- **Plivo** — comparable to Telnyx.

Document the switch process if/when you migrate. Doing it under pressure is no fun.
