// QuickBooks Online OAuth + minimal entity sync (push customers and invoices).
// Setup: create a QBO app at https://developer.intuit.com,
// set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENVIRONMENT (sandbox|production).

const PROD_BASE = "https://quickbooks.api.intuit.com";
const SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com";

export type QboEnv = "production" | "sandbox";

export function qboConfigured(): boolean {
  return Boolean(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET);
}

export function qboAuthUrl(state: string): string | null {
  if (!qboConfigured()) return null;
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID!,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting openid email profile",
    redirect_uri: process.env.QBO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/accounting/qbo/callback`,
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const basic = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/accounting/qbo/callback`,
    }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`QBO token exchange failed: ${txt}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const basic = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`QBO refresh failed: ${txt}`);
  }
  return res.json();
}

export type QboConn = {
  organization_id: string;
  realm_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  environment: QboEnv;
};

async function ensureAccessToken(supabase: any, conn: QboConn): Promise<string> {
  const now = Date.now();
  const exp = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (conn.access_token && exp - now > 60_000) return conn.access_token;
  const refreshed = await refreshAccessToken(conn.refresh_token);
  const expiresAt = new Date(now + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("qbo_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", conn.organization_id);
  return refreshed.access_token;
}

function apiBase(env: QboEnv) {
  return env === "sandbox" ? SANDBOX_BASE : PROD_BASE;
}

async function qboFetch(conn: QboConn, accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${apiBase(conn.environment)}/v3/company/${conn.realm_id}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`QBO ${path} ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function pushCustomerToQbo(
  supabase: any,
  conn: QboConn,
  customer: { id: string; first_name?: string | null; last_name?: string | null; company_name?: string | null; email?: string | null; phone?: string | null; qbo_id?: string | null },
): Promise<string> {
  const accessToken = await ensureAccessToken(supabase, conn);
  if (customer.qbo_id) return customer.qbo_id;

  const displayName = customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || `Customer ${customer.id.slice(0, 8)}`;
  const body: any = {
    DisplayName: displayName,
    GivenName: customer.first_name ?? undefined,
    FamilyName: customer.last_name ?? undefined,
    CompanyName: customer.company_name ?? undefined,
  };
  if (customer.email) body.PrimaryEmailAddr = { Address: customer.email };
  if (customer.phone) body.PrimaryPhone = { FreeFormNumber: customer.phone };

  const out = await qboFetch(conn, accessToken, "/customer?minorversion=70", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const qboId = out?.Customer?.Id;
  if (!qboId) throw new Error("QBO did not return a customer id");
  await supabase
    .from("customers")
    .update({ qbo_id: qboId, qbo_synced_at: new Date().toISOString() })
    .eq("id", customer.id);
  return qboId;
}

export async function pushInvoiceToQbo(
  supabase: any,
  conn: QboConn,
  invoice: any,
  customerQboId: string,
): Promise<string> {
  const accessToken = await ensureAccessToken(supabase, conn);
  if (invoice.qbo_id) return invoice.qbo_id;

  const lines = (invoice.invoice_line_items ?? []).map((li: any) => ({
    DetailType: "SalesItemLineDetail",
    Amount: Number(li.total ?? li.quantity * li.unit_price),
    Description: li.description,
    SalesItemLineDetail: {
      Qty: Number(li.quantity || 1),
      UnitPrice: Number(li.unit_price || 0),
      // Income account / item mapping happens server-side in QBO; we use the
      // default item the org configured in QBO. If not configured, the API
      // returns an error which surfaces to the user.
    },
  }));

  const body: any = {
    CustomerRef: { value: customerQboId },
    DocNumber: invoice.invoice_number,
    TxnDate: invoice.issue_date ?? undefined,
    DueDate: invoice.due_date ?? undefined,
    Line: lines.length ? lines : [{
      DetailType: "SalesItemLineDetail",
      Amount: Number(invoice.total ?? 0),
      Description: "Service",
      SalesItemLineDetail: { Qty: 1, UnitPrice: Number(invoice.total ?? 0) },
    }],
  };
  if (invoice.notes) body.PrivateNote = invoice.notes;

  const out = await qboFetch(conn, accessToken, "/invoice?minorversion=70", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const qboId = out?.Invoice?.Id;
  if (!qboId) throw new Error("QBO did not return an invoice id");
  await supabase
    .from("invoices")
    .update({ qbo_id: qboId, qbo_synced_at: new Date().toISOString() })
    .eq("id", invoice.id);
  return qboId;
}
