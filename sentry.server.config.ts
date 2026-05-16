// Sentry server-side config. Loaded automatically by @sentry/nextjs.
// Set NEXT_PUBLIC_SENTRY_DSN in your environment to enable.
// In dev (NODE_ENV !== 'production'), Sentry is disabled to keep noise out of your terminal.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Don't capture noisy expected errors
    ignoreErrors: [
      "SubscriptionRequiredError",
      "ValidationError",
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],
    beforeSend(event, hint) {
      // Strip PII from query params if any
      if (event.request?.query_string) {
        event.request.query_string = "";
      }
      return event;
    },
  });
}
