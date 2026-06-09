import { redirect } from "next/navigation";
import StaffSidebar from "@/components/StaffSidebar";
import AssigneeSidebar from "@/components/AssigneeSidebar";
import { getMe } from "@/lib/services/users";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/api/force-logout");
  }

  return (
    <div className="staff-shell">
      {user.role === "foi_team" ? (
        <StaffSidebar user={user} />
      ) : (
        <AssigneeSidebar user={user} />
      )}
      <div className="staff-main">{children}</div>
    </div>
  );
}
