"use client";

import { useActionState, useEffect, useRef } from "react";
import { trackAction } from "./actions";
import { INITIAL_STATE } from "./types";

function ErrorSummary({
  error,
  field,
  summaryRef,
}: {
  error?: string;
  field: string;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!error) return null;

  return (
    <div
      className="govuk-error-summary"
      // Focused from the effect below rather than by govuk-frontend's own
      // module: GovukInit only re-runs initAll on a pathname change, and both
      // steps here live on one path.
      tabIndex={-1}
      ref={summaryRef}
    >
      <div role="alert">
        <h2 className="govuk-error-summary__title">There is a problem</h2>
        <div className="govuk-error-summary__body">
          <ul className="govuk-list govuk-error-summary__list">
            <li>
              <a href={`#${field}`}>{error}</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function TrackForm() {
  const [state, formAction, pending] = useActionState(trackAction, INITIAL_STATE);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (state.error) summaryRef.current?.focus();
    else headingRef.current?.focus();
  }, [state.error, state.step]);

  const field = state.step === "email" ? "email" : "code";

  return (
    <form action={formAction} noValidate>
      <ErrorSummary error={state.error} field={field} summaryRef={summaryRef} />

      {state.step === "email" ? (
        <div ref={headingRef} tabIndex={-1}>
          <h1 className="govuk-heading-l">Check a request</h1>

          <p className="govuk-body">
            Enter the email address you used to make your request. We will send
            you a code to confirm it is you.
          </p>

          <div
            className={`govuk-form-group${
              state.error ? " govuk-form-group--error" : ""
            }`}
          >
            <label className="govuk-label" htmlFor="email">
              Email address
            </label>
            <div id="email-hint" className="govuk-hint">
              You do not need your reference number.
            </div>
            {state.error && (
              <p id="email-error" className="govuk-error-message">
                <span className="govuk-visually-hidden">Error:</span>{" "}
                {state.error}
              </p>
            )}
            <input
              className={`govuk-input${state.error ? " govuk-input--error" : ""}`}
              id="email"
              name="email"
              type="email"
              spellCheck={false}
              autoComplete="email"
              defaultValue={state.email}
              aria-describedby={`email-hint${state.error ? " email-error" : ""}`}
            />
          </div>

          <button
            type="submit"
            name="intent"
            value="request-code"
            className="govuk-button"
            data-module="govuk-button"
            disabled={pending}
          >
            Send me a code
          </button>
        </div>
      ) : (
        <>
          {/* Carries the address to the next step without a cookie. */}
          <input type="hidden" name="email" value={state.email} />

          <div ref={headingRef} tabIndex={-1}>
            <h1 className="govuk-heading-l">Enter your code</h1>

            {state.notice && <p className="govuk-body">{state.notice}</p>}

            <p className="govuk-body">
              The code expires in 15 minutes. It may take a few minutes to
              arrive — check your spam folder before asking for another.
            </p>

            <div
              className={`govuk-form-group${
                state.error ? " govuk-form-group--error" : ""
              }`}
            >
              <label className="govuk-label" htmlFor="code">
                Confirmation code
              </label>
              {state.error && (
                <p id="code-error" className="govuk-error-message">
                  <span className="govuk-visually-hidden">Error:</span>{" "}
                  {state.error}
                </p>
              )}
              <input
                className={`govuk-input govuk-input--width-10${
                  state.error ? " govuk-input--error" : ""
                }`}
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                // Lets a phone or password manager offer the code from the
                // email rather than making people retype it.
                autoComplete="one-time-code"
                spellCheck={false}
                aria-describedby={state.error ? "code-error" : undefined}
              />
            </div>

            <button
              type="submit"
              name="intent"
              value="verify"
              className="govuk-button"
              data-module="govuk-button"
              disabled={pending}
            >
              Continue
            </button>

            {/* Submit buttons rather than links, so both work without
                JavaScript and keep the address in the POST body. */}
            <p className="govuk-body">
              <button type="submit" name="intent" value="resend" className="govuk-link">
                Send me a new code
              </button>
            </p>
            <p className="govuk-body">
              <button
                type="submit"
                name="intent"
                value="change-email"
                className="govuk-link"
              >
                Use a different email address
              </button>
            </p>
          </div>
        </>
      )}
    </form>
  );
}
