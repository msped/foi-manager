import { redirect } from "next/navigation";
import StaffSidebar from "@/components/StaffSidebar";
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

  return (
    <div className="staff-shell">
      <StaffSidebar user={user} hasMissingTemplates={hasMissingTemplates} />
      <div className="staff-main">{children}</div>
    </div>
  );
}
