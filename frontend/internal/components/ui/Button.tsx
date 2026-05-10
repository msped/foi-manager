import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "warning";
type Size = "default" | "small";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
}

export default function Button({
  variant = "primary",
  size = "default",
  href,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    "govuk-button",
    variant === "secondary" && "govuk-button--secondary",
    variant === "warning" && "govuk-button--warning",
    size === "small" && "govuk-button--small",
    "govuk-!-margin-bottom-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={classes} role="button">
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
