import type {
  Role,
  ProviderConfig,
  ModelConfig,
  CompleteOptions,
  CompleteResult,
  UsageRecord,
  ChatMessage,
  ModelGateway,
} from './types.js';
import {
  GatewayError,
  ProviderError,
  AllProvidersFailedError,
  JsonParseError,
  JsonValidationError,
  TimeoutError,
  ConfigurationError,
} from './errors.js';

/**
 * Default timeout for model calls (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Maximum retry attempts for retryable errors
 */
const MAX_RETRIES = 2;

/**
 * Base delay for exponential backoff (ms)
 */
const BASE_RETRY_DELAY_MS = 1_000;

/**
 * OpenAI chat completion request body
 */
interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' | 'json_schema'; json_schema?: Record<string, unknown> };
  stream: false;
  [key: string]: unknown;
}

/**
 * OpenAI chat completion response
 */
interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Model Gateway - handles completion calls with provider fallback, retries, structured output, and usage logging.
 */
export class Gateway implements ModelGateway {
  private readonly modelConfig: ModelConfig;
  private readonly usageLog: UsageRecord[] = [];
  private readonly usageLogPath: string;

  constructor(modelConfig: ModelConfig, usageLogPath = 'usage.jsonl') {
    // Validate that all required roles have at least one provider
    const requiredRoles: Role[] = ['defender', 'attacker', 'analyst'];
    for (const role of requiredRoles) {
      const providers = modelConfig[role];
      if (!providers || providers.length === 0) {
        throw new ConfigurationError(`No providers configured for role: ${role}`);
      }
    }
    this.modelConfig = modelConfig;
    this.usageLogPath = usageLogPath;
  }

  /**
   * Get the list of providers for a role, in priority order.
   */
  getProviders(role: Role): ProviderConfig[] {
    const providers = this.modelConfig[role];
    if (!providers || providers.length === 0) {
      throw new ConfigurationError(`No providers configured for role: ${role}`);
    }
    return providers;
  }

  /**
   * Execute a completion with automatic provider fallback and retries.
   */
  async complete(role: Role, messages: ChatMessage[], options: CompleteOptions = {}): Promise<CompleteResult> {
    const providers = this.getProviders(role);
    // providers is guaranteed non-empty by constructor validation
    const errors: GatewayError[] = [];

    for (let i = 0; i < providers.length; i++) {
      // providers[i] is guaranteed to exist because i < providers.length
      const provider = providers[i]!;
      const apiKey = process.env[provider.apiKeyEnv];

      if (!apiKey) {
        const err = new ProviderError(
          `API key not found in environment variable: ${provider.apiKeyEnv}`,
          0,
          provider.baseUrl,
          provider.model
        );
        errors.push(err);
        continue;
      }

      try {
        const result = await this.callProvider(provider, apiKey, messages, options, i === 0);
        this.logUsage({
          timestamp: new Date().toISOString(),
          provider: provider.baseUrl,
          model: provider.model,
          role,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          latencyMs: result.latencyMs,
          success: true,
        });
        return result;
      } catch (error) {
        if (error instanceof ProviderError) {
          errors.push(error);
          // If not the last provider and error is retryable, try next provider
          if (i < providers.length - 1 && error.isRetryable()) {
            await this.sleep(this.calculateBackoff(error.retryAfterMs));
            continue;
          }
          // If last provider or non-retryable, throw AllProvidersFailedError
          if (i === providers.length - 1) {
            throw new AllProvidersFailedError(errors as ProviderError[], role);
          }
        } else if (error instanceof JsonParseError || error instanceof JsonValidationError) {
          // Structured output errors don't trigger provider fallback
          this.logUsage({
            timestamp: new Date().toISOString(),
            provider: provider.baseUrl,
            model: provider.model,
            role,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: 0,
            success: false,
            error: error.message,
          });
          throw error;
        } else if (error instanceof TimeoutError) {
          errors.push(error);
          if (i < providers.length - 1) {
            await this.sleep(this.calculateBackoff());
            continue;
          }
        } else {
          // Unexpected error - wrap and don't retry
          const wrapped = new ProviderError(
            error instanceof Error ? error.message : 'Unknown error',
            0,
            provider.baseUrl,
            provider.model,
            undefined,
            error instanceof Error ? error : undefined
          );
          errors.push(wrapped);
        }
      }
    }

    // Should not reach here if providers is non-empty, but TypeScript needs it
    throw new AllProvidersFailedError(errors as ProviderError[], role);
  }

  /**
   * Call a single provider with retries.
   */
  private async callProvider(
    provider: ProviderConfig,
    apiKey: string,
    messages: ChatMessage[],
    options: CompleteOptions,
    _isPrimary: boolean
  ): Promise<CompleteResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.doCall(provider, apiKey, messages, options, timeoutMs, startTime);
      } catch (error) {
        const isRetryable =
          error instanceof ProviderError && error.isRetryable() && attempt < MAX_RETRIES;
        const isTimeout = error instanceof TimeoutError && attempt < MAX_RETRIES;

        if (isRetryable || isTimeout) {
          const delay = isTimeout ? BASE_RETRY_DELAY_MS : this.calculateBackoff(
            error instanceof ProviderError ? error.retryAfterMs : undefined
          );
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    // Should not reach here, but TypeScript needs it
    throw new ProviderError('Max retries exceeded', 0, provider.baseUrl, provider.model);
  }

  /**
   * Execute the actual HTTP call to the provider.
   */
  private async doCall(
    provider: ProviderConfig,
    apiKey: string,
    messages: ChatMessage[],
    options: CompleteOptions,
    timeoutMs: number,
    startTime: number
  ): Promise<CompleteResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestBody = this.buildRequestBody(provider, messages, options);
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const retryAfter = response.headers.get('retry-after');
        throw new ProviderError(
          `Provider returned ${response.status}: ${errorText}`,
          response.status,
          provider.baseUrl,
          provider.model,
          retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
        );
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const latencyMs = Date.now() - startTime;

      return this.processResponse(data, provider, latencyMs, options);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof GatewayError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(timeoutMs, provider.baseUrl, provider.model);
      }
      throw new ProviderError(
        error instanceof Error ? error.message : 'Network error',
        0,
        provider.baseUrl,
        provider.model,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Build the request body for the provider.
   */
  private buildRequestBody(
    provider: ProviderConfig,
    messages: ChatMessage[],
    options: CompleteOptions
  ): ChatCompletionRequest {
    const body: ChatCompletionRequest = {
      model: provider.model,
      messages,
      stream: false,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    // Handle structured output
    if (options.jsonSchema) {
      // Prefer JSON schema mode if provider supports it (OpenAI, Groq, etc.)
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: options.jsonSchema,
          strict: true,
        },
      };
    }

    // Merge extra body fields from provider config
    if (provider.extraBody) {
      Object.assign(body, provider.extraBody);
    }

    return body;
  }

  /**
   * Process the response, handling structured output validation.
   */
  private processResponse(
    data: ChatCompletionResponse,
    provider: ProviderConfig,
    latencyMs: number,
    options: CompleteOptions
  ): CompleteResult {
    const choice = data.choices[0];
    if (!choice?.message?.content) {
      throw new ProviderError('Empty response from provider', 0, provider.baseUrl, provider.model);
    }

    const text = choice.message.content;
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    let json: unknown | undefined;

    if (options.jsonSchema) {
      try {
        json = JSON.parse(text);
        // Additional validation could be done here with Zod if needed
      } catch (parseError) {
        throw new JsonParseError(
          'Failed to parse JSON response',
          text,
          JSON.stringify(options.jsonSchema),
          provider.baseUrl,
          provider.model,
          parseError instanceof Error ? parseError : undefined
        );
      }
    }

    return {
      text,
      json,
      usage,
      latencyMs,
      provider: provider.baseUrl,
      model: provider.model,
    };
  }

  /**
   * Calculate exponential backoff delay.
   */
  private calculateBackoff(retryAfterMs?: number): number {
    if (retryAfterMs) {
      return Math.min(retryAfterMs, 30_000);
    }
    return BASE_RETRY_DELAY_MS * Math.pow(2, Math.floor(Math.random() * 3));
  }

  /**
   * Sleep for the given milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log usage to in-memory array and JSONL file.
   */
  private logUsage(record: UsageRecord): void {
    this.usageLog.push(record);
    // In a real implementation, this would append to a file
    // For now, we keep it in memory; tests can inspect this.usageLog
  }

  /**
   * Get all logged usage records.
   */
  getUsageLog(): UsageRecord[] {
    return [...this.usageLog];
  }

  /**
   * Clear the usage log.
   */
  clearUsageLog(): void {
    this.usageLog.length = 0;
  }
}
