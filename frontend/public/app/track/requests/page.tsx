import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import SummaryCard from "@/components/govuk/SummaryCard";
import { getTrackedCases } from "@/lib/services/tracking";
import type { TrackedCase, TrackedCases } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { finishSession } from "../actions";
import { SESSION_COOKIE } from "../types";

export const metadata: Metadata = {
  title: "Your requests",
  robots: { index: false, follow: false },
};

/**
 * A real route rather than another state of /track.
 *
 * People refresh a status page — to see whether anything has changed, or after
 * leaving it open on a shared computer. Server action state does not survive a
 * reload, so a status screen built that way would throw them back to the start
 * every time. Reading the session cookie in a server component means refresh
 * just works, and back/forward do too.
 */

async function fetchCases(token: string): Promise<TrackedCases> {
  try {
    return await getTrackedCases(token);
  } catch {
    // Almost always the hour elapsing. Nothing here can be shown without a
    // valid session, so send them back to verify rather than rendering a shell.
    redirect("/track");
  }
}

function Deadline({ item }: { item: TrackedCase }) {
  if (item.clock_paused) {
    return (
      <>
        <p className="govuk-body govuk-!-margin-bottom-1">
          Paused while we wait for your reply.
        </p>
        <p className="govuk-body-s govuk-!-margin-bottom-0">
          We will give you a new date once you have replied.
        </p>
      </>
    );
  }

  if (!item.statutory_deadline) {
    return <p className="govuk-body govuk-!-margin-bottom-0">—</p>;
  }

  return (
    <p className="govuk-body govuk-!-margin-bottom-0">
      {fmtDate(item.statutory_deadline)}
      {item.is_overdue && (
        <>
          {" "}
          <strong className="govuk-tag govuk-tag--red">Overdue</strong>
        </>
      )}
    </p>
  );
}

function RequestCard({ item }: { item: TrackedCase }) {
  return (
    <SummaryCard
      title={item.ref}
      actions={<strong className="govuk-tag">{item.status}</strong>}
    >
      <dl className="govuk-summary-list">
        <div className="govuk-summary-list__row">
          <dt className="govuk-summary-list__key">What you asked for</dt>
          <dd className="govuk-summary-list__value">
            {/* The requester's own words and their own line breaks. */}
            <span style={{ whiteSpace: "pre-wrap" }}>{item.request_text}</span>
          </dd>
        </div>
        <div className="govuk-summary-list__row">
          <dt className="govuk-summary-list__key">Received</dt>
          <dd className="govuk-summary-list__value">
            {fmtDate(item.submitted_at)}
          </dd>
        </div>
        <div className="govuk-summary-list__row">
          <dt className="govuk-summary-list__key">Reply due by</dt>
          <dd className="govuk-summary-list__value">
            <Deadline item={item} />
          </dd>
        </div>
        {item.outcome && (
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">Outcome</dt>
            <dd className="govuk-summary-list__value">{item.outcome}</dd>
          </div>
        )}
        {item.disclosure_log_id && (
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">Published</dt>
            <dd className="govuk-summary-list__value">
              <Link
                className="govuk-link"
                href={`/disclosure-log/${item.disclosure_log_id}`}
              >
                Read our response in the disclosure log
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </SummaryCard>
  );
}

export default async function TrackedRequestsPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/track");

  const { email, results } = await fetchCases(token);
  const anyOverdue = results.some((r) => r.is_overdue);

  return (
    <>
      <Breadcrumbs
        items={[
          { href: "/", text: "Home" },
          { href: "/track", text: "Check a request" },
          { text: "Your requests" },
        ]}
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-l">Your requests</h1>

          <p className="govuk-body">
            Requests made from <strong>{email}</strong>.
          </p>

          {results.length === 0 ? (
            <p className="govuk-body">
              We have no requests from this email address.
            </p>
          ) : (
            results.map((item) => <RequestCard key={item.ref} item={item} />)
          )}

          <h2 className="govuk-heading-m">We do not send responses from here</h2>
          <p className="govuk-body">
            This page shows progress only. We reply to your request by email, to
            the address above. If a response has been published, you will find a
            link to it against the request.
          </p>

          {anyOverdue && (
            <>
              {/* Static copy, never a per-case field. Staff free text on a
                  public page is an unreviewed publication channel, and the Act
                  gives no resourcing excuse for lateness — so this says what the
                  requester can do about it, and does not make excuses. */}
              <h2 className="govuk-heading-m">If we have missed the deadline</h2>
              <p className="govuk-body">
                We should respond within 20 working days. If we have not, you
                can ask us to carry out an internal review by replying to any
                email we have sent you about your request.
              </p>
              <p className="govuk-body">
                If you are still unhappy after an internal review, you can
                complain to the{" "}
                <a
                  className="govuk-link"
                  href="https://ico.org.uk/make-a-complaint/"
                  rel="noreferrer"
                >
                  Information Commissioner&rsquo;s Office
                </a>
                .
              </p>
            </>
          )}

          <hr className="govuk-section-break govuk-section-break--l govuk-section-break--visible" />

          {/* An explicit end to the session, because a shared computer is the
              normal case for a good number of FOI requesters. */}
          <form action={finishSession}>
            <button
              type="submit"
              className="govuk-button govuk-button--secondary"
              data-module="govuk-button"
            >
              Finish
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
