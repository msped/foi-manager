interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export default function FormField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: FormFieldProps) {
  return (
    <div className={`govuk-form-group${error ? " govuk-form-group--error" : ""}`}>
      <label className="govuk-label govuk-label--s" htmlFor={htmlFor}>
        {label}
      </label>
      {hint && <div className="govuk-hint">{hint}</div>}
      {error && <p className="govuk-error-message"><span className="govuk-visually-hidden">Error:</span> {error}</p>}
      {children}
    </div>
  );
}
