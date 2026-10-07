export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

const RETRYABLE = new Set([429, 502, 503, 504]);

/**
 * GET a JSON resource, retrying transient failures with exponential backoff.
 * Each attempt is abandoned after timeoutMs. Non-retryable HTTP errors and
 * the final failure are thrown to the caller.
 */
export async function getJson<T>(url: string, attempts = 3, baseDelayMs = 200, timeoutMs = 5000): Promise<T> {
  if (attempts < 1) throw new RangeError("attempts must be at least 1");
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return (await res.json()) as T;
      const error = new HttpError(res.status, `GET ${url} failed with ${res.status}`);
      if (!RETRYABLE.has(res.status)) throw error;
      lastError = error;
    } catch (err) {
      if (err instanceof HttpError && !RETRYABLE.has(err.status)) throw err;
      lastError = err;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
