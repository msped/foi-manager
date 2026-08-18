"use server";

import { redirect } from "next/navigation";
import { isAxiosError } from "axios";
import { submitPublicRequest } from "@/lib/services/cases";
import type {
  RequestAnswers,
  RequestFieldErrors,
  RequestState,
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

  const errors = validate(answers);
  if (Object.keys(errors).length > 0) {
    return { step: "form", values: answers, errors };
  }

  if (intent !== "submit") {
    return { step: "review", values: answers };
  }

  let ref: string;
  try {
    const receipt = await submitPublicRequest(answers);
    ref = receipt.ref;
  } catch (error) {
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
      step: "form",
      values: answers,
      errors: {
        request_text:
          "Your request could not be sent. Try again, and if the problem continues contact us by email.",
      },
    };
  }

  // Outside the try: redirect() signals by throwing, so catching it here would
  // swallow the navigation and report a false failure.
  redirect(`/request/confirmation?ref=${encodeURIComponent(ref)}`);
}
