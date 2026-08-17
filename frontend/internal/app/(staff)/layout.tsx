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
  const hasMissingTemplates = purposes.some(p => !p.template);

  const nav = STAFF_NAV.map(item =>
    item.href === "/settings" && hasMissingTemplates
      ? { ...item, text: `${item.text} (action needed)` }
      : item
  );

  return (
    <AppShell user={user} nav={nav} homepageUrl="/dashboard" showNotifications>
      {children}
    </AppShell>
  );
}
