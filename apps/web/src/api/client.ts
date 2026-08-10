function responseErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string") return body.trim() || fallback;
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  for (const key of ["message", "detail", "error"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") {
      const nested = responseErrorMessage(value, "");
      if (nested) return nested;
    }
  }

  const issues = record.issues;
  if (Array.isArray(issues)) {
    const first = issues[0] as { message?: unknown; path?: unknown } | undefined;
    if (first && typeof first.message === "string") {
      const path = Array.isArray(first.path) ? first.path.filter((part) => typeof part === "string" || typeof part === "number").join(".") : "";
      return path ? `${path}: ${first.message}` : first.message;
    }
  }
  return fallback;
}

export async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = responseErrorMessage(body, message);
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
