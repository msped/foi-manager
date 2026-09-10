import djangoClient from "./django";
import type { RequestSuggestion } from "@/lib/types";

/**
 * Published responses that may already answer a request being drafted.
 *
 * POST because the request text is the requester's own words, at up to 20,000
 * characters, on a subject they have not yet decided to send us — it should not
 * reach a query string, an access log or a proxy cache.
 *
 * Never throws. Every caller is on the path between someone and a statutory
 * right, so a retrieval failure has to degrade to "no suggestions" rather than
 * to an error on a form. The backend takes the same position internally; this
 * covers the transport instead.
 */
export async function getRequestSuggestions(
  requestText: string
): Promise<RequestSuggestion[]> {
  try {
    const { data } = await djangoClient.post<{ suggestions: RequestSuggestion[] }>(
      "/ai/public/request-suggestions/",
      { request_text: requestText }
    );
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}
