import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // session may already be invalid — proceed to redirect regardless
  }
  return NextResponse.redirect(
    new URL("/login", process.env.BETTER_AUTH_URL ?? "http://localhost:3000")
  );
}
