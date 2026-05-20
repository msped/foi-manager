import { notFound } from "next/navigation";
import { getCase, listEmailTemplates } from "@/lib/services/cases";
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

  const [emailTemplates, users] = await Promise.all([
    listEmailTemplates(),
    listUsers(),
  ]);

  const foiTeam = users.filter(u => u.role === "foi_team" && u.is_active);

  return <CaseDetailView c={c} emailTemplates={emailTemplates} foiTeam={foiTeam} />;
}
