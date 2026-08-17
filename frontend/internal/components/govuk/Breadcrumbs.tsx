import Link from "next/link";

export interface Crumb {
  href?: string;
  text: string;
}

/** Port of govuk-frontend's breadcrumbs component (v6.1.0). */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="govuk-breadcrumbs" aria-label="Breadcrumb">
      <ol className="govuk-breadcrumbs__list">
        {items.map((item) => (
          <li key={item.text} className="govuk-breadcrumbs__list-item" aria-current={item.href ? undefined : "page"}>
            {item.href ? (
              <Link className="govuk-breadcrumbs__link" href={item.href}>
                {item.text}
              </Link>
            ) : (
              item.text
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
