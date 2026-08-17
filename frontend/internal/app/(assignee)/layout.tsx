import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ASSIGNEE_NAV } from "@/lib/nav";
import { getMe } from "@/lib/services/users";

export default async function AssigneeLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/api/force-logout");
  }

  if (user.role !== "assignee") redirect("/dashboard");

  return (
    <AppShell user={user} nav={ASSIGNEE_NAV} homepageUrl="/consultations">
      {children}
    </AppShell>
  );
}
