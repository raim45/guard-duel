import { z } from 'zod';

export const LockTypeSchema = z.enum(['combo', 'passphrase', 'pin']);
export type LockTypeValue = z.infer<typeof LockTypeSchema>;

export const KeyTypeSchema = z.enum(['code', 'word', 'number']);
export type KeyType = z.infer<typeof KeyTypeSchema>;

export const RefusalStyleSchema = z.enum(['polite', 'stern', 'playful', 'cryptic']);
export type RefusalStyle = z.infer<typeof RefusalStyleSchema>;

export const TalkativenessSchema = z.enum(['terse', 'normal', 'chatty']);
export type Talkativeness = z.infer<typeof TalkativenessSchema>;

export const WardFieldsSchema = z.object({
  stonewall: z.boolean(),
  pokerFace: z.boolean(),
  shortAnswers: z.boolean(),
  languageLock: z.boolean(),
});
export type WardFields = z.infer<typeof WardFieldsSchema>;

export const OutcomeSchema = z.enum(['cracked', 'held', 'expired', 'errored']);
export type Outcome = z.infer<typeof OutcomeSchema>;

export const LimitsSchema = z.object({
  picks: z.number().int().positive(),
  patrolSeconds: z.number().int().positive(),
  wrongAttempts: z.number().int().positive(),
  cooldownSeconds: z.number().int().nonnegative(),
  maxMessageLength: z.number().int().positive(),
});
export type Limits = z.infer<typeof LimitsSchema>;

/* ---------- Board ---------- */

export const BoardItemSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  version: z.number(),
  name: z.string(),
  lookSeed: z.string(),
  lockType: LockTypeSchema,
  keyFormatHint: z.string().nullable(),
  attempts: z.number(),
  breaks: z.number(),
  breakRate: z.number().nullable(),
  averagePicksToCrack: z.number().nullable(),
  averageSurvivalPicks: z.number().nullable(),
  postedAt: z.string(),
});
export type BoardItem = z.infer<typeof BoardItemSchema>;

export const BrowseResponseSchema = z.object({
  items: z.array(BoardItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  attacksEnabled: z.boolean(),
  limits: LimitsSchema,
});
export type BrowseResponse = z.infer<typeof BrowseResponseSchema>;

export type BoardSort = 'freshest' | 'toughest' | 'most-cracked';
export type BoardLockFilter = 'all' | LockTypeValue;
export interface BrowseParams {
  lockType: BoardLockFilter;
  sort: BoardSort;
  page: number;
}

/* ---------- My Vaults ---------- */

export interface VersionStats {
  attempts: number;
  breaks: number;
  breakRate: number | null;
  averagePicksToCrack: number | null;
  averageSurvivalPicks: number | null;
}

export interface MyGuard {
  id: string;
  familyId: string;
  version: number;
  name: string;
  instructions: string;
  refusalStyle: RefusalStyle;
  talkativeness: Talkativeness;
  keyType: KeyType;
  lockType: LockTypeValue;
  revealKeyFormat: boolean;
  lookSeed: string;
  published: boolean;
  createdAt: string;
  fields: WardFields;
  stats: VersionStats | null;
}

export interface CreateGuardInput {
  name: string;
  instructions: string;
  refusalStyle: RefusalStyle;
  talkativeness: Talkativeness;
  revealKeyFormat: boolean;
  fields: WardFields;
  keyType: KeyType;
  lookSeed?: string;
  /** Present when saving a new version of an existing Warden. */
  familyId?: string;
}

/* ---------- Heist ---------- */

export const StartAttackSchema = z.object({
  sessionId: z.string(),
  limits: LimitsSchema,
  keyFormatHint: z.string().optional(),
  startedAt: z.string(),
});
export type StartAttack = z.infer<typeof StartAttackSchema>;

export const MessageResultSchema = z.object({
  reply: z.string().nullable(),
  ended: z.boolean(),
  outcome: OutcomeSchema.nullable(),
  events: z.array(z.object({ type: z.string() }).passthrough()),
  picksLeft: z.number(),
  attemptsLeft: z.number(),
  serverTimeRemaining: z.number(),
  serverTime: z.string(),
});
export type MessageResult = z.infer<typeof MessageResultSchema>;

export const GuessResultSchema = z.object({
  correct: z.boolean(),
  ended: z.boolean(),
  outcome: OutcomeSchema.nullable(),
  events: z.array(z.object({ type: z.string() }).passthrough()),
  attemptsLeft: z.number(),
  picksLeft: z.number(),
  serverTime: z.string(),
});
export type GuessResult = z.infer<typeof GuessResultSchema>;

export const TranscriptTurnSchema = z.object({
  role: z.enum(['attacker', 'defender']),
  content: z.string(),
  turn: z.number(),
  timestamp: z.string().optional(),
});

export const AttackStateSchema = z.discriminatedUnion('ended', [
  z.object({ ended: z.literal(true), sessionId: z.string(), outcome: OutcomeSchema.nullable(), serverTime: z.string() }),
  z.object({
    ended: z.literal(false),
    sessionId: z.string(),
    outcome: z.null(),
    guard: z.object({
      id: z.string(),
      name: z.string(),
      lookSeed: z.string(),
      lockType: LockTypeSchema,
      keyFormatHint: z.string().nullable(),
    }),
    limits: LimitsSchema,
    transcript: z.array(TranscriptTurnSchema),
    picksLeft: z.number(),
    attemptsLeft: z.number(),
    serverTimeRemaining: z.number(),
    startedAt: z.string(),
    serverTime: z.string(),
  }),
]);
export type AttackState = z.infer<typeof AttackStateSchema>;

export const LeakFlagSchema = z.object({
  turn: z.number(),
  method: z.string(),
  matchedText: z.string(),
  index: z.number(),
});

export const AttackResultSchema = z.object({
  sessionId: z.string(),
  outcome: OutcomeSchema.nullable(),
  guard: z.object({ id: z.string(), name: z.string(), lookSeed: z.string(), lockType: LockTypeSchema }),
  picksUsed: z.number(),
  wrongGuesses: z.number(),
  secondsUsed: z.number(),
  key: z.string(),
  winningGuess: z.string().nullable(),
  orders: z.string().nullable(),
  transcript: z.array(TranscriptTurnSchema),
  leakFlags: z.array(LeakFlagSchema).optional(),
});
export type AttackResult = z.infer<typeof AttackResultSchema>;

/* ---------- Case files ---------- */

export const OwnerSessionSchema = z.object({
  id: z.string(),
  attackerCallsign: z.string(),
  outcome: OutcomeSchema.nullable(),
  status: z.string(),
  picksUsed: z.number(),
  secondsUsed: z.number().nullable(),
  createdAt: z.string(),
  winningGuess: z.string().nullable(),
  transcript: z.array(TranscriptTurnSchema),
  leakFlags: z.array(LeakFlagSchema),
});
export type OwnerSession = z.infer<typeof OwnerSessionSchema>;

export const OwnerSessionsSchema = z.object({
  guard: z.object({ id: z.string(), familyId: z.string().optional(), version: z.number().optional(), instructions: z.string() }),
  sessions: z.array(OwnerSessionSchema),
});
export type OwnerSessions = z.infer<typeof OwnerSessionsSchema>;

export type ReportReason = 'offensive_orders' | 'warden_is_broken' | 'something_else';

/* ---------- Auth ---------- */

export interface Profile {
  userId: string;
  email: string;
  callsign: string;
}
