const AVATAR_COLORS = ["#2454ff", "#ff6b4a", "#14b8a6", "#f5a623", "#8b5cf6"];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  userId: number;
  size?: number;
  color?: string;
}

export function Avatar({ name, userId, size = 26, color }: AvatarProps) {
  const background = color ?? AVATAR_COLORS[userId % AVATAR_COLORS.length];

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.42, background }}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}
