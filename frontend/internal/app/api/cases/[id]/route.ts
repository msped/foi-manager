import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const DJANGO = process.env.DJANGO_API_URL ?? "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: request.headers });
  const token = (session?.user as any)?.access_token;

  if (!token) {
    return NextResponse.json({ detail: "Not authenticated." }, { status: 401 });
  }

  const res = await fetch(`${DJANGO}/api/v1/cases/${id}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ detail: "Not found." }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
