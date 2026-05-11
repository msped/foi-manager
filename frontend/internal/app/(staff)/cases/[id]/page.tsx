import { notFound } from "next/navigation";
import { getCase, listDepartments } from "@/lib/services/cases";
import { listUsers } from "@/lib/services/users";
import CaseDetailView from "./CaseDetailView";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let c;
  try {
    c = await getCase(id);
  } catch {
    notFound();
  }

  const [departments, users] = await Promise.all([listDepartments(), listUsers()]);

  return <CaseDetailView c={c} departments={departments} users={users} />;
}
