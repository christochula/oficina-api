function messageFromBody(body, fallback) {
  const candidate = body?.mensagem ?? body?.message;
  if (Array.isArray(candidate)) return candidate.join(' · ');
  if (typeof candidate === 'string' && candidate.trim()) return candidate;
  return fallback;
}

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = 'REQUEST_FAILED',
      correlationId = null,
      path = null,
      timestamp = null,
      retryable = false,
      cause,
    } = {},
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
    this.path = path;
    this.timestamp = timestamp;
    this.retryable = retryable;
  }

  static fromResponse(response, body, fallbackCorrelationId = null) {
    const status = response.status;
    const correlationId =
      response.headers?.get?.('x-correlation-id') ??
      body?.correlationId ??
      fallbackCorrelationId;
    return new ApiError(
      messageFromBody(body, `A solicitação falhou (${status}).`),
      {
        status,
        code: body?.erro ?? `HTTP_${status}`,
        correlationId,
        path: body?.caminho ?? null,
        timestamp: body?.timestamp ?? null,
        retryable: status === 408 || status === 429 || status >= 500,
      },
    );
  }
}

export function isApiError(error) {
  return error instanceof ApiError;
}
