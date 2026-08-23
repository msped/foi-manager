import djangoClient from "./django";

export interface PublicRequestPayload {
  requester_name: string;
  requester_email: string;
  request_text: string;
}

export interface PublicRequestReceipt {
  ref: string;
  status: string;
}

/** Creates a case from the public portal. The endpoint is unauthenticated and
 *  records the case as received via the portal. */
export async function submitPublicRequest(
  payload: PublicRequestPayload
): Promise<PublicRequestReceipt> {
  const { data } = await djangoClient.post<PublicRequestReceipt>(
    "/public/submit/",
    payload
  );
  return data;
}
