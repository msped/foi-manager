import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import Pagination from "@/components/govuk/Pagination";
import {
  getDisclosureLogFilters,
  listDisclosureLog,
} from "@/lib/services/publications";
import type { DisclosureLogFilters, DisclosureLogListItem, Paginated } from "@/lib/types";
import { fmtDate, PAGE_SIZE } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Disclosure log",
  description:
    "Search responses we have already given to Freedom of Information requests.",
};

interface SearchParams {
  search?: string;
  exemption?: string;
  year?: string;
  page?: string;
}

const EMPTY_FILTERS: DisclosureLogFilters = { exemptions: [], years: [] };

export default async function DisclosureLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const query = {
    search: params.search ?? "",
    exemption: params.exemption ?? "",
    year: params.year ?? "",
    page,
  };

  let results: Paginated<DisclosureLogListItem> | null = null;
  let filters = EMPTY_FILTERS;
  try {
    [results, filters] = await Promise.all([
      listDisclosureLog(query),
      // Filter options are a nicety; a failure here shouldn't lose the results.
      getDisclosureLogFilters().catch(() => EMPTY_FILTERS),
    ]);
  } catch {
    results = null;
  }

  /** Rebuilds the current query string with one value changed. */
  const hrefFor = (nextPage: number) => {
    const qs = new URLSearchParams();
    if (query.search) qs.set("search", query.search);
    if (query.exemption) qs.set("exemption", query.exemption);
    if (query.year) qs.set("year", query.year);
    if (nextPage > 1) qs.set("page", String(nextPage));
    const s = qs.toString();
    return s ? `/disclosure-log?${s}` : "/disclosure-log";
  };

  const hasFilters = Boolean(query.search || query.exemption || query.year);

  return (
    <>
      <Breadcrumbs items={[{ href: "/", text: "Home" }, { text: "Disclosure log" }]} />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-xl">Disclosure log</h1>
          <p className="govuk-body-l">
            Responses we have already given to Freedom of Information requests.
            The information you want may already be here.
          </p>

          <div className="govuk-inset-text">
            This is not the same as our{" "}
            <Link className="govuk-link" href="/publication-scheme">
              publication scheme
            </Link>
            . The disclosure log is our answers to specific requests other people
            have made; the publication scheme is information we publish on our
            own initiative. It is worth checking both.
          </div>
        </div>
      </div>

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-one-third">
          {/* A plain GET form: results stay bookmarkable and the page keeps
              working with JavaScript unavailable. */}
          <form method="get" action="/disclosure-log">
            <h2 className="govuk-heading-m">Search and filter</h2>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="search">
                Keywords
              </label>
              <div id="search-hint" className="govuk-hint">
                Search titles, summaries and reference numbers.
              </div>
              <input
                className="govuk-input"
                id="search"
                name="search"
                type="search"
                aria-describedby="search-hint"
                defaultValue={query.search}
              />
            </div>

            {filters.exemptions.length > 0 && (
              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="exemption">
                  Exemption applied
                </label>
                <select
                  className="govuk-select govuk-!-width-full"
                  id="exemption"
                  name="exemption"
                  defaultValue={query.exemption}
                >
                  <option value="">All exemptions</option>
                  {filters.exemptions.map((e) => (
                    <option key={e.code} value={e.code}>
                      {e.code_display}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {filters.years.length > 0 && (
              <div className="govuk-form-group">
                <label className="govuk-label" htmlFor="year">
                  Year responded
                </label>
                <select
                  className="govuk-select"
                  id="year"
                  name="year"
                  defaultValue={query.year}
                >
                  <option value="">All years</option>
                  {filters.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button className="govuk-button" data-module="govuk-button" type="submit">
              Apply filters
            </button>

            {hasFilters && (
              <p className="govuk-body">
                <Link className="govuk-link" href="/disclosure-log">
                  Clear all filters
                </Link>
              </p>
            )}
          </form>
        </div>

        <div className="govuk-grid-column-two-thirds">
          {results === null ? (
            <>
              <h2 className="govuk-heading-m">Sorry, the disclosure log is unavailable</h2>
              <p className="govuk-body">
                Try again later, or{" "}
                <Link className="govuk-link" href="/request">
                  make a request
                </Link>{" "}
                if you cannot find what you need.
              </p>
            </>
          ) : results.count === 0 ? (
            <>
              <h2 className="govuk-heading-m">No results found</h2>
              <p className="govuk-body">
                {hasFilters
                  ? "Try removing a filter or searching for a broader term."
                  : "Nothing has been published to the disclosure log yet."}
              </p>
              <p className="govuk-body">
                If the information you want is not here, you can{" "}
                <Link className="govuk-link" href="/request">
                  make a Freedom of Information request
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <h2 className="govuk-heading-m">
                {results.count} {results.count === 1 ? "response" : "responses"}
              </h2>

              <ul className="govuk-list">
                {results.results.map((entry) => (
                  <li key={entry.id} className="govuk-!-margin-bottom-6">
                    <h3 className="govuk-heading-s govuk-!-margin-bottom-1">
                      <Link
                        className="govuk-link"
                        href={`/disclosure-log/${entry.id}`}
                      >
                        {entry.title || entry.case_ref}
                      </Link>
                    </h3>
                    <p className="govuk-body-s govuk-!-margin-bottom-1">
                      <span className="govuk-visually-hidden">Reference </span>
                      {entry.case_ref} &middot; Responded{" "}
                      {fmtDate(entry.date_responded)}
                    </p>
                    {entry.summary && (
                      <p className="govuk-body govuk-!-margin-bottom-1">
                        {entry.summary}
                      </p>
                    )}
                    {entry.exemptions.length > 0 && (
                      <p className="govuk-body-s govuk-!-margin-bottom-0">
                        {entry.exemptions.map((e) => (
                          <strong
                            key={e.code}
                            className="govuk-tag govuk-tag--grey govuk-!-margin-right-1"
                          >
                            {e.code}
                          </strong>
                        ))}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <Pagination
                current={page}
                total={Math.ceil(results.count / PAGE_SIZE)}
                hrefFor={hrefFor}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
