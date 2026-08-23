import type { Metadata } from "next";
import Link from "next/link";
import ContactEmail from "@/components/ContactEmail";
import { contact } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * Serves both `notFound()` and any URL the app does not match, so it has to
 * read sensibly for someone who mistyped an address and for someone following
 * a link to a disclosure log entry that is no longer published.
 *
 * The second case is why this offers the log's search rather than only the
 * home page: a withdrawn entry is exactly when someone needs another route to
 * the same information.
 */
export default function NotFound() {
  return (
    <div className="govuk-grid-row">
      <div className="govuk-grid-column-two-thirds">
        <h1 className="govuk-heading-xl">Page not found</h1>

        <p className="govuk-body">
          If you typed the web address, check it is correct.
        </p>

        <p className="govuk-body">
          If you pasted the web address, check you copied the whole address.
        </p>

        <p className="govuk-body">
          If you were looking for a published response, it may have been
          withdrawn, or its address may have changed. Search the{" "}
          <Link className="govuk-link" href="/disclosure-log">
            disclosure log
          </Link>{" "}
          to see whether it is still there under a different reference.
        </p>

        <p className="govuk-body">
          You can also{" "}
          <Link className="govuk-link" href="/request">
            make a Freedom of Information request
          </Link>{" "}
          or{" "}
          <Link className="govuk-link" href="/">
            go to the start of the service
          </Link>
          .
        </p>

        <p className="govuk-body">
          If the address is correct, or you followed a link to get here, contact{" "}
          <ContactEmail email={contact.foiEmail} /> and tell us what you were
          looking for.
        </p>
      </div>
    </div>
  );
}
