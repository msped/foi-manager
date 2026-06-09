import { notFound } from "next/navigation";
import { getCase } from "@/lib/services/cases";
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

  const users = await listUsers().catch(() => []);
  const foiTeam = users.filter((u: { role: string; is_active: boolean }) => u.role === "foi_team" && u.is_active);

  return <CaseDetailView c={c} foiTeam={foiTeam} />;
}
