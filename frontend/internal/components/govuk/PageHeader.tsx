import Breadcrumbs, { type Crumb } from "./Breadcrumbs";

interface PageHeaderProps {
  title: string;
  /** Small text above the title, e.g. the case reference. */
  caption?: string;
  breadcrumbs?: Crumb[];
  /** Buttons or links shown alongside the title. */
  actions?: React.ReactNode;
}

export default function PageHeader({ title, caption, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="foi-page-header">
        <h1 className="govuk-heading-l">
          {caption && <span className="govuk-caption-l">{caption}</span>}
          {title}
        </h1>
        {actions && <div className="foi-page-header__actions">{actions}</div>}
      </div>
    </>
  );
}
