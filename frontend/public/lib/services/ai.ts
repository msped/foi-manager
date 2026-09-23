import djangoClient from "./django";
import type { RequestSuggestion, SchemeSuggestion } from "@/lib/types";

export interface RequestDeflection {
  /** Published responses to requests someone else already made. */
  suggestions: RequestSuggestion[];
  /** Information published as a matter of course, which may cover this. */
  scheme_entries: SchemeSuggestion[];
}

const NOTHING: RequestDeflection = { suggestions: [], scheme_entries: [] };

/**
 * Things we already publish that may cover a request being drafted.
 *
 * Two lists rather than one ranked list, because they are two different claims
 * — a published response answered this exact question, a scheme entry covers
 * this sort of question routinely — and the form gives each its own heading.
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
): Promise<RequestDeflection> {
  try {
    const { data } = await djangoClient.post<Partial<RequestDeflection>>(
      "/ai/public/request-suggestions/",
      { request_text: requestText }
    );
    return {
      suggestions: data.suggestions ?? [],
      scheme_entries: data.scheme_entries ?? [],
    };
  } catch {
    return NOTHING;
  }
}
