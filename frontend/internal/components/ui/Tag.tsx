import type { CaseStatus } from "@/lib/types";
import { STATUS_META } from "@/lib/utils";

type GovukTagColour =
  | "grey" | "green" | "turquoise" | "blue" | "light-blue"
  | "purple" | "pink" | "red" | "orange" | "yellow";

interface TagProps {
  colour?: GovukTagColour;
  children: React.ReactNode;
}

export function Tag({ colour, children }: TagProps) {
  const cls = ["govuk-tag", colour && `govuk-tag--${colour}`]
    .filter(Boolean)
    .join(" ");
  return <strong className={cls}>{children}</strong>;
}

interface StatusTagProps {
  status: CaseStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  const meta = STATUS_META[status] ?? { label: status, govukColour: "grey" };
  return (
    <Tag colour={meta.govukColour as GovukTagColour}>{meta.label}</Tag>
  );
}
