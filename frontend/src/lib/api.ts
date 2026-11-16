export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Turn FastAPI error bodies (string detail or validation list) into one readable sentence. */
function readDetail(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { loc?: string[]; msg?: string };
    const field = first.loc?.[first.loc.length - 1];
    const msg = (first.msg ?? "is invalid").replace(/^Value error, /, "");
    return field && !msg.includes(" ") ? `${field}: ${msg}` : msg;
  }
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "That didn't work. Please check and try again.";
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach REBIRTH right now. Check your connection, or start the API server.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, readDetail(body, res.status));
  return body as T;
}
