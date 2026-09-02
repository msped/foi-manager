import { notFound } from "next/navigation";
import { getCase, getResponseSeed } from "@/lib/services/cases";
import { getCaseInsights, EMPTY_INSIGHTS } from "@/lib/services/ai";
import type { ResponseSeed } from "@/lib/types";
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

  const emptySeed: ResponseSeed = { body: "", subject: "", template_configured: false, blocks: [] };
  const [users, seed, insights] = await Promise.all([
    listUsers().catch(() => []),
    getResponseSeed(id).catch(() => emptySeed),
    // Precedent is supporting context, so it must never be able to take the
    // case record down with it. An assignee gets a 403 here by design, and an
    // unreachable index is a degraded panel rather than a broken page.
    getCaseInsights(id).catch(() => EMPTY_INSIGHTS),
  ]);
  const foiTeam = users.filter((u: { role: string; is_active: boolean }) => u.role === "foi_team" && u.is_active);

  return <CaseDetailView c={c} foiTeam={foiTeam} seed={seed} insights={insights} />;
}
