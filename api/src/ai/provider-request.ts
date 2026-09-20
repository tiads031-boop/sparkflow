export interface ProviderRequestLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface CompletionRequestOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  operation: string;
  requestBody: Record<string, unknown>;
  logger: ProviderRequestLogger;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function requestId(response: Response) {
  return response.headers.get('x-dashscope-request-id')
    || response.headers.get('x-request-id')
    || response.headers.get('request-id')
    || undefined;
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 5_000);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(0, retryAt - Date.now()), 5_000);
    }
  }

  return Math.min(500 * (2 ** Math.max(0, attempt - 1)), 2_000);
}

function errorMetadata(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name.slice(0, 80),
      errorMessage: error.message.slice(0, 300),
    };
  }
  return {
    errorName: 'UnknownError',
    errorMessage: String(error).slice(0, 300),
  };
}

function logPayload(
  options: CompletionRequestOptions,
  fields: Record<string, unknown>,
) {
  return JSON.stringify({
    event: 'ai_provider_request',
    providerHost: (() => {
      try {
        return new URL(options.baseUrl).host;
      } catch {
        return 'invalid-base-url';
      }
    })(),
    model: options.model,
    operation: options.operation,
    ...fields,
  });
}

export async function requestOpenAICompatibleCompletion(
  options: CompletionRequestOptions,
): Promise<string> {
  const fetchImpl = options.fetchImpl || fetch;
  const sleepImpl = options.sleepImpl || sleep;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts || DEFAULT_MAX_ATTEMPTS);
  const url = `${options.baseUrl}/chat/completions`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(options.requestBody),
      });
    } catch (error) {
      const finalAttempt = attempt >= maxAttempts;
      const payload = logPayload(options, {
        outcome: 'transport_error',
        attempt,
        maxAttempts,
        durationMs: Date.now() - startedAt,
        ...errorMetadata(error),
      });
      if (finalAttempt) {
        options.logger.error(payload);
        throw new Error('AI provider transport failed after retries');
      }
      options.logger.warn(payload);
      await sleepImpl(Math.min(500 * (2 ** (attempt - 1)), 2_000));
      continue;
    }

    const upstreamRequestId = requestId(response);
    if (!response.ok) {
      const retryable = RETRYABLE_STATUSES.has(response.status);
      const finalAttempt = attempt >= maxAttempts || !retryable;
      const payload = logPayload(options, {
        outcome: 'http_error',
        attempt,
        maxAttempts,
        durationMs: Date.now() - startedAt,
        status: response.status,
        retryable,
        upstreamRequestId,
      });
      if (finalAttempt) {
        options.logger.error(payload);
        throw new Error(
          `AI provider request failed (${response.status})${upstreamRequestId ? ` [${upstreamRequestId}]` : ''}`,
        );
      }
      options.logger.warn(payload);
      await sleepImpl(retryDelayMs(response, attempt));
      continue;
    }

    let payload: {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    try {
      payload = await response.json() as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
    } catch (error) {
      const finalAttempt = attempt >= maxAttempts;
      const details = logPayload(options, {
        outcome: 'invalid_json',
        attempt,
        maxAttempts,
        durationMs: Date.now() - startedAt,
        status: response.status,
        upstreamRequestId,
        ...errorMetadata(error),
      });
      if (finalAttempt) {
        options.logger.error(details);
        throw new Error('AI provider returned invalid JSON after retries');
      }
      options.logger.warn(details);
      await sleepImpl(Math.min(500 * (2 ** (attempt - 1)), 2_000));
      continue;
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const finalAttempt = attempt >= maxAttempts;
      const details = logPayload(options, {
        outcome: 'empty_content',
        attempt,
        maxAttempts,
        durationMs: Date.now() - startedAt,
        status: response.status,
        upstreamRequestId,
      });
      if (finalAttempt) {
        options.logger.error(details);
        throw new Error('AI provider returned an empty response after retries');
      }
      options.logger.warn(details);
      await sleepImpl(Math.min(500 * (2 ** (attempt - 1)), 2_000));
      continue;
    }

    if (attempt > 1) {
      options.logger.log(logPayload(options, {
        outcome: 'recovered',
        attempt,
        maxAttempts,
        durationMs: Date.now() - startedAt,
        status: response.status,
        upstreamRequestId,
      }));
    }
    return content;
  }

  throw new Error('AI provider request failed');
}
