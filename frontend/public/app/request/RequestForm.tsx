"use client";

import { useActionState, useEffect, useRef } from "react";
import { requestAction } from "./actions";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  HONEYPOT_FIELD,
  INITIAL_STATE,
  MAX_REQUEST_CHARS,
  type RequestAnswers,
  type RequestFieldErrors,
} from "./types";

function ErrorSummary({
  errors,
  formError,
  summaryRef,
}: {
  errors: RequestFieldErrors;
  formError?: string;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const listed = FIELD_ORDER.filter((field) => errors[field]);
  if (listed.length === 0 && !formError) return null;

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
            {/* Listed first, and without a link: it belongs to the submission
                rather than to a field, so there is no input to send anyone to. */}
            {formError && <li>{formError}</li>}
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

/**
 * Hidden from browsers by `display: none` and from assistive technology by
 * `aria-hidden`, so nobody using this service should ever encounter it.
 *
 * Hiding it from screen readers as well as from sighted users is the point.
 * The usual visually-hidden treatment would leave it in the accessibility tree,
 * where a screen reader would announce it as a real field and its user would
 * dutifully fill it in — turning an anti-spam measure into a trap for the
 * people least able to afford one.
 */
function Honeypot() {
  return (
    <div style={{ display: "none" }} aria-hidden="true">
      <label htmlFor={HONEYPOT_FIELD}>
        Leave this field blank
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </label>
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
  const hasErrors = Object.keys(errors).length > 0 || Boolean(state.formError);

  // Move focus the way govuk-frontend would: to the error summary when the
  // submission fails, and to the new heading when the step changes.
  useEffect(() => {
    if (hasErrors) summaryRef.current?.focus();
    else headingRef.current?.focus();
  }, [hasErrors, state.step]);

  // Enhance the character count whenever the form step is on screen.
  //
  // GovukInit only re-runs initAll on a change of pathname, and both steps of
  // this form share one route. Returning from check-answers therefore mounts a
  // brand new textarea that nothing has initialised, and the count would be
  // dead for the rest of the session. An element already enhanced throws
  // InitError, which is the expected case on first mount and is ignored.
  useEffect(() => {
    if (state.step !== "form") return;
    let cancelled = false;

    import("govuk-frontend").then(({ createAll, CharacterCount }) => {
      if (cancelled) return;
      createAll(CharacterCount, undefined, {
        onError: (error) => {
          if (error instanceof Error && error.name === "InitError") return;
          console.error(error);
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [state.step]);

  return (
    <form action={formAction} noValidate>
      <ErrorSummary
        errors={errors}
        formError={state.formError}
        summaryRef={summaryRef}
      />

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
            className={`govuk-character-count govuk-form-group${
              errors.request_text ? " govuk-form-group--error" : ""
            }`}
            data-module="govuk-character-count"
            data-maxlength={MAX_REQUEST_CHARS}
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
              className={`govuk-textarea govuk-js-character-count${
                errors.request_text ? " govuk-textarea--error" : ""
              }`}
              id="request_text"
              name="request_text"
              rows={8}
              defaultValue={state.values.request_text}
              aria-describedby={`request_text-hint${
                errors.request_text ? " request_text-error" : ""
              } request_text-info`}
            />
            {/* Rendered server-side with the limit already in it, so without
                JavaScript this stays a plain, true statement of the limit
                rather than disappearing. The live count replaces it on
                enhancement. */}
            <div id="request_text-info" className="govuk-hint govuk-character-count__message">
              You can enter up to {MAX_REQUEST_CHARS.toLocaleString("en-GB")}{" "}
              characters
            </div>
          </div>

          <Honeypot />

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
