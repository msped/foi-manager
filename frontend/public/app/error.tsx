"use client";

import { useEffect } from "react";
import Link from "next/link";
import ContactEmail from "@/components/ContactEmail";
import { contact } from "@/lib/branding";

/**
 * Renders inside the root layout, so the header, footer and skip link stay put
 * — an error page that drops the furniture reads like a different site and
 * leaves no way out of it.
 *
 * Most failures never reach here. The disclosure log and publication scheme
 * catch their own fetch errors and render an unavailable state in place, and
 * the request and tracking actions turn a failed call into a form error that
 * keeps the answers on screen. This is the boundary for what those miss.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Server component errors arrive with their message stripped in
    // production; `digest` is the handle that matches this to the server log.
    console.error(error);
  }, [error]);

  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <h1 className="govuk-heading-xl">
          Sorry, there is a problem with the service
        </h1>

        <p className="govuk-body">Try again in a few minutes.</p>

        <p className="govuk-body">
          If you were part-way through writing a request, it has not been saved.
          You will need to enter it again. We are sorry — if you have your
          wording saved elsewhere, keep it until you have a reference number.
        </p>

        <button
          type="button"
          className="govuk-button"
          data-module="govuk-button"
          onClick={() => unstable_retry()}
        >
          Try again
        </button>

        <h2 className="govuk-heading-m">If you need to make a request now</h2>

        <p className="govuk-body">
          You do not have to use this website. A Freedom of Information request
          only has to be in writing, so an ordinary email is just as valid, and
          the 20 working days run from when we receive it either way. Email{" "}
          <ContactEmail email={contact.foiEmail} /> with your name and what you
          would like to know.
        </p>

        {contact.postalAddress && (
          <>
            <p className="govuk-body">You can also write to us:</p>
            <p className="govuk-body">
              {contact.postalAddress.map((line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ))}
            </p>
          </>
        )}

        <p className="govuk-body">
          <Link className="govuk-link" href="/">
            Go to the start of the service
          </Link>
        </p>
      </div>
    </div>
  );
}
