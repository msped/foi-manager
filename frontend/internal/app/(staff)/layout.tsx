import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { STAFF_NAV } from "@/lib/nav";
import { getMe } from "@/lib/services/users";
import { listEmailTemplatePurposes } from "@/lib/services/cases";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/api/force-logout");
  }

  if (user.role !== "foi_team") redirect("/consultations");

  const purposes = await listEmailTemplatePurposes().catch(() => []);
  const missingTemplates = purposes.filter(p => !p.template).length;

  // A count rather than an "(action needed)" suffix: the service navigation is
  // a horizontal bar, so a longer label pushes the row around, and a number
  // says how much work is waiting instead of only that some is.
  const nav = STAFF_NAV.map(item =>
    item.href === "/settings" && missingTemplates > 0
      ? { ...item, count: missingTemplates }
      : item
  );

  return (
    <AppShell user={user} nav={nav} homepageUrl="/dashboard" showNotifications>
      {children}
    </AppShell>
  );
}
