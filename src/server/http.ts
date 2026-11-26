const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type FetchJsonOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
};

export async function fetchJson<T>(
  url: URL,
  options: FetchJsonOptions = {},
): Promise<T> {
  const retries = options.retries ?? MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "codex-runners/0.1.0",
          ...options.headers,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < retries) {
          await backoff(attempt);
          continue;
        }
        throw new HttpError(
          `Provider request failed with HTTP ${response.status}.`,
          response.status,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (
        error instanceof HttpError ||
        attempt >= retries ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        break;
      }
      await backoff(attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Provider request timed out.");
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Provider request failed.");
}

async function backoff(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
}
