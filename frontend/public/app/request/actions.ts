"use server";

import { redirect } from "next/navigation";
import { isAxiosError } from "axios";
import { getRequestSuggestions } from "@/lib/services/ai";
import { submitPublicRequest } from "@/lib/services/cases";
import {
  HONEYPOT_FIELD,
  MAX_REQUEST_CHARS,
  type RequestAnswers,
  type RequestFieldErrors,
  type RequestState,
} from "./types";

/**
 * Why the form and check-answers screen share one route.
 *
 * The obvious shape is /request → /request/check → /request/confirmation, but a
 * separate check route needs the answers to survive a redirect, which means a
 * cookie — and cookies cap at about 4KB. That would force an arbitrary limit on
 * how long an FOI request can be, which is not a limit the Act imposes. Keeping
 * the review step in the same route lets the answers travel in hidden form
 * fields instead: no size ceiling, and no requester's name, email and request
 * text sitting in a browser cookie.
 *
 * Both steps still work without JavaScript — the form posts, the action runs,
 * and the page re-renders with the next state.
 *
 * The suggestions step is a third state of the same route, for the same reason,
 * and it inherits the same property: retrieval happens here on the server, so a
 * requester with JavaScript disabled sees the published responses too.
 */

function readAnswers(formData: FormData): RequestAnswers {
  return {
    requester_name: String(formData.get("requester_name") ?? "").trim(),
    requester_email: String(formData.get("requester_email") ?? "").trim(),
    // Not trimmed to death: internal whitespace is the requester's formatting.
    request_text: String(formData.get("request_text") ?? "").trim(),
  };
}

// Deliberately permissive. The address is checked properly by sending to it,
// not by pattern matching, so this only catches obvious typos.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(answers: RequestAnswers): RequestFieldErrors {
  const errors: RequestFieldErrors = {};

  if (!answers.requester_name) {
    errors.requester_name = "Enter your name";
  }

  if (!answers.requester_email) {
    errors.requester_email = "Enter your email address";
  } else if (!EMAIL_PATTERN.test(answers.requester_email)) {
    errors.requester_email =
      "Enter an email address in the correct format, like name@example.com";
  }

  if (!answers.request_text) {
    errors.request_text = "Enter the information you want";
  } else if (answers.request_text.length > MAX_REQUEST_CHARS) {
    // Checked here as well as by the API so the requester hears about it at the
    // Continue step, rather than after reviewing answers they cannot send.
    errors.request_text = `Your request must be ${MAX_REQUEST_CHARS.toLocaleString(
      "en-GB"
    )} characters or fewer`;
  }

  return errors;
}

export async function requestAction(
  _prevState: RequestState,
  formData: FormData
): Promise<RequestState> {
  const intent = String(formData.get("intent") ?? "review");
  const answers = readAnswers(formData);

  // "Change" on the check-answers screen: back to the form, answers intact.
  if (intent === "back") {
    return { step: "form", values: answers, errors: {} };
  }

  // The honeypot is hidden from browsers and from assistive technology, so a
  // human should never have filled it. Checked again by the API, which is the
  // check that matters — anything posting straight to Django never runs this.
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim()) {
    return {
      step: "form",
      values: answers,
      errors: {},
      formError:
        "Your request could not be sent. If you are using a browser extension that fills in forms for you, turn it off for this page and try again.",
    };
  }

  const errors = validate(answers);
  if (Object.keys(errors).length > 0) {
    return { step: "form", values: answers, errors };
  }

  // Coming off the form. Look for published responses that may already answer
  // this before asking anyone to check their answers — the point of the step is
  // to offer an answer now instead of in twenty working days.
  //
  // Skipped entirely when there is nothing to show, so nobody meets a screen
  // whose only content is that it found nothing. `getRequestSuggestions` never
  // throws, so retrieval being down is indistinguishable from a novel request:
  // both go straight to check-answers, which is the correct outcome for both.
  //
  // Deliberately re-run if someone edits their request and continues again.
  // Carrying the previously-checked text through three steps of hidden fields
  // to avoid one repeated call would cost more than the call.
  if (intent === "review") {
    const suggestions = await getRequestSuggestions(answers.request_text);
    if (suggestions.length > 0) {
      return { step: "suggestions", values: answers, suggestions };
    }
  }

  if (intent !== "submit") {
    return { step: "review", values: answers };
  }

  let ref: string;
  try {
    const receipt = await submitPublicRequest(answers);
    ref = receipt.ref;
  } catch (error) {
    // Rate limited. Stay on the check-answers screen rather than dropping back
    // to the form: the message tells them to email the request instead, and
    // that is much easier to act on with the finished wording still in front of
    // them to copy.
    if (isAxiosError(error) && error.response?.status === 429) {
      const detail = (error.response.data as { detail?: string })?.detail;
      return {
        step: "review",
        values: answers,
        formError:
          detail ??
          "You have sent us several requests recently, so this form has paused new ones for a short while. You can still make a request by emailing us.",
      };
    }

    // Surface field-level problems from DRF against the right input; anything
    // else becomes a whole-form error so the answers are never lost.
    if (isAxiosError(error) && error.response?.status === 400) {
      const detail = error.response.data as Record<string, string[] | string>;
      const apiErrors: RequestFieldErrors = {};
      for (const field of [
        "requester_name",
        "requester_email",
        "request_text",
      ] as const) {
        const message = detail?.[field];
        if (message) {
          apiErrors[field] = Array.isArray(message) ? message[0] : String(message);
        }
      }
      if (Object.keys(apiErrors).length > 0) {
        return { step: "form", values: answers, errors: apiErrors };
      }
    }

    return {
      step: "review",
      values: answers,
      formError:
        "Your request could not be sent. Try again, and if the problem continues contact us by email.",
    };
  }

  // Outside the try: redirect() signals by throwing, so catching it here would
  // swallow the navigation and report a false failure.
  redirect(`/request/confirmation?ref=${encodeURIComponent(ref)}`);
}
