import djangoClient from "./django";
import type { TrackedCases } from "@/lib/types";

/**
 * "Check a request" — the one part of the portal with a credential to send.
 *
 * The session token is passed explicitly into `getTrackedCases` rather than
 * attached by the axios singleton in `django.ts`, which is documented as never
 * sending credentials. Keeping that promise true matters more than saving an
 * argument here: the next person to add a portal endpoint should still be able
 * to assume the default client carries nothing.
 */

/** Asks the backend to email a code.
 *
 *  Always resolves the same way — for an address with requests, one without,
 *  and one that has asked too often. That is the endpoint's whole design, so
 *  callers have nothing to branch on and must not invent a difference. */
export async function requestTrackingCode(email: string): Promise<void> {
  await djangoClient.post("/public/track/request-code/", { email });
}

/** Exchanges a code for a session token. Throws on a bad or expired code. */
export async function verifyTrackingCode(
  email: string,
  code: string
): Promise<string> {
  const { data } = await djangoClient.post<{ token: string }>(
    "/public/track/verify/",
    { email, code }
  );
  return data.token;
}

/** Lists the verified requester's cases. Throws 401 once the session lapses. */
export async function getTrackedCases(token: string): Promise<TrackedCases> {
  const { data } = await djangoClient.get<TrackedCases>(
    "/public/track/requests/",
    { headers: { "X-FOI-Track-Token": token } }
  );
  return data;
}
