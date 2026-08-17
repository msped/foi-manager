interface AiPanelProps {
  title?: string;
  micro?: string;
  children: React.ReactNode;
}

/**
 * Highlighted aside for AI-generated content. The Design System has no
 * component for this, so it uses inset text — which is what GDS recommends for
 * drawing attention to a block of related information.
 */
export default function AiPanel({
  title = "AI assistant",
  micro,
  children,
}: AiPanelProps) {
  return (
    <div className="govuk-inset-text">
      <h2 className="govuk-heading-s govuk-!-margin-bottom-1">{title}</h2>
      {micro && <p className="govuk-hint govuk-!-margin-bottom-2">{micro}</p>}
      {children}
    </div>
  );
}
