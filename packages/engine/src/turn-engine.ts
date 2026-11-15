import { z } from 'zod';
import type { ModelGateway } from '@guard-duel/gateway';
import { callDefender } from './defender.js';
import { guessMatches, plainLeakCheck } from './secret.js';
import {
  GuardSchema,
  LeakFlagSchema,
  TranscriptMessageSchema,
  type Guard,
  type LeakFlag,
  type TranscriptMessage,
} from './schemas.js';

export const SessionStatusSchema = z.enum(['active', 'ended']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionEndReasonSchema = z.enum(['cracked', 'held', 'expired', 'errored']);
export type SessionEndReason = z.infer<typeof SessionEndReasonSchema>;

/** Private engine state. Never serialize this whole object to an attacker. */
export const SessionStateSchema = z.object({
  id: z.string().min(1),
  guardId: z.string().uuid(),
  guardVersion: z.number().int().positive(),
  secret: z.string().min(1),
  turns: z.array(TranscriptMessageSchema),
  picksUsed: z.number().int().nonnegative(),
  wrongGuesses: z.number().int().nonnegative(),
  leakFlags: z.array(LeakFlagSchema),
  status: SessionStatusSchema,
  endReason: SessionEndReasonSchema.nullable(),
  startedAt: z.string().datetime(),
}).superRefine((state, context) => {
  if (state.status === 'active' && state.endReason !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endReason'], message: 'Active sessions cannot have an end reason.' });
  }
  if (state.status === 'ended' && state.endReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endReason'], message: 'Ended sessions need an end reason.' });
  }
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export const TurnInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), message: z.string() }),
  z.object({ type: z.literal('guess'), guess: z.string() }),
]);
export type TurnInput = z.infer<typeof TurnInputSchema>;

export interface PlayTurnOptions {
  gateway: ModelGateway;
  guard: Guard;
  /** Maximum successful defender exchanges (picks) in this session. */
  maxMessages: number;
  /** Maximum attacker message length, in characters. */
  maxMessageLength: number;
  /** Maximum wrong guesses before the session is held. */
  maxWrongAttempts: number;
  /** Absolute output-token cap applied to the guard's talkativeness setting. */
  defenderMaxReplyTokensCeiling?: number;
  /** Absolute deadline as Unix milliseconds. */
  deadline: number;
  /** Injectable clock for deterministic tests and server time. */
  now?: () => number;
}

export type TurnEvent =
  | { type: 'message_rejected'; reason: 'empty_message' | 'message_too_long' }
  | { type: 'turn_errored'; retryable: true }
  | { type: 'message_answered'; turn: number }
  | { type: 'guess_wrong'; attemptsRemaining: number }
  | { type: 'guess_correct' }
  | { type: 'session_ended'; reason: SessionEndReason }
  | { type: 'session_inactive' };

/** Deliberately contains no secret, guard orders, or owner leak flags. */
export interface AttackerTurnResult {
  sessionId: string;
  status: SessionStatus;
  endReason: SessionEndReason | null;
  picksUsed: number;
  wrongGuesses: number;
  reply: string | null;
  ended: boolean;
  events: TurnEvent[];
}

export interface PlayTurnResult {
  /** Private, non-enumerable state for trusted persistence and the next call. */
  state: SessionState;
  /** Safe projection for the attacker-facing API. */
  attacker: AttackerTurnResult;
  /** Same safe event records as the attacker projection. */
  events: TurnEvent[];
  reply: string | null;
  ended: boolean;
}

function currentTime(options: PlayTurnOptions): number {
  return options.now?.() ?? Date.now();
}

function validateOptions(options: PlayTurnOptions): void {
  for (const [name, value] of Object.entries({
    maxMessages: options.maxMessages,
    maxMessageLength: options.maxMessageLength,
    maxWrongAttempts: options.maxWrongAttempts,
  })) {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive integer`);
    }
  }
  if (!Number.isFinite(options.deadline)) {
    throw new RangeError('deadline must be a finite Unix timestamp in milliseconds');
  }
}

function makeResult(
  state: SessionState,
  reply: string | null,
  events: TurnEvent[],
): PlayTurnResult {
  const ended = state.status === 'ended';
  const attacker: AttackerTurnResult = {
    sessionId: state.id,
    status: state.status,
    endReason: state.endReason,
    picksUsed: state.picksUsed,
    wrongGuesses: state.wrongGuesses,
    reply,
    ended,
    events,
  };
  const result = { attacker, events, reply, ended } as PlayTurnResult;
  Object.defineProperty(result, 'state', {
    value: state,
    enumerable: false,
  });
  return result;
}

function endSession(state: SessionState, reason: SessionEndReason): SessionState {
  return { ...state, status: 'ended', endReason: reason };
}

function appendEndEvent(state: SessionState, reason: SessionEndReason, events: TurnEvent[]): SessionState {
  events.push({ type: 'session_ended', reason });
  return endSession(state, reason);
}

function timestampFor(ms: number): string {
  return new Date(ms).toISOString();
}

function validateGuardVersion(state: SessionState, guard: Guard): void {
  if (state.guardId !== guard.id || state.guardVersion !== guard.version) {
    throw new Error('The guard version does not match this session.');
  }
}

/**
 * Play one attacker message or key guess. Failed model calls leave the session
 * active and do not store the submitted message or spend a pick.
 */
export async function playTurn(
  stateInput: SessionState,
  inputValue: TurnInput,
  options: PlayTurnOptions,
): Promise<PlayTurnResult> {
  const state = SessionStateSchema.parse(stateInput);
  const input = TurnInputSchema.parse(inputValue);
  const guard = GuardSchema.parse(options.guard);
  validateOptions(options);
  validateGuardVersion(state, guard);

  const events: TurnEvent[] = [];
  if (state.status !== 'active') {
    events.push({ type: 'session_inactive' });
    return makeResult(state, null, events);
  }

  if (currentTime(options) >= options.deadline) {
    const expired = appendEndEvent(state, 'expired', events);
    return makeResult(expired, null, events);
  }

  if (state.picksUsed >= options.maxMessages || state.wrongGuesses >= options.maxWrongAttempts) {
    const held = appendEndEvent(state, 'held', events);
    return makeResult(held, null, events);
  }

  if (input.type === 'guess') {
    if (guessMatches(state.secret, input.guess)) {
      events.push({ type: 'guess_correct' });
      const cracked = appendEndEvent(state, 'cracked', events);
      return makeResult(cracked, null, events);
    }

    const wrongGuesses = state.wrongGuesses + 1;
    let nextState: SessionState = { ...state, wrongGuesses };
    events.push({ type: 'guess_wrong', attemptsRemaining: Math.max(0, options.maxWrongAttempts - wrongGuesses) });
    if (wrongGuesses >= options.maxWrongAttempts) {
      nextState = appendEndEvent(nextState, 'held', events);
    }
    return makeResult(nextState, null, events);
  }

  if (input.message.trim().length === 0) {
    events.push({ type: 'message_rejected', reason: 'empty_message' });
    return makeResult(state, null, events);
  }
  if (input.message.length > options.maxMessageLength) {
    events.push({ type: 'message_rejected', reason: 'message_too_long' });
    return makeResult(state, null, events);
  }

  const turn = state.picksUsed + 1;
  const timestamp = timestampFor(currentTime(options));
  const attackerMessage: TranscriptMessage = {
    role: 'attacker',
    content: input.message,
    turn,
    timestamp,
  };

  let reply: string;
  try {
    reply = await callDefender(
      options.gateway,
      guard,
      state.secret,
      [...state.turns, attackerMessage],
      options.defenderMaxReplyTokensCeiling ?? 300,
    );
    if (reply.trim().length === 0) throw new Error('The defender returned an empty reply.');
  } catch {
    if (currentTime(options) >= options.deadline) {
      const expired = appendEndEvent(state, 'expired', events);
      return makeResult(expired, null, events);
    }
    events.push({ type: 'turn_errored', retryable: true });
    return makeResult(state, null, events);
  }

  const defenderMessage: TranscriptMessage = {
    role: 'defender',
    content: reply,
    turn,
    timestamp: timestampFor(currentTime(options)),
  };
  const leak = plainLeakCheck(state.secret, reply);
  let leakFlags: LeakFlag[] = state.leakFlags;
  if (leak) {
    const flag = LeakFlagSchema.parse({
      turn,
      method: leak.type,
      matchedText: leak.matchedText,
      index: leak.index,
    });
    leakFlags = [...state.leakFlags, flag];
  }

  let nextState: SessionState = {
    ...state,
    turns: [...state.turns, attackerMessage, defenderMessage],
    picksUsed: turn,
    leakFlags,
  };
  events.push({ type: 'message_answered', turn });

  if (currentTime(options) >= options.deadline) {
    nextState = appendEndEvent(nextState, 'expired', events);
  } else if (nextState.picksUsed >= options.maxMessages) {
    nextState = appendEndEvent(nextState, 'held', events);
  }

  return makeResult(nextState, reply, events);
}
