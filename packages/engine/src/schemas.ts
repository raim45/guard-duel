import { z } from 'zod';

/**
 * Key type for the secret.
 */
export const KeyTypeSchema = z.enum(['code', 'word', 'number']);
export type KeyType = z.infer<typeof KeyTypeSchema>;

/** Refusal style choices from the Forge. */
export const RefusalStyleSchema = z.enum(['polite', 'stern', 'playful', 'cryptic']);
export type RefusalStyle = z.infer<typeof RefusalStyleSchema>;

/** Reply length choices from the Forge. */
export const TalkativenessSchema = z.enum(['terse', 'normal', 'chatty']);
export type Talkativeness = z.infer<typeof TalkativenessSchema>;

/**
 * Boolean toggle fields for guard configuration.
 * These map to predefined sentences in the defender prompt.
 */
export const GuardFieldsSchema = z.object({
  /** Refuse any question about the key directly */
  stonewall: z.boolean().default(false),
  /** Never confirm or deny a guess */
  pokerFace: z.boolean().default(false),
  /** Keep replies to three sentences max */
  shortAnswers: z.boolean().default(false),
  /** Answer only in the language of the orders */
  languageLock: z.boolean().default(false),
});
export type GuardFields = z.infer<typeof GuardFieldsSchema>;

/**
 * A guard (warden) configuration - versioned and immutable.
 * Editing creates a new version.
 */
export const GuardSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),
  /** Human-readable name */
  name: z.string().min(2).max(24),
  /** The player's instructions (orders) */
  /** Empty is allowed for the internal baseline fixture; player inputs require at least 20 characters. */
  instructions: z.string().max(5000),
  /** Refusal voice selected in the Forge. */
  refusalStyle: RefusalStyleSchema.default('polite'),
  /** Reply length selected in the Forge. */
  talkativeness: TalkativenessSchema.default('normal'),
  /** Whether attackers receive a key-format hint before starting. */
  revealKeyFormat: z.boolean().default(false),
  /** Toggle fields */
  fields: GuardFieldsSchema,
  /** Key type for this guard's secret */
  keyType: KeyTypeSchema,
  /** Whether this guard is published for others to attack */
  published: z.boolean().default(false),
  /** Version number (incremented on each edit) */
  version: z.number().int().positive(),
  /** Avatar seed for DiceBear */
  lookSeed: z.string().optional(),
  /** Created timestamp */
  createdAt: z.string().datetime(),
  /** Updated timestamp */
  updatedAt: z.string().datetime(),
});
export type Guard = z.infer<typeof GuardSchema>;

/**
 * Input for creating a new guard version.
 */
export const CreateGuardInputSchema = z.object({
  name: z.string().min(2).max(24),
  instructions: z.string().min(20).max(5000),
  refusalStyle: RefusalStyleSchema.default('polite'),
  talkativeness: TalkativenessSchema.default('normal'),
  revealKeyFormat: z.boolean().default(false),
  fields: GuardFieldsSchema,
  keyType: KeyTypeSchema,
  lookSeed: z.string().optional(),
});
export type CreateGuardInput = z.infer<typeof CreateGuardInputSchema>;

/**
 * Input for updating a guard (creates new version).
 */
export const UpdateGuardInputSchema = z.object({
  name: z.string().min(2).max(24).optional(),
  instructions: z.string().min(20).max(5000).optional(),
  refusalStyle: RefusalStyleSchema.optional(),
  talkativeness: TalkativenessSchema.optional(),
  revealKeyFormat: z.boolean().optional(),
  fields: GuardFieldsSchema.optional(),
  keyType: KeyTypeSchema.optional(),
});
export type UpdateGuardInput = z.infer<typeof UpdateGuardInputSchema>;

/**
 * Plain leak detected by the code check for the guard owner's review.
 */
export const LeakFlagSchema = z.object({
  /** Turn index (1-indexed) where leak was detected */
  turn: z.number().int().positive(),
  /** The plainLeakCheck method that detected the leak */
  method: z.enum(['direct', 'normalized', 'reversed', 'spaced', 'per-line', 'spelled-out', 'whole-word']),
  /** Exact matched text from the defender's reply */
  matchedText: z.string(),
  /** Character index returned by plainLeakCheck */
  index: z.number().int().nonnegative(),
});
export type LeakFlag = z.infer<typeof LeakFlagSchema>;

/**
 * Defender message in the conversation.
 */
export const DefenderMessageSchema = z.object({
  role: z.literal('defender'),
  content: z.string(),
  turn: z.number().int().positive(),
  timestamp: z.string().datetime(),
});
export type DefenderMessage = z.infer<typeof DefenderMessageSchema>;

/**
 * Attacker message in the conversation.
 */
export const AttackerMessageSchema = z.object({
  role: z.literal('attacker'),
  content: z.string(),
  turn: z.number().int().positive(),
  timestamp: z.string().datetime(),
});
export type AttackerMessage = z.infer<typeof AttackerMessageSchema>;

/**
 * Full transcript message.
 */
export const TranscriptMessageSchema = z.union([DefenderMessageSchema, AttackerMessageSchema]);
export type TranscriptMessage = z.infer<typeof TranscriptMessageSchema>;
