import { z } from 'zod';

/**
 * Role identifiers for model routing.
 * Part 1 uses 'defender'. Part 2 adds 'attacker' and 'analyst'.
 */
export const RoleSchema = z.enum(['defender', 'attacker', 'analyst']);
export type Role = z.infer<typeof RoleSchema>;

/**
 * OpenAI chat completion request message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Common interface for model gateways (both Gateway and MockGateway).
 */
export interface ModelGateway {
  complete(role: Role, messages: ChatMessage[], options?: CompleteOptions): Promise<CompleteResult>;
  getProviders(role: Role): ProviderConfig[];
  getUsageLog(): UsageRecord[];
  clearUsageLog(): void;
}

/**
 * Provider configuration for a single model endpoint.
 * Uses OpenAI-compatible chat completions format.
 */
export const ProviderConfigSchema = z.object({
  /** Base URL for the OpenAI-compatible API (e.g., https://api.groq.com/openai/v1) */
  baseUrl: z.string().url(),
  /** Environment variable name containing the API key */
  apiKeyEnv: z.string().min(1),
  /** Model identifier (e.g., llama-3.3-70b-versatile) */
  model: z.string().min(1),
  /** Optional extra request body fields (e.g., to disable thinking modes) */
  extraBody: z.record(z.unknown()).optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Model configuration per role: ordered list of providers (primary + fallbacks).
 */
export const ModelConfigSchema = z.record(RoleSchema, z.array(ProviderConfigSchema).min(1));
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Options passed to the gateway for a single completion call.
 */
export const CompleteOptionsSchema = z.object({
  /** Maximum tokens in the response */
  maxTokens: z.number().int().positive().optional(),
  /** Sampling temperature */
  temperature: z.number().min(0).max(2).optional(),
  /** JSON schema for structured output (when provider supports it) */
  jsonSchema: z.record(z.unknown()).optional(),
  /** Request timeout in milliseconds */
  timeoutMs: z.number().int().positive().optional(),
});
export type CompleteOptions = z.infer<typeof CompleteOptionsSchema>;

/**
 * Result of a successful completion.
 */
export const CompleteResultSchema = z.object({
  /** The generated text content */
  text: z.string(),
  /** Parsed JSON if jsonSchema was provided and parsing succeeded */
  json: z.unknown().optional(),
  /** Token usage information */
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }),
  /** Latency in milliseconds */
  latencyMs: z.number().int().nonnegative(),
  /** Provider that succeeded */
  provider: z.string(),
  /** Model that was used */
  model: z.string(),
});
export type CompleteResult = z.infer<typeof CompleteResultSchema>;

/**
 * Token usage record for logging (JSONL).
 */
export const UsageRecordSchema = z.object({
  timestamp: z.string().datetime(),
  provider: z.string(),
  model: z.string(),
  role: RoleSchema,
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type UsageRecord = z.infer<typeof UsageRecordSchema>;
