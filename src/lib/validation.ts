import { z, type ZodError, type ZodTypeAny } from "zod";
// ZodTypeAny is exported for downstream callers that compose schemas.
export type { ZodTypeAny };

export class ValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>, summary?: string) {
    super(summary ?? Object.values(fieldErrors)[0] ?? "Validation failed");
    this.fieldErrors = fieldErrors;
    this.name = "ValidationError";
  }
}

export function formatZodErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function parseForm<T extends ZodTypeAny>(schema: T, formData: FormData): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key in raw) {
      const prev = raw[key];
      if (Array.isArray(prev)) (prev as unknown[]).push(value);
      else raw[key] = [prev, value];
    } else {
      raw[key] = value;
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(formatZodErrors(result.error));
  }
  return result.data;
}

// Coerce helpers tuned for FormData (everything arrives as a string)
const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

export const zTrimString = z.preprocess(trim, z.string());
export const zOptionalString = z.preprocess((v) => emptyToUndef(trim(v)), z.string().optional());
export const zEmail = z.preprocess((v) => emptyToUndef(trim(v)), z.string().email("Enter a valid email").optional());
export const zRequiredEmail = z.preprocess(trim, z.string().email("Enter a valid email"));
export const zPhone = z.preprocess(
  (v) => emptyToUndef(trim(v)),
  z.string().regex(/^[\d\s+()\-.]{7,20}$/, "Enter a valid phone number").optional(),
);
export const zUrl = z.preprocess((v) => emptyToUndef(trim(v)), z.string().url("Enter a valid URL").optional());
function numberSchema(opts?: { min?: number; max?: number }) {
  let s = z.number({ invalid_type_error: "Enter a number" });
  if (opts?.min !== undefined) s = s.gte(opts.min, `Must be ≥ ${opts.min}`);
  if (opts?.max !== undefined) s = s.lte(opts.max, `Must be ≤ ${opts.max}`);
  return s;
}

const coerceNumber = (v: unknown): unknown => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) ? (n as number) : undefined;
};

export function zNumber(opts: { min?: number; max?: number; required: true }): z.ZodEffects<z.ZodNumber, number, unknown>;
export function zNumber(opts?: { min?: number; max?: number; required?: false }): z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>;
export function zNumber(opts?: { min?: number; max?: number; required?: boolean }) {
  const inner = numberSchema(opts);
  return opts?.required
    ? z.preprocess(coerceNumber, inner)
    : z.preprocess(coerceNumber, inner.optional());
}
export const zCheckbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const zDateString = z.preprocess(
  (v) => emptyToUndef(trim(v)),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
);

// =========================================================================
// Domain schemas
// =========================================================================

export const customerSchema = z.object({
  first_name: zOptionalString,
  last_name: zOptionalString,
  company_name: zOptionalString,
  email: zEmail,
  phone: zPhone,
  mobile_phone: zPhone,
  customer_type: zOptionalString,
  lead_source: zOptionalString,
  notes: zOptionalString,
}).refine(
  (v) => !!(v.first_name || v.last_name || v.company_name),
  { message: "Provide a name or a company.", path: ["first_name"] },
);

export const jobSchema = z.object({
  title: z.preprocess(trim, z.string().min(2, "Title is required")),
  customer_id: z.preprocess(trim, z.string().uuid("Pick a customer")),
  property_id: z.preprocess((v) => emptyToUndef(trim(v)), z.string().uuid().optional()),
  scheduled_start: zOptionalString,
  scheduled_end: zOptionalString,
  total_amount: zNumber({ min: 0 }),
  status: zOptionalString,
  description: zOptionalString,
});

export const estimateSchema = z.object({
  customer_id: z.preprocess(trim, z.string().uuid("Pick a customer")),
  property_id: z.preprocess((v) => emptyToUndef(trim(v)), z.string().uuid().optional()),
  issue_date: zDateString,
  expires_at: zDateString,
  tax_rate: zNumber({ min: 0, max: 1 }),
  discount_amount: zNumber({ min: 0 }),
  notes: zOptionalString,
  terms: zOptionalString,
});

export const invoiceSchema = z.object({
  customer_id: z.preprocess(trim, z.string().uuid("Pick a customer")),
  issue_date: zDateString,
  due_date: zDateString,
  tax_rate: zNumber({ min: 0, max: 1 }),
  discount_amount: zNumber({ min: 0 }),
  notes: zOptionalString,
  terms: zOptionalString,
});

export const paymentSchema = z.object({
  amount: zNumber({ min: 0.01, required: true }),
  payment_method: z.preprocess(trim, z.string()),
  payment_date: zDateString,
  reference_number: zOptionalString,
  notes: zOptionalString,
});

export const contractSchema = z.object({
  name: z.preprocess(trim, z.string().min(2, "Name is required")),
  customer_id: z.preprocess(trim, z.string().uuid("Pick a customer")),
  property_id: z.preprocess((v) => emptyToUndef(trim(v)), z.string().uuid().optional()),
  cadence_months: zNumber({ min: 1, max: 60, required: true }),
  start_date: zDateString,
  default_amount: zNumber({ min: 0 }),
  notes: zOptionalString,
});

export const waiverSchema = z.object({
  name: z.preprocess(trim, z.string().min(2, "Name is required")),
  body: z.preprocess(trim, z.string().min(20, "Waiver body must be at least 20 characters")),
  active: zCheckbox,
});

export const signWaiverSchema = z.object({
  signer_name: z.preprocess(trim, z.string().min(2, "Type your full name")),
  signer_email: zEmail,
  signer_phone: zPhone,
  signature_data: z.preprocess(trim, z.string().min(40, "Please draw your signature")),
});

export const messageTemplateSchema = z.object({
  name: z.preprocess(trim, z.string().min(2, "Template name is required")),
  kind: z.preprocess(trim, z.string()),
  channel: z.preprocess(trim, z.enum(["email", "sms"])),
  subject: zOptionalString,
  body: z.preprocess(trim, z.string().min(3, "Body is required")),
  is_default: zCheckbox,
});
