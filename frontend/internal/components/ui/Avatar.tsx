interface AvatarProps {
  initials: string;
  name?: string;
  size?: "default" | "sm";
}

export default function Avatar({ initials, name, size = "default" }: AvatarProps) {
  const cls = ["foi-avatar", size === "sm" && "foi-avatar--sm"].filter(Boolean).join(" ");

  return (
    <span className={cls} title={name} aria-label={name}>
      {initials}
    </span>
  );
}
