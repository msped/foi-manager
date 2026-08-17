interface SkipLinkProps {
  href?: string;
  text?: string;
}

export default function SkipLink({
  href = "#main-content",
  text = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a href={href} className="govuk-skip-link" data-module="govuk-skip-link">
      {text}
    </a>
  );
}
