import { notFound } from "next/navigation";
import { getCase } from "@/lib/services/cases";
import CaseDetailView from "./CaseDetailView";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let c;
  try {
    c = await getCase(id);
  } catch {
    notFound();
  }

  return <CaseDetailView c={c} />;
}
