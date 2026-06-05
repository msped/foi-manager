import { redirect } from "next/navigation";
import { getMe } from "@/lib/services/users";
import AssigneeSidebar from "@/components/AssigneeSidebar";

export default async function AssigneeLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/login");
  }

  if (user.role !== "assignee") redirect("/dashboard");

  return (
    <div className="staff-shell">
      <AssigneeSidebar user={user} />
      <div className="staff-main">{children}</div>
    </div>
  );
}
