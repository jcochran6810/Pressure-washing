import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requirePlatformAdmin, logAdminAction, IMPERSONATE_COOKIE } from "@/lib/admin";

export async function POST(request: Request) {
  const ctx = await requirePlatformAdmin();
  const jar = await cookies();
  const orgId = jar.get(IMPERSONATE_COOKIE)?.value ?? null;
  jar.delete(IMPERSONATE_COOKIE);
  if (orgId) {
    await logAdminAction(ctx.userId, "impersonate.stop", { kind: "organization", id: orgId });
  }
  return NextResponse.redirect(new URL("/admin/companies", request.url));
}
