/**
 * Two states of one route: ask for an email, then ask for the code sent to it.
 *
 * The email travels between them in a hidden form field rather than a cookie —
 * the same reasoning as the request form. It also means the email is
 * user-editable between steps, which is exactly why the attempt counter for a
 * code lives in the database keyed by address, and never in this state.
 */
export type TrackState =
  | { step: "email"; email: string; error?: string }
  | { step: "code"; email: string; error?: string; notice?: string };

export const INITIAL_STATE: TrackState = { step: "email", email: "" };

/** Cookie holding the signed session token.
 *
 *  httpOnly, so no script in this app can read it — which is why the cases are
 *  fetched by a server component rather than the browser. */
export const SESSION_COOKIE = "foi_track";

/** Matches SESSION_MAX_AGE_SECONDS on the backend. The signature carries its own
 *  expiry, so this only stops the browser sending a token already known to be
 *  dead; the backend is what actually enforces it. */
export const SESSION_MAX_AGE = 60 * 60;
