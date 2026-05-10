interface AvatarProps {
  initials: string;
  name?: string;
  size?: "default" | "sm" | "xs";
}

export default function Avatar({ initials, name, size = "default" }: AvatarProps) {
  const cls = [
    "foi-avatar",
    size === "sm" && "foi-avatar-sm",
    size === "xs" && "foi-avatar-xs",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} title={name} aria-label={name}>
      {initials}
    </span>
  );
}
