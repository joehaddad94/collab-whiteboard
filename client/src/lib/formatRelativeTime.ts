function parseSqliteUtc(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

export function formatRelativeTime(value: string): string {
  const then = parseSqliteUtc(value);
  if (Number.isNaN(then.getTime())) return "";

  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;

  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatAbsoluteTime(value: string): string {
  const then = parseSqliteUtc(value);
  if (Number.isNaN(then.getTime())) return "";
  return then.toLocaleString();
}
