"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAxiosError } from "axios";
import {
  requestTrackingCode,
  verifyTrackingCode,
} from "@/lib/services/tracking";
import { SESSION_COOKIE, SESSION_MAX_AGE, type TrackState } from "./types";

/**
 * Why server actions rather than calling Django from the browser.
 *
 * The session token is httpOnly, so client JavaScript cannot hold it or attach
 * it to a fetch. Beyond that, a browser-fetch version has no no-JavaScript
 * path, and this is a public sector service — the Public Sector Bodies
 * Accessibility Regulations expect it to work without. Posting a form to a
 * server action gives both.
 *
 * The rule this project bans is Next.js *API routes* proxying Django. Server
 * actions are the sanctioned alternative to those, not an extra hop.
 */

// Deliberately permissive, as on the request form: an address is verified by
// sending to it, not by matching a pattern. This only catches obvious typos.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_FAILURE =
  "There was a problem. Try again, and if it continues contact us by email.";

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "").trim();
}

/** Sends a code and moves to the code step.
 *
 *  Moves on regardless of what the backend found, because the backend
 *  deliberately does not say. Telling the requester "no requests from that
 *  address" would leak exactly what the uniform response exists to hide, so the
 *  copy on the next screen is conditional-tense throughout. */
async function sendCode(email: string, notice: string): Promise<TrackState> {
  try {
    await requestTrackingCode(email);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 400) {
      return {
        step: "email",
        email,
        error: "Enter an email address in the correct format, like name@example.com",
      };
    }
    return { step: "email", email, error: GENERIC_FAILURE };
  }
  return { step: "code", email, notice };
}

export async function trackAction(
  _prevState: TrackState,
  formData: FormData
): Promise<TrackState> {
  const intent = String(formData.get("intent") ?? "");
  const email = readEmail(formData);

  if (intent === "change-email") {
    return { step: "email", email };
  }

  if (!email) {
    return { step: "email", email: "", error: "Enter your email address" };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return {
      step: "email",
      email,
      error: "Enter an email address in the correct format, like name@example.com",
    };
  }

  if (intent === "request-code") {
    return sendCode(email, `We have sent a code to ${email} if we have any requests from it.`);
  }

  if (intent === "resend") {
    // The old code stops working the moment this one is issued, which the
    // notice has to say — otherwise someone reads the first email and wonders
    // why a perfectly good code is being rejected.
    return sendCode(
      email,
      "We have sent a new code. Any earlier code no longer works."
    );
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { step: "code", email, error: "Enter the code we sent you" };
  }

  let token: string;
  try {
    token = await verifyTrackingCode(email, code);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 400) {
      const detail = (error.response.data as { detail?: string })?.detail;
      return {
        step: "code",
        email,
        // The backend answers every kind of failure identically on purpose —
        // wrong, expired, exhausted, never issued. Pass it through rather than
        // trying to be more specific here.
        error:
          detail ??
          "That code is not correct, or it has expired. Request a new code and try again.",
      };
    }
    return { step: "code", email, error: GENERIC_FAILURE };
  }

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  // Outside the try: redirect() signals by throwing, so catching it here would
  // swallow the navigation and report a false failure.
  redirect("/track/requests");
}

/** Ends the session. An explicit control, because FOI requesters use library
 *  and community-centre computers and closing the tab is not the same thing. */
export async function finishSession() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/track");
}
