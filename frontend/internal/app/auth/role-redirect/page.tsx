import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function RoleRedirectPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const role = (session.user as any).foiRole;
  redirect(role === "assignee" ? "/consultations" : "/dashboard");
}
