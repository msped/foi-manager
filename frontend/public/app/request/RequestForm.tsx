"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestAction } from "./actions";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  INITIAL_STATE,
  type RequestAnswers,
  type RequestFieldErrors,
} from "./types";

function ErrorSummary({
  errors,
  summaryRef,
}: {
  errors: RequestFieldErrors;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const listed = FIELD_ORDER.filter((field) => errors[field]);
  if (listed.length === 0) return null;

  return (
    <div
      className="govuk-error-summary"
      // Focused from the effect below rather than by govuk-frontend's own
      // module: the action re-renders in place, so initAll never runs again.
      tabIndex={-1}
      ref={summaryRef}
    >
      <div role="alert">
        <h2 className="govuk-error-summary__title">There is a problem</h2>
        <div className="govuk-error-summary__body">
          <ul className="govuk-list govuk-error-summary__list">
            {listed.map((field) => (
              <li key={field}>
                <a href={`#${field}`}>{errors[field]}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CheckAnswers({ values }: { values: RequestAnswers }) {
  return (
    <>
      <h1 className="govuk-heading-l">Check your answers before sending</h1>

      <dl className="govuk-summary-list">
        {FIELD_ORDER.map((field) => (
          <div key={field} className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{FIELD_LABELS[field]}</dt>
            <dd className="govuk-summary-list__value">
              {/* Preserves the requester's own line breaks. */}
              <span style={{ whiteSpace: "pre-wrap" }}>{values[field]}</span>
            </dd>
            <dd className="govuk-summary-list__actions">
              {/* A submit button rather than a link, so the answers travel back
                  to the form in the POST body and survive without JavaScript. */}
              <button type="submit" name="intent" value="back" className="govuk-link">
                Change<span className="govuk-visually-hidden"> {FIELD_LABELS[field]}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="govuk-heading-m">Now send your request</h2>
      <p className="govuk-body">
        By sending this request you confirm the name you have given is your real
        name. We will reply to the email address above.
      </p>

      <button
        type="submit"
        name="intent"
        value="submit"
        className="govuk-button"
        data-module="govuk-button"
      >
        Accept and send
      </button>
    </>
  );
}

export default function RequestForm() {
  const [state, formAction, pending] = useActionState(requestAction, INITIAL_STATE);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const errors = state.step === "form" ? state.errors : {};
  const hasErrors = Object.keys(errors).length > 0;

  // Move focus the way govuk-frontend would: to the error summary when the
  // submission fails, and to the new heading when the step changes.
  useEffect(() => {
    if (hasErrors) summaryRef.current?.focus();
    else headingRef.current?.focus();
  }, [hasErrors, state.step]);

  return (
    <form action={formAction} noValidate>
      <ErrorSummary errors={errors} summaryRef={summaryRef} />

      {state.step === "review" ? (
        <>
          {/* Carries the answers forward without a cookie or a size limit. */}
          {FIELD_ORDER.map((field) => (
            <input key={field} type="hidden" name={field} value={state.values[field]} />
          ))}
          <div ref={headingRef as React.RefObject<HTMLDivElement>} tabIndex={-1}>
            <CheckAnswers values={state.values} />
          </div>
        </>
      ) : (
        <div ref={headingRef as React.RefObject<HTMLDivElement>} tabIndex={-1}>
          <h1 className="govuk-heading-l">Make a Freedom of Information request</h1>

          <div
            className={`govuk-form-group${
              errors.requester_name ? " govuk-form-group--error" : ""
            }`}
          >
            <label className="govuk-label" htmlFor="requester_name">
              {FIELD_LABELS.requester_name}
            </label>
            <div id="requester_name-hint" className="govuk-hint">
              You must use your real name. We cannot accept requests made under a
              pseudonym.
            </div>
            {errors.requester_name && (
              <p id="requester_name-error" className="govuk-error-message">
                <span className="govuk-visually-hidden">Error:</span>{" "}
                {errors.requester_name}
              </p>
            )}
            <input
              className={`govuk-input${
                errors.requester_name ? " govuk-input--error" : ""
              }`}
              id="requester_name"
              name="requester_name"
              type="text"
              autoComplete="name"
              defaultValue={state.values.requester_name}
              aria-describedby={`requester_name-hint${
                errors.requester_name ? " requester_name-error" : ""
              }`}
            />
          </div>

          <div
            className={`govuk-form-group${
              errors.requester_email ? " govuk-form-group--error" : ""
            }`}
          >
            <label className="govuk-label" htmlFor="requester_email">
              {FIELD_LABELS.requester_email}
            </label>
            <div id="requester_email-hint" className="govuk-hint">
              We will send our response here. You do not need to give us a postal
              address.
            </div>
            {errors.requester_email && (
              <p id="requester_email-error" className="govuk-error-message">
                <span className="govuk-visually-hidden">Error:</span>{" "}
                {errors.requester_email}
              </p>
            )}
            <input
              className={`govuk-input${
                errors.requester_email ? " govuk-input--error" : ""
              }`}
              id="requester_email"
              name="requester_email"
              type="email"
              spellCheck={false}
              autoComplete="email"
              defaultValue={state.values.requester_email}
              aria-describedby={`requester_email-hint${
                errors.requester_email ? " requester_email-error" : ""
              }`}
            />
          </div>

          <div
            className={`govuk-form-group${
              errors.request_text ? " govuk-form-group--error" : ""
            }`}
          >
            <label className="govuk-label" htmlFor="request_text">
              {FIELD_LABELS.request_text}
            </label>
            <div id="request_text-hint" className="govuk-hint">
              Describe the information you want as precisely as you can. You do
              not have to say why you want it. If we are not sure what you have
              asked for, we will come back to you, and the 20 working days start
              again from your reply.
            </div>
            {errors.request_text && (
              <p id="request_text-error" className="govuk-error-message">
                <span className="govuk-visually-hidden">Error:</span>{" "}
                {errors.request_text}
              </p>
            )}
            <textarea
              className={`govuk-textarea${
                errors.request_text ? " govuk-textarea--error" : ""
              }`}
              id="request_text"
              name="request_text"
              rows={8}
              defaultValue={state.values.request_text}
              aria-describedby={`request_text-hint${
                errors.request_text ? " request_text-error" : ""
              }`}
            />
          </div>

          <button
            type="submit"
            name="intent"
            value="review"
            className="govuk-button"
            data-module="govuk-button"
            disabled={pending}
          >
            Continue
          </button>
        </div>
      )}
    </form>
  );
}
