interface SummaryCardProps {
  title: React.ReactNode;
  /** Heading level for the card title. Defaults to h2. */
  headingLevel?: 2 | 3;
  /** Controls shown alongside the title. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Port of govuk-frontend's summary card (v6.1.0). */
export default function SummaryCard({
  title,
  headingLevel = 2,
  actions,
  children,
}: SummaryCardProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <div className="govuk-summary-card">
      <div className="govuk-summary-card__title-wrapper">
        <Heading className="govuk-summary-card__title">{title}</Heading>
        {actions && <div className="govuk-summary-card__actions">{actions}</div>}
      </div>
      <div className="govuk-summary-card__content">{children}</div>
    </div>
  );
}
