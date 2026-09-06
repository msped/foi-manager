import djangoClient from "./django";
import type { CaseInsights } from "@/lib/types";

/** Empty panel. What the page shows when insights cannot be fetched. */
export const EMPTY_INSIGHTS: CaseInsights = {
  indexed: false,
  similar_cases: [],
  exemption_frequencies: [],
};

/**
 * Precedent and exemption history for one case.
 *
 * FOI team only, server-side. The endpoint returns cases selected by
 * resemblance rather than by assignment, so it sits behind `IsFOITeam` — an
 * assignee calling it gets a 403, which the caller is expected to treat as an
 * empty panel rather than an error.
 */
export async function getCaseInsights(id: number | string): Promise<CaseInsights> {
  const { data } = await djangoClient.get<CaseInsights>(`/ai/cases/${id}/insights/`);
  return data;
}
