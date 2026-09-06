import Link from "next/link";
import AiPanel from "@/components/ui/AiPanel";
import { fmtDate } from "@/lib/utils";
import type { CaseInsights, SimilarCase } from "@/lib/types";

const secondary = { color: "var(--govuk-secondary-text-colour)" };

/**
 * One similar case: what was asked, what happened to it, and under what.
 *
 * Deliberately nothing about who asked — this panel answers what was decided
 * and why, and the requester bears on neither.
 *
 * No age badge either. Results are not date-filtered, precedent does not
 * expire, and marking recent cases implied a time bound retrieval never had.
 * The received date sits in the metadata line for anyone who wants it.
 *
 * No exemption tags per row. They repeated what the frequency counts below
 * say across the whole set, and stacked a wrapping row of tags under every
 * result — which ran the entries together and made the list hard to read. The
 * case link is one click from the full detail.
 *
 * Opens in a new tab, which is a deliberate exception to the Design System's
 * advice against it. This panel sits beside an internal note field and a
 * response draft, neither of which is autosaved or guarded by a beforeunload
 * handler — both are plain component state. Navigating away mid-sentence
 * therefore discards the officer's typing with no warning, and losing work is
 * a worse harm than an unexpected tab. The proper fix is to persist those
 * drafts; until then this avoids the data loss rather than hiding it.
 *
 * Announced two ways, because the Design System requires it wherever this is
 * done: once visibly above the list for sighted users, and per link for screen
 * readers, who commonly move link-by-link and never hear the intro.
 */
function SimilarCaseRow({ c }: { c: SimilarCase }) {
  return (
    <li className="govuk-!-margin-bottom-4">
      <Link
        href={`/cases/${c.id}`}
        className="govuk-link"
        target="_blank"
        rel="noopener"
      >
        {c.ref}
        <span className="govuk-visually-hidden"> (opens in new tab)</span>
      </Link>
      {" — "}
      <span className="govuk-body-s">{c.preview}</span>
      <div className="govuk-body-s" style={{ ...secondary, marginBottom: 0 }}>
        {c.status_display}
        {c.outcome_display ? ` · ${c.outcome_display}` : ""}
        {c.submitted_at ? ` · received ${fmtDate(c.submitted_at)}` : ""}
      </div>
    </li>
  );
}

/**
 * Precedent and exemption history.
 *
 * Titled for what it does. The placeholder this replaced was headed "Risk &
 * precedent / AI assessment", which claimed an assessment; nothing here
 * assesses anything. It searches past requests and counts what was decided.
 *
 * One list of cases, with nothing said about publication. Precedent was
 * briefly split into published and unpublished lists, then merged with a tag
 * marking the published ones; both drew a line an officer has no use for.
 * Publication is decided after a response is sent, by someone else, and says
 * nothing about how the request was handled — which is the only question this
 * panel answers. The case itself shows its disclosure log status.
 *
 * No similarity scores, and no predicted exemptions. The frequencies are a
 * count of what was claimed on comparable requests before — evidence to weigh,
 * not a recommendation. An exemption turns on the specific information and the
 * circumstances at the time of the request, neither of which is captured by one
 * request resembling another, and the officer has to defend the decision at
 * internal review.
 *
 * A result appears only when vector similarity and keyword search both find
 * it, so an empty panel is a real answer and often the right one.
 */
export default function CaseInsightsPanel({ insights }: { insights: CaseInsights }) {
  const cases = insights.similar_cases;
  const frequencies = insights.exemption_frequencies;

  return (
    <AiPanel title="Precedent and history" micro="Search results — not advice">
      {!insights.indexed && (
        <p className="govuk-body-s" style={secondary}>
          This case has not been indexed yet. Precedent appears once indexing has
          run.
        </p>
      )}

      {insights.indexed && cases.length === 0 && (
        <p className="govuk-body-s" style={secondary}>
          No comparable requests found.
        </p>
      )}

      {cases.length > 0 && (
        <>
          <h3 className="govuk-heading-s govuk-!-margin-bottom-1">
            Similar past requests
          </h3>
          <p className="govuk-body-s govuk-!-margin-bottom-2" style={secondary}>
            These open in a new tab, so you will not lose anything you have typed.
          </p>
          <ul className="govuk-list govuk-!-margin-bottom-4">
            {cases.map(c => (
              <SimilarCaseRow key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}

      {frequencies.length > 0 && (
        <>
          <h3 className="govuk-heading-s govuk-!-margin-bottom-1">
            Exemptions claimed on these requests
          </h3>
          <ul className="govuk-list govuk-!-margin-bottom-3">
            {frequencies.map(f => (
              <li key={f.code} className="govuk-body-s govuk-!-margin-bottom-2">
                <strong>{f.code_display}</strong>
                <br />
                <span style={secondary}>
                  Claimed on {f.count} of {f.case_count} comparable{" "}
                  {f.case_count === 1 ? "case" : "cases"}
                </span>
              </li>
            ))}
          </ul>
          <p className="govuk-body-s" style={{ ...secondary, marginBottom: 0 }}>
            A count of past decisions, not a suggestion for this one. Apply the
            public interest test where relevant.
          </p>
        </>
      )}
    </AiPanel>
  );
}
