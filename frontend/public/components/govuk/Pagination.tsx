import Link from "next/link";

const ARROW_PREV = (
  <svg
    className="govuk-pagination__icon govuk-pagination__icon--prev"
    xmlns="http://www.w3.org/2000/svg"
    height="13"
    width="15"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 15 13"
  >
    <path d="m6.5938-0.0078125-6.7266 6.7266 6.7441 6.4062 1.377-1.449-4.1856-3.9768h12.896v-2h-12.984l4.2931-4.293-1.414-1.414z" />
  </svg>
);

const ARROW_NEXT = (
  <svg
    className="govuk-pagination__icon govuk-pagination__icon--next"
    xmlns="http://www.w3.org/2000/svg"
    height="13"
    width="15"
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 15 13"
  >
    <path d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z" />
  </svg>
);

/**
 * Which page numbers to render. GDS shows the first and last page always, plus
 * a window around the current one, with ellipses standing in for the gaps.
 * `null` marks an ellipsis.
 */
function pageItems(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const shown = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const items: (number | null)[] = [];
  let previous = 0;
  for (const page of shown) {
    if (previous && page - previous > 1) items.push(null);
    items.push(page);
    previous = page;
  }
  return items;
}

interface PaginationProps {
  current: number;
  total: number;
  /** Builds the href for a page number, so the caller keeps its own filters. */
  hrefFor: (page: number) => string;
}

/** Port of govuk-frontend's pagination component (v6.1.0). */
export default function Pagination({ current, total, hrefFor }: PaginationProps) {
  if (total <= 1) return null;

  return (
    <nav className="govuk-pagination" aria-label="Pagination">
      {current > 1 && (
        <div className="govuk-pagination__prev">
          <Link
            className="govuk-link govuk-pagination__link"
            href={hrefFor(current - 1)}
            rel="prev"
          >
            {ARROW_PREV}
            <span className="govuk-pagination__link-title">
              Previous<span className="govuk-visually-hidden"> page</span>
            </span>
          </Link>
        </div>
      )}

      <ul className="govuk-pagination__list">
        {pageItems(current, total).map((page, i) =>
          page === null ? (
            <li
              key={`ellipsis-${i}`}
              className="govuk-pagination__item govuk-pagination__item--ellipsis"
            >
              &ctdot;
            </li>
          ) : (
            <li
              key={page}
              className={`govuk-pagination__item${
                page === current ? " govuk-pagination__item--current" : ""
              }`}
            >
              <Link
                className="govuk-link govuk-pagination__link"
                href={hrefFor(page)}
                aria-label={`Page ${page}`}
                aria-current={page === current ? "page" : undefined}
              >
                {page}
              </Link>
            </li>
          )
        )}
      </ul>

      {current < total && (
        <div className="govuk-pagination__next">
          <Link
            className="govuk-link govuk-pagination__link"
            href={hrefFor(current + 1)}
            rel="next"
          >
            <span className="govuk-pagination__link-title">
              Next<span className="govuk-visually-hidden"> page</span>
            </span>
            {ARROW_NEXT}
          </Link>
        </div>
      )}
    </nav>
  );
}
