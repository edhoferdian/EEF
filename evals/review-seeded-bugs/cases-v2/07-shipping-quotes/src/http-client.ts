export interface HttpClientOptions {
  baseUrl: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
}

export class HttpClient {
  constructor(private readonly opts: HttpClientOptions) {}

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.opts.baseUrl + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.opts.timeoutMs),
    });
    if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}`);
    return (await res.json()) as T;
  }
}
