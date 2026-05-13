// Google Drive integration. Requires:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   NEXT_PUBLIC_APP_URL    (used to build the OAuth redirect)
//
// The user grants Drive scope at /api/google/connect, the callback at
// /api/google/callback stores a refresh token on `google_drive_connections`
// keyed by organization_id.

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function googleAuthUrl(state: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID missing");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/google/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refresh_token: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function userInfo(access_token: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { email: string; name?: string };
}

export async function ensureFolder(access_token: string, name: string, parent?: string | null): Promise<string> {
  // Search for existing folder with this name (under parent if given)
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
    parent ? `'${parent}' in parents` : null,
  ].filter(Boolean).join(" and ");
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (list.ok) {
    const j = await list.json();
    if (j.files?.[0]) return j.files[0].id;
  }
  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parent ? [parent] : undefined,
    }),
  });
  if (!create.ok) throw new Error(`Drive folder create failed: ${await create.text()}`);
  const data = await create.json();
  return data.id as string;
}

export async function uploadFile(opts: {
  access_token: string;
  parentFolderId: string;
  name: string;
  mimeType: string;
  body: Blob | string | ArrayBuffer;
}) {
  // Resumable would be better for large files; this is the simple multipart path.
  const metadata = { name: opts.name, parents: [opts.parentFolderId] };
  const boundary = "boundary" + Math.random().toString(16).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${opts.mimeType}\r\n\r\n`;
  const bodyEnd = `\r\n--${boundary}--`;

  let fileBytes: Uint8Array;
  if (typeof opts.body === "string") fileBytes = new TextEncoder().encode(opts.body);
  else if (opts.body instanceof ArrayBuffer) fileBytes = new Uint8Array(opts.body);
  else fileBytes = new Uint8Array(await opts.body.arrayBuffer());

  const head = new TextEncoder().encode(body);
  const tail = new TextEncoder().encode(bodyEnd);
  const merged = new Uint8Array(head.length + fileBytes.length + tail.length);
  merged.set(head, 0);
  merged.set(fileBytes, head.length);
  merged.set(tail, head.length + fileBytes.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.access_token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: merged,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${await res.text()}`);
  return (await res.json()) as { id: string; webViewLink: string; webContentLink: string };
}
