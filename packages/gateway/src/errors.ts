/**
 * Typed errors for the model gateway.
 * Never return empty replies — always throw a typed error.
 */

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: string,
    public readonly model?: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ProviderError extends GatewayError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public override readonly provider: string,
    public override readonly model: string,
    public readonly retryAfterMs?: number,
    cause?: Error
  ) {
    super(message, 'PROVIDER_ERROR', provider, model, cause);
    this.name = 'ProviderError';
  }

  /** Whether this error is retryable (rate limit, network, 5xx) */
  isRetryable(): boolean {
    return (
      this.statusCode === 429 ||
      this.statusCode >= 500 ||
      this.statusCode === 0 // network error
    );
  }
}

export class AllProvidersFailedError extends GatewayError {
  constructor(
    public readonly errors: ProviderError[],
    role: string
  ) {
    const messages = errors.map((e) => `${e.provider}/${e.model}: ${e.message}`).join('; ');
    super(`All providers failed for role "${role}": ${messages}`, 'ALL_PROVIDERS_FAILED', undefined, undefined);
    this.name = 'AllProvidersFailedError';
  }
}

export class JsonParseError extends GatewayError {
  constructor(
    message: string,
    public readonly rawText: string,
    public readonly schemaDescription: string,
    public override readonly provider: string,
    public override readonly model: string,
    cause?: Error
  ) {
    super(message, 'JSON_PARSE_ERROR', provider, model, cause);
    this.name = 'JsonParseError';
  }
}

export class JsonValidationError extends GatewayError {
  constructor(
    message: string,
    public readonly rawText: string,
    public readonly validationErrors: string[],
    public override readonly provider: string,
    public override readonly model: string,
    cause?: Error
  ) {
    super(message, 'JSON_VALIDATION_ERROR', provider, model, cause);
    this.name = 'JsonValidationError';
  }
}

export class TimeoutError extends GatewayError {
  constructor(
    public readonly timeoutMs: number,
    public override readonly provider: string,
    public override readonly model: string,
    cause?: Error
  ) {
    super(`Request to ${provider}/${model} timed out after ${timeoutMs}ms`, 'TIMEOUT', provider, model, cause);
    this.name = 'TimeoutError';
  }
}

export class ConfigurationError extends GatewayError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIGURATION_ERROR', undefined, undefined, cause);
    this.name = 'ConfigurationError';
  }
}