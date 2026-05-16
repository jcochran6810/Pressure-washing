import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieJar = await cookies();
  cookieJar.delete("portal_session");
  return NextResponse.redirect(new URL("/portal/login", request.url));
}
