function messageFrom(value: unknown, seen = new Set<unknown>()): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value instanceof Error) return value.message.trim() || undefined;
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;

  seen.add(value);
  const record = value as Record<string, unknown>;
  return messageFrom(record.message, seen) || messageFrom(record.error, seen) || messageFrom(record.detail, seen);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return messageFrom(error) || fallback;
}
