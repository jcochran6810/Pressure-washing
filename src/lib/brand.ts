// Single source of truth for the product brand. Change here, propagate everywhere.
// Names and copy that face customers should read from this file.

export const BRAND = {
  // Short product name (logo, header, page titles)
  name: "Suds",
  // Long-form tagline / category
  tagline: "Home services business manager",
  // Description used in marketing copy / meta description
  description:
    "All-in-one CRM, scheduling, estimating, invoicing, accounting, inventory, and marketing for home services businesses.",
  // What kind of businesses use this? Used in legal / signup copy.
  audience: "home services",
  // Examples shown on the landing page
  exampleVerticals: [
    "pressure washing",
    "window cleaning",
    "lawn care",
    "gutter cleaning",
    "house cleaning",
    "handyman services",
    "HVAC service calls",
    "pest control",
  ],
} as const;
