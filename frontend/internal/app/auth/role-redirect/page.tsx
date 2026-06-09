import { redirect } from "next/navigation";
import { getMe } from "@/lib/services/users";

export default async function RoleRedirectPage() {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/login");
  }

  redirect(user.role === "foi_team" ? "/dashboard" : "/consultations");
}
