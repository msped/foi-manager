export interface RequestAnswers {
  requester_name: string;
  requester_email: string;
  request_text: string;
}

export type RequestFieldErrors = Partial<Record<keyof RequestAnswers, string>>;

/**
 * The form and the check-answers screen are two states of one route rather than
 * two routes. See the comment in actions.ts for why.
 */
/**
 * `formError` is for problems that belong to the submission rather than to any
 * one field — being rate limited, most of all. Those used to be reported
 * against `request_text`, which put a message about sending too many requests
 * behind a link to the textarea and implied the wording was at fault.
 */
export type RequestState =
  | {
      step: "form";
      values: RequestAnswers;
      errors: RequestFieldErrors;
      formError?: string;
    }
  | { step: "review"; values: RequestAnswers; formError?: string };

export const EMPTY_ANSWERS: RequestAnswers = {
  requester_name: "",
  requester_email: "",
  request_text: "",
};

/** Lives here rather than in actions.ts: a "use server" module may only export
 *  async functions. */
export const INITIAL_STATE: RequestState = {
  step: "form",
  values: EMPTY_ANSWERS,
  errors: {},
};

/** Field order drives the error summary, which GDS requires to list errors in
 *  the same order the fields appear on the page. */
export const FIELD_ORDER: (keyof RequestAnswers)[] = [
  "requester_name",
  "requester_email",
  "request_text",
];

export const FIELD_LABELS: Record<keyof RequestAnswers, string> = {
  requester_name: "Your name",
  requester_email: "Email address",
  request_text: "What information do you want?",
};

/** Must match `MAX_REQUEST_CHARS` in `apps/cases/submissions.py`.
 *
 *  The backend is what enforces this — the character count component
 *  deliberately does not stop someone typing past the limit, because silently
 *  truncating what a requester wrote is worse than telling them it is too long. */
export const MAX_REQUEST_CHARS = 20000;

/** Name of the honeypot input. Not part of `RequestAnswers`, so it can never
 *  reach the check-answers screen or the summary list. */
export const HONEYPOT_FIELD = "website";
