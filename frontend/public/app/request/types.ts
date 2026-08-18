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
export type RequestState =
  | { step: "form"; values: RequestAnswers; errors: RequestFieldErrors }
  | { step: "review"; values: RequestAnswers };

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
