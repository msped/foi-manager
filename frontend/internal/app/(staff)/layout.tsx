import { redirect } from "next/navigation";
import StaffSidebar from "@/components/StaffSidebar";
import { getMe } from "@/lib/services/users";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/api/force-logout");
  }

  return (
    <div className="staff-shell">
      <StaffSidebar user={user} />
      <div className="staff-main">{children}</div>
    </div>
  );
}
