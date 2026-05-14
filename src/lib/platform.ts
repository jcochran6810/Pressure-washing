// Single source of truth for the platform-level brand. Keeping this here means
// rebrand the SaaS in one place — login, marketing copy, "Powered by ...",
// Drive folder names, default email "from" all read from this constant.

export const PLATFORM_NAME =
  process.env.NEXT_PUBLIC_PLATFORM_NAME || "Suds";

export const PLATFORM_TAGLINE =
  "Estimates, jobs, photos, invoices, and repeat customers — one mobile-first app for home service contractors.";

export const PLATFORM_SHORT_DESCRIPTION =
  "Run estimates, jobs, photos, invoices, and recurring work from one mobile-first dashboard.";

// Drive root folder name — gets created in the user's Google Drive on first
// connect. Generic so it makes sense for any trade.
export const DRIVE_ROOT_FOLDER_NAME = `${PLATFORM_NAME} — Job records`;
