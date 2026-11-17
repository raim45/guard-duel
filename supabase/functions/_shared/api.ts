import { Gateway, type ModelConfig } from '../../../packages/gateway/dist/index.js';
import {
  CreateGuardInputSchema,
  GuardSchema,
  generateSecret,
  playTurn,
  type Guard,
  type SessionState,
  type TranscriptMessage,
} from '../../../packages/engine/dist/index.js';
import { DatabaseError, SupabaseRestClient } from './db.ts';
import { z } from 'zod';
import modelConfigFile from '../../../config/models.json' with { type: 'json' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

type User = { id: string; email?: string };
type Settings = {
  max_messages_per_session: number;
  max_message_length: number;
  max_orders_length: number;
  defender_max_reply_tokens_ceiling: number;
  session_time_limit_seconds: number;
  max_wrong_attempts: number;
  cooldown_seconds: number;
  sessions_per_user_per_guard_per_day: number;
  sessions_per_user_per_day: number;
  active_sessions_per_user_per_guard: number;
  daily_token_budget_global: number;
  daily_token_budget_per_user: number;
  message_rate_limit_per_user_per_minute: number;
  human_attacks_enabled: boolean;
  disabled_guard_ids: string[];
};
type GuardRow = {
  id: string;
  family_id: string;
  owner_id: string;
  version: number;
  name: string;
  instructions: string;
  fields: Guard['fields'];
  refusal_style: Guard['refusalStyle'];
  talkativeness: Guard['talkativeness'];
  key_type: Guard['keyType'];
  lock_type: 'combo' | 'passphrase' | 'pin';
  reveal_key_format: boolean;
  look_seed: string;
  published: boolean;
  created_at: string;
};
type SessionRow = {
  id: string;
  guard_id: string;
  guard_family_id: string;
  attacker_id: string;
  status: 'active' | 'ended' | 'errored' | 'abandoned';
  end_reason: 'cracked' | 'held' | 'expired' | 'errored' | 'abandoned' | null;
  picks_used: number;
  wrong_guesses: number;
  winning_guess: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};
type TurnRow = { id: string; session_id: string; turn_index: number; role: 'attacker' | 'defender'; content: string; created_at: string };
type SecretRow = { session_id: string; secret: string };
type LeakFlagRow = { turn_index: number; method: string; matched_text: string; char_index: number };
type DbLike = SupabaseRestClient;

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

const objectSchema = z.record(z.unknown());
const uuidSchema = z.string().uuid();
const reportSchema = z.object({
  guardId: uuidSchema,
  reason: z.enum(['offensive_orders', 'warden_is_broken', 'something_else']),
  note: z.string().max(2000).nullable().optional(),
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new ApiError(500, 'SERVER_CONFIGURATION', 'The server is not configured for this request.');
  return value;
}

function serviceDb(): SupabaseRestClient {
  return new SupabaseRestClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
}

function userDb(accessToken: string): SupabaseRestClient {
  return new SupabaseRestClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), accessToken);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Send a valid JSON request body.');
  }
  const parsed = objectSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'INVALID_BODY', 'Send a JSON object.');
  return parsed.data;
}

async function authenticate(request: Request): Promise<{ user: User; accessToken: string; db: DbLike; callerDb: DbLike }> {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  const accessToken = match[1]!;
  const url = `${getEnv('SUPABASE_URL').replace(/\/$/, '')}/auth/v1/user`;
  const response = await fetch(url, {
    headers: { apikey: getEnv('SUPABASE_ANON_KEY'), Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new ApiError(401, 'AUTH_REQUIRED', 'Your sign-in has expired. Sign in again.');
  const user = await response.json() as User;
  if (!user.id) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
  return { user, accessToken, db: serviceDb(), callerDb: userDb(accessToken) };
}

function params(query: Record<string, string>): Record<string, string> {
  return query;
}

async function one<T>(db: DbLike, table: string, filters: Record<string, string>, label: string): Promise<T> {
  const result = await db.select<T>(table, params({ select: '*', ...filters, limit: '1' }));
  if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', `${label} was not found.`);
  return result.rows[0];
}

async function maybeOne<T>(db: DbLike, table: string, filters: Record<string, string>): Promise<T | null> {
  const result = await db.select<T>(table, params({ select: '*', ...filters, limit: '1' }));
  return result.rows[0] ?? null;
}

async function settings(db: DbLike): Promise<Settings> {
  return await one<Settings>(db, 'settings', { singleton: 'eq.true' }, 'Server settings');
}

function ensureAttacksEnabled(config: Settings, guard?: GuardRow): void {
  if (!config.human_attacks_enabled) throw new ApiError(503, 'ATTACKS_DISABLED', 'Human heists are temporarily disabled.');
  if (guard && (config.disabled_guard_ids.includes(guard.id) || config.disabled_guard_ids.includes(guard.family_id))) {
    throw new ApiError(403, 'GUARD_DISABLED', 'This Warden is temporarily unavailable.');
  }
}

function toGuard(row: GuardRow): Guard {
  return GuardSchema.parse({
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    refusalStyle: row.refusal_style,
    talkativeness: row.talkativeness,
    revealKeyFormat: row.reveal_key_format,
    fields: row.fields,
    keyType: row.key_type,
    published: row.published,
    version: row.version,
    lookSeed: row.look_seed,
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.created_at),
  });
}

function isoTimestamp(value: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new ApiError(500, 'INVALID_DATABASE_TIMESTAMP', 'The stored timestamp is invalid.');
  return new Date(milliseconds).toISOString();
}

function getGateway(): Gateway {
  const configured = modelConfigFile.defender[0];
  if (!configured) throw new ApiError(500, 'SERVER_CONFIGURATION', 'The defender model is not configured.');
  const provider = {
    ...configured,
    baseUrl: Deno.env.get('DEFENDER_BASE_URL') ?? configured.baseUrl,
    model: Deno.env.get('DEFENDER_MODEL') ?? configured.model,
  };
  const config: ModelConfig = { ...modelConfigFile, defender: [provider] };
  return new Gateway(config, undefined, (name) => Deno.env.get(name));
}

function publicDbError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DatabaseError) {
    const code = error.databaseCode === 'P0001' ? error.message : error.databaseCode;
    const known: Record<string, [number, string, string]> = {
      USER_DAILY_SESSION_LIMIT: [429, 'USER_DAILY_SESSION_LIMIT', 'You have reached today’s heist limit.'],
      USER_GUARD_DAILY_SESSION_LIMIT: [429, 'USER_GUARD_DAILY_SESSION_LIMIT', 'You have reached today’s limit for this Warden.'],
      ACTIVE_SESSION_LIMIT: [409, 'ACTIVE_SESSION_LIMIT', 'Finish your active heist against this Warden first.'],
      GLOBAL_DAILY_TOKEN_BUDGET: [429, 'GLOBAL_DAILY_TOKEN_BUDGET', 'The daily model budget has been reached. Try again tomorrow.'],
      USER_DAILY_TOKEN_BUDGET: [429, 'USER_DAILY_TOKEN_BUDGET', 'You have reached today’s model budget. Try again tomorrow.'],
      HUMAN_ATTACKS_DISABLED: [503, 'ATTACKS_DISABLED', 'Human heists are temporarily disabled.'],
      GUARD_NOT_AVAILABLE: [404, 'GUARD_NOT_AVAILABLE', 'This Warden is not available for heists.'],
      CANNOT_ATTACK_OWN_GUARD: [403, 'CANNOT_ATTACK_OWN_GUARD', 'You cannot attack your own Warden.'],
      GUARD_DISABLED: [403, 'GUARD_DISABLED', 'This Warden is temporarily unavailable.'],
      SETTINGS_NOT_CONFIGURED: [503, 'SETTINGS_NOT_CONFIGURED', 'Heist settings are not configured yet.'],
      ORDERS_TOO_LONG: [400, 'ORDERS_TOO_LONG', 'Orders must be 2,000 characters or fewer.'],
    };
    if (code && known[code]) {
      const [status, apiCode, message] = known[code]!;
      return new ApiError(status, apiCode, message);
    }
    if (error.status === 409 || code === '23505') return new ApiError(409, 'CONFLICT', 'That change conflicts with existing data.');
    if (error.status === 400) return new ApiError(400, 'INVALID_REQUEST', 'The request does not match the required format.');
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'The request could not be completed.');
}

function handleError(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return json(400, { error: { code: 'INVALID_BODY', message: 'Check the request fields and try again.' } });
  }
  const apiError = publicDbError(error);
  const body: Record<string, unknown> = { error: { code: apiError.code, message: apiError.message } };
  if (apiError.details !== undefined) body.details = apiError.details;
  return json(apiError.status, body);
}

async function loadOwnedGuard(db: DbLike, userId: string, guardId: string): Promise<GuardRow> {
  return await one<GuardRow>(db, 'guards', { id: `eq.${guardId}`, owner_id: `eq.${userId}` }, 'Warden');
}

async function guardCreate(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const config = await settings(db);
  const parsed = CreateGuardInputSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'INVALID_GUARD', 'Check the Warden name, orders, wards and key type.', parsed.error.flatten());
  if (parsed.data.instructions.length > config.max_orders_length) {
    throw new ApiError(400, 'ORDERS_TOO_LONG', `Orders must be ${config.max_orders_length} characters or fewer.`);
  }

  const input = parsed.data;
  const familyId = typeof body.familyId === 'string' ? parseUuid(body.familyId, 'familyId') : crypto.randomUUID();
  let version = 1;
  let lookSeed = input.lookSeed ?? crypto.randomUUID();
  if (body.familyId) {
    const family = await db.select<GuardRow>('guards', {
      select: '*', owner_id: `eq.${user.id}`, family_id: `eq.${familyId}`, order: 'version.desc', limit: '1',
    });
    if (!family.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Warden family was not found.');
    version = family.rows[0].version + 1;
    lookSeed = family.rows[0].look_seed;
  }
  const id = version === 1 ? familyId : crypto.randomUUID();
  const created = await db.insert<GuardRow>('guards', [{
    id,
    family_id: familyId,
    owner_id: user.id,
    version,
    name: input.name,
    instructions: input.instructions,
    fields: input.fields,
    refusal_style: input.refusalStyle,
    talkativeness: input.talkativeness,
    key_type: input.keyType,
    lock_type: input.keyType === 'code' ? 'combo' : input.keyType === 'word' ? 'passphrase' : 'pin',
    reveal_key_format: input.revealKeyFormat,
    look_seed: lookSeed,
    published: false,
  }]);
  const row = created[0];
  if (!row) throw new ApiError(500, 'INTERNAL_ERROR', 'The Warden could not be saved.');
  return { guard: { ...row, owner_id: undefined, instructions: row.instructions } };
}

async function guardListMine(user: User, db: DbLike, callerDb: DbLike): Promise<unknown> {
  const result = await db.select<GuardRow>('guards', {
    select: '*', owner_id: `eq.${user.id}`, order: 'family_id.asc,version.desc',
  });
  if (result.rows.length === 0) return { guards: [] };
  const ids = result.rows.map((row) => row.id);
  const stats = await callerDb.select<Record<string, unknown>>('guard_version_stats', {
    select: '*', id: `in.(${ids.join(',')})`,
  });
  const byId = new Map(stats.rows.map((row) => [row.id as string, row]));
  return {
    guards: result.rows.map((row) => ({ ...row, stats: byId.get(row.id) ?? null })),
  };
}

async function guardPublish(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const guardId = parseUuid(body.guardId, 'guardId');
  if (typeof body.published !== 'boolean') throw new ApiError(400, 'INVALID_BODY', 'published must be true or false.');
  const guard = await loadOwnedGuard(db, user.id, guardId);
  const rows = await db.patch<GuardRow>('guards', { id: `eq.${guard.id}`, owner_id: `eq.${user.id}` }, { published: body.published });
  if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Warden was not found.');
  return { guard: { ...rows[0], owner_id: undefined } };
}

async function guardBrowse(request: Request, callerDb: DbLike, db: DbLike): Promise<unknown> {
  const url = new URL(request.url);
  const lockType = url.searchParams.get('lockType') ?? 'all';
  const sort = url.searchParams.get('sort') ?? 'freshest';
  const page = Number(url.searchParams.get('page') ?? '1');
  if (!['all', 'combo', 'passphrase', 'pin'].includes(lockType)) throw new ApiError(400, 'INVALID_FILTER', 'Choose All, Combo, Passphrase or PIN.');
  if (!['freshest', 'toughest', 'most-cracked'].includes(sort)) throw new ApiError(400, 'INVALID_SORT', 'Choose Freshest, Toughest or Most cracked.');
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new ApiError(400, 'INVALID_PAGE', 'Page must be a positive whole number.');
  const size = 24;
  const orders: Record<string, string> = {
    freshest: 'posted_at.desc,id.asc',
    toughest: 'break_rate.asc.nullsfirst,attempts.desc,posted_at.desc',
    'most-cracked': 'breaks.desc,attempts.desc,posted_at.desc',
  };
  const query: Record<string, string> = {
    select: '*',
    published: 'eq.true',
    order: orders[sort]!,
  };
  if (lockType !== 'all') query.lock_type = `eq.${lockType}`;
  if (sort === 'toughest') query.attempts = 'gte.20';
  const result = await callerDb.select<Record<string, unknown>>('guard_version_stats', query, {
    range: [(page - 1) * size, page * size - 1], exactCount: true,
  });
  const items = result.rows.map((row) => ({
    id: row.id,
    familyId: row.family_id,
    version: row.version,
    name: row.name,
    lookSeed: row.look_seed,
    lockType: row.lock_type,
    keyFormatHint: row.reveal_key_format ? formatHint(row.key_type as Guard['keyType']) : null,
    attempts: row.attempts,
    breaks: row.breaks,
    breakRate: row.break_rate,
    averagePicksToCrack: row.average_picks_to_crack,
    averageSurvivalPicks: row.average_survival_picks,
    postedAt: row.posted_at,
  }));
  const config = await settings(db);
  return {
    items,
    total: result.totalCount ?? items.length,
    page,
    pageSize: size,
    attacksEnabled: config.human_attacks_enabled,
    limits: {
      picks: config.max_messages_per_session,
      patrolSeconds: config.session_time_limit_seconds,
      wrongAttempts: config.max_wrong_attempts,
      cooldownSeconds: config.cooldown_seconds,
      maxMessageLength: config.max_message_length,
    },
  };
}

function formatHint(keyType: Guard['keyType']): string {
  if (keyType === 'word') return 'A word';
  if (keyType === 'number') return 'A 10-digit PIN';
  return 'A 10-character code';
}

function parseUuid(value: unknown, field: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'INVALID_BODY', `${field} must be a valid id.`);
  return parsed.data;
}

async function guardForAttacking(db: DbLike, guardId: string): Promise<GuardRow> {
  const guard = await maybeOne<GuardRow>(db, 'guards', { id: `eq.${guardId}`, published: 'eq.true' });
  if (!guard) throw new ApiError(404, 'GUARD_NOT_AVAILABLE', 'This Warden is not available for heists.');
  return guard;
}

async function attackStart(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const guardId = parseUuid(body.guardId, 'guardId');
  const config = await settings(db);
  ensureAttacksEnabled(config);
  const guard = await guardForAttacking(db, guardId);
  ensureAttacksEnabled(config, guard);
  const secret = generateSecret({ keyType: guard.key_type });
  const sessionId = crypto.randomUUID();
  await db.rpc<string>('reserve_attack_session', {
    p_session_id: sessionId,
    p_guard_id: guard.id,
    p_guard_family_id: guard.family_id,
    p_attacker_id: user.id,
    p_secret: secret,
  });
  return {
    sessionId,
    limits: {
      picks: config.max_messages_per_session,
      patrolSeconds: config.session_time_limit_seconds,
      wrongAttempts: config.max_wrong_attempts,
      cooldownSeconds: config.cooldown_seconds,
      maxMessageLength: config.max_message_length,
    },
    ...(guard.reveal_key_format ? { keyFormatHint: formatHint(guard.key_type) } : {}),
    startedAt: new Date().toISOString(),
  };
}

async function consumeRate(db: DbLike, userId: string): Promise<void> {
  const result = await db.rpc<Array<{ allowed: boolean; requests_remaining: number }>>('consume_user_message_rate_slot', { p_user_id: userId });
  const row = Array.isArray(result) ? result[0] : undefined;
  if (!row?.allowed) throw new ApiError(429, 'MESSAGE_RATE_LIMIT', 'Too many heist requests. Wait a minute and try again.');
}

async function acquireLock(db: DbLike, sessionId: string, attackerId: string): Promise<string> {
  const token = crypto.randomUUID();
  const acquired = await db.rpc<boolean>('acquire_session_processing_lock', {
    p_session_id: sessionId,
    p_attacker_id: attackerId,
    p_processing_token: token,
  });
  if (!acquired) throw new ApiError(409, 'SESSION_BUSY', 'This heist is already processing another request.');
  return token;
}

async function getActiveSession(db: DbLike, userId: string, sessionId: string): Promise<SessionRow> {
  const session = await one<SessionRow>(db, 'sessions', { id: `eq.${sessionId}`, attacker_id: `eq.${userId}` }, 'Heist');
  if (session.status !== 'active') throw new ApiError(409, 'SESSION_ENDED', 'This heist has ended.');
  return session;
}

async function turnRows(db: DbLike, sessionId: string): Promise<TurnRow[]> {
  const result = await db.select<TurnRow>('turns', {
    select: '*', session_id: `eq.${sessionId}`, order: 'turn_index.asc,role.asc',
  });
  return result.rows;
}

function engineTurns(rows: TurnRow[]): TranscriptMessage[] {
  return rows.map((row) => ({
    role: row.role,
    content: row.content,
    turn: row.turn_index,
    timestamp: isoTimestamp(row.created_at),
  })) as TranscriptMessage[];
}

async function getSessionInputs(db: DbLike, session: SessionRow): Promise<{ guard: GuardRow; secret: string; turns: TurnRow[] }> {
  const [guard, secretRow, turns] = await Promise.all([
    one<GuardRow>(db, 'guards', { id: `eq.${session.guard_id}` }, 'Warden'),
    one<SecretRow>(db, 'session_secrets', { session_id: `eq.${session.id}` }, 'Heist secret'),
    turnRows(db, session.id),
  ]);
  return { guard, secret: secretRow.secret, turns };
}

function engineState(session: SessionRow, guardVersion: number, secret: string, turns: TurnRow[], leakFlags: LeakFlagRow[]): SessionState {
  return {
    id: session.id,
    guardId: session.guard_id,
    guardVersion,
    secret,
    turns: engineTurns(turns),
    picksUsed: session.picks_used,
    wrongGuesses: session.wrong_guesses,
    leakFlags: leakFlags.map((flag) => ({
      turn: flag.turn_index,
      method: flag.method as SessionState['leakFlags'][number]['method'],
      matchedText: flag.matched_text,
      index: flag.char_index,
    })),
    status: 'active',
    endReason: null,
    startedAt: isoTimestamp(session.started_at),
  };
}

async function saveTurnResult(
  db: DbLike,
  session: SessionRow,
  originalTurnCount: number,
  originalFlagCount: number,
  state: SessionState,
  winningGuess?: string,
): Promise<void> {
  const added = state.turns.slice(originalTurnCount);
  if (added.length > 0) {
    await db.insert('turns', added.map((turn) => ({
      session_id: session.id,
      turn_index: turn.turn,
      role: turn.role,
      content: turn.content,
      created_at: turn.timestamp,
    })));
  }
  const newFlags = state.leakFlags.slice(originalFlagCount);
  if (newFlags.length > 0) {
    await db.insert('leak_flags', newFlags.map((flag) => ({
      session_id: session.id,
      turn_index: flag.turn,
      method: flag.method,
      matched_text: flag.matchedText,
      char_index: flag.index,
    })));
  }
  const patch: Record<string, unknown> = {
    picks_used: state.picksUsed,
    wrong_guesses: state.wrongGuesses,
  };
  if (state.status === 'ended') {
    patch.status = 'ended';
    patch.end_reason = state.endReason;
    patch.ended_at = new Date().toISOString();
    if (state.endReason === 'cracked') patch.winning_guess = winningGuess ?? state.secret;
  }
  await db.patch('sessions', { id: `eq.${session.id}` }, patch);
}

async function usageLog(db: DbLike, userId: string, sessionId: string, gateway: Gateway, success: boolean): Promise<void> {
  const records = gateway.getUsageLog().filter((entry) => entry.role === 'defender');
  const provider = records.at(-1);
  await db.insert('usage_ledger', [{
    user_id: userId,
    session_id: sessionId,
    role: 'defender',
    provider: provider?.provider ?? 'configured-provider',
    model: provider?.model ?? Deno.env.get('DEFENDER_MODEL') ?? modelConfigFile.defender[0]?.model ?? 'configured-model',
    prompt_tokens: provider?.promptTokens ?? 0,
    completion_tokens: provider?.completionTokens ?? 0,
    total_tokens: provider?.totalTokens ?? 0,
    latency_ms: provider?.latencyMs ?? 0,
    success: success && (provider?.success ?? false),
  }]);
}

function turnMetrics(session: SessionRow, config: Settings): { picksLeft: number; attemptsLeft: number; serverTimeRemaining: number } {
  const deadline = Date.parse(session.started_at) + config.session_time_limit_seconds * 1000;
  return {
    picksLeft: Math.max(0, config.max_messages_per_session - session.picks_used),
    attemptsLeft: Math.max(0, config.max_wrong_attempts - session.wrong_guesses),
    serverTimeRemaining: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  };
}

async function checkMessageCooldown(db: DbLike, session: SessionRow, config: Settings): Promise<void> {
  if (config.cooldown_seconds <= 0) return;
  const last = await db.select<TurnRow>('turns', {
    select: 'created_at', session_id: `eq.${session.id}`, role: 'eq.defender', order: 'created_at.desc', limit: '1',
  });
  const timestamp = last.rows[0]?.created_at;
  if (!timestamp) return;
  const remaining = config.cooldown_seconds - Math.floor((Date.now() - Date.parse(timestamp)) / 1000);
  if (remaining > 0) throw new ApiError(429, 'COOLDOWN', `Wait ${remaining} seconds before sending another message.`, { retryAfterSeconds: remaining, ...turnMetrics(session, config) });
}

async function attackMessage(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const sessionId = parseUuid(body.sessionId, 'sessionId');
  if (typeof body.message !== 'string') throw new ApiError(400, 'INVALID_MESSAGE', 'message must be text.');
  const config = await settings(db);
  ensureAttacksEnabled(config);
  await consumeRate(db, user.id);
  const token = await acquireLock(db, sessionId, user.id);
  try {
    const session = await getActiveSession(db, user.id, sessionId);
    const { guard, secret, turns } = await getSessionInputs(db, session);
    ensureAttacksEnabled(config, guard);
    await checkMessageCooldown(db, session, config);
    const leakRows = await db.select<LeakFlagRow>('leak_flags', { select: '*', session_id: `eq.${session.id}` });
    const gateway = getGateway();
    const result = await playTurn(engineState(session, guard.version, secret, turns, leakRows.rows), {
      type: 'message', message: body.message,
    }, {
      gateway,
      guard: toGuard(guard),
      maxMessages: config.max_messages_per_session,
      maxMessageLength: config.max_message_length,
      maxWrongAttempts: config.max_wrong_attempts,
      defenderMaxReplyTokensCeiling: config.defender_max_reply_tokens_ceiling,
      deadline: Date.parse(session.started_at) + config.session_time_limit_seconds * 1000,
    });
    const success = !result.events.some((event) => event.type === 'turn_errored');
    if (result.reply !== null || !success) await usageLog(db, user.id, session.id, gateway, success);
    if (!result.events.some((event) => event.type === 'turn_errored') || result.state.status === 'ended') {
      await saveTurnResult(db, session, turns.length, leakRows.rows.length, result.state);
    }
    return {
      reply: result.reply,
      ended: result.ended,
      outcome: result.state.endReason,
      events: result.events,
      ...turnMetrics({ ...session, picks_used: result.state.picksUsed, wrong_guesses: result.state.wrongGuesses }, config),
      serverTime: new Date().toISOString(),
    };
  } finally {
    await db.rpc('release_session_processing_lock', { p_session_id: sessionId, p_processing_token: token }).catch(() => false);
  }
}

async function attackGuess(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const sessionId = parseUuid(body.sessionId, 'sessionId');
  if (typeof body.guess !== 'string' || body.guess.length === 0 || body.guess.length > 100) {
    throw new ApiError(400, 'INVALID_GUESS', 'Enter a guess of 1 to 100 characters.');
  }
  const config = await settings(db);
  ensureAttacksEnabled(config);
  await consumeRate(db, user.id);
  const token = await acquireLock(db, sessionId, user.id);
  try {
    const session = await getActiveSession(db, user.id, sessionId);
    const { guard, secret, turns } = await getSessionInputs(db, session);
    ensureAttacksEnabled(config, guard);
    const leakRows = await db.select<LeakFlagRow>('leak_flags', { select: '*', session_id: `eq.${session.id}` });
    const result = await playTurn(engineState(session, guard.version, secret, turns, leakRows.rows), {
      type: 'guess', guess: body.guess,
    }, {
      gateway: getGateway(),
      guard: toGuard(guard),
      maxMessages: config.max_messages_per_session,
      maxMessageLength: config.max_message_length,
      maxWrongAttempts: config.max_wrong_attempts,
      defenderMaxReplyTokensCeiling: config.defender_max_reply_tokens_ceiling,
      deadline: Date.parse(session.started_at) + config.session_time_limit_seconds * 1000,
    });
    await saveTurnResult(db, session, turns.length, leakRows.rows.length, result.state, body.guess);
    return {
      correct: result.events.some((event) => event.type === 'guess_correct'),
      ended: result.ended,
      outcome: result.state.endReason,
      events: result.events,
      attemptsLeft: Math.max(0, config.max_wrong_attempts - result.state.wrongGuesses),
      picksLeft: Math.max(0, config.max_messages_per_session - result.state.picksUsed),
      serverTime: new Date().toISOString(),
    };
  } finally {
    await db.rpc('release_session_processing_lock', { p_session_id: sessionId, p_processing_token: token }).catch(() => false);
  }
}

async function attackResult(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const sessionId = parseUuid(body.sessionId, 'sessionId');
  let session = await one<SessionRow>(db, 'sessions', { id: `eq.${sessionId}` }, 'Heist');
  const guard = await one<GuardRow>(db, 'guards', { id: `eq.${session.guard_id}` }, 'Warden');
  const isAttacker = session.attacker_id === user.id;
  const isOwner = guard.owner_id === user.id;
  if (!isAttacker && !isOwner) throw new ApiError(404, 'NOT_FOUND', 'Heist was not found.');
  if (session.status === 'active' && Date.now() >= Date.parse(session.started_at) + (await settings(db)).session_time_limit_seconds * 1000) {
    const processingToken = await acquireLock(db, session.id, session.attacker_id);
    try {
      session = await one<SessionRow>(db, 'sessions', { id: `eq.${session.id}` }, 'Heist');
      if (session.status === 'active') {
        await db.patch('sessions', { id: `eq.${session.id}`, status: 'eq.active' }, {
          status: 'ended', end_reason: 'expired', ended_at: new Date().toISOString(),
        });
        session = await one<SessionRow>(db, 'sessions', { id: `eq.${session.id}` }, 'Heist');
      }
    } finally {
      await db.rpc('release_session_processing_lock', { p_session_id: session.id, p_processing_token: processingToken }).catch(() => false);
    }
  }
  if (session.status === 'active') throw new ApiError(409, 'SESSION_ACTIVE', 'The heist result is available after the heist ends.');
  const [secretRow, turns] = await Promise.all([
    one<SecretRow>(db, 'session_secrets', { session_id: `eq.${session.id}` }, 'Heist secret'),
    turnRows(db, session.id),
  ]);
  const ownerOrders = isOwner;
  const cracked = session.end_reason === 'cracked';
  return {
    sessionId: session.id,
    outcome: session.end_reason,
    guard: { id: guard.id, name: guard.name, lookSeed: guard.look_seed, lockType: guard.lock_type },
    picksUsed: session.picks_used,
    wrongGuesses: session.wrong_guesses,
    secondsUsed: Math.max(0, Math.ceil(((Date.parse(session.ended_at ?? new Date().toISOString())) - Date.parse(session.started_at)) / 1000)),
    key: secretRow.secret,
    winningGuess: session.winning_guess,
    orders: ownerOrders || (isAttacker && cracked) ? guard.instructions : null,
    transcript: turns.map((turn) => ({ role: turn.role, content: turn.content, turn: turn.turn_index, timestamp: turn.created_at })),
    leakFlags: ownerOrders ? await db.select<LeakFlagRow>('leak_flags', { select: 'turn_index,method,matched_text,char_index', session_id: `eq.${session.id}` }).then((rows) => rows.rows.map((flag) => ({ turn: flag.turn_index, method: flag.method, matchedText: flag.matched_text, index: flag.char_index }))) : undefined,
  };
}

/**
 * Lets the attacker resume their own heist after a page reload. It returns only what
 * that attacker has already seen: their messages, the Warden's replies and the counters.
 * It never returns the key, the orders or leak flags.
 */
async function attackState(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const sessionId = parseUuid(body.sessionId, 'sessionId');
  const config = await settings(db);
  const session = await one<SessionRow>(db, 'sessions', { id: `eq.${sessionId}`, attacker_id: `eq.${user.id}` }, 'Heist');
  const metrics = turnMetrics(session, config);
  const timedOut = session.status === 'active' && metrics.serverTimeRemaining <= 0;
  if (session.status !== 'active' || timedOut) {
    return {
      sessionId: session.id,
      ended: true,
      outcome: timedOut ? 'expired' : session.end_reason,
      serverTime: new Date().toISOString(),
    };
  }
  const [guard, turns] = await Promise.all([
    one<GuardRow>(db, 'guards', { id: `eq.${session.guard_id}` }, 'Warden'),
    turnRows(db, session.id),
  ]);
  return {
    sessionId: session.id,
    ended: false,
    outcome: null,
    guard: {
      id: guard.id,
      name: guard.name,
      lookSeed: guard.look_seed,
      lockType: guard.lock_type,
      keyFormatHint: guard.reveal_key_format ? formatHint(guard.key_type) : null,
    },
    limits: {
      picks: config.max_messages_per_session,
      patrolSeconds: config.session_time_limit_seconds,
      wrongAttempts: config.max_wrong_attempts,
      cooldownSeconds: config.cooldown_seconds,
      maxMessageLength: config.max_message_length,
    },
    transcript: turns.map((turn) => ({ role: turn.role, content: turn.content, turn: turn.turn_index, timestamp: turn.created_at })),
    ...metrics,
    startedAt: session.started_at,
    serverTime: new Date().toISOString(),
  };
}

async function ownerSessions(request: Request, user: User, db: DbLike): Promise<unknown> {
  const url = new URL(request.url);
  const guardId = parseUuid(url.searchParams.get('guardId'), 'guardId');
  const guard = await loadOwnedGuard(db, user.id, guardId);
  const result = await db.select<SessionRow>('sessions', {
    select: '*', guard_id: `eq.${guard.id}`, order: 'created_at.desc', limit: '100',
  });
  if (result.rows.length === 0) return { sessions: [], guard: { id: guard.id, instructions: guard.instructions } };
  const sessionIds = result.rows.map((row) => row.id);
  const userIds = [...new Set(result.rows.map((row) => row.attacker_id))];
  const [profiles, allTurns, allFlags] = await Promise.all([
    db.select<{ id: string; callsign: string }>('profiles', { select: 'id,callsign', id: `in.(${userIds.join(',')})` }),
    db.select<TurnRow>('turns', { select: '*', session_id: `in.(${sessionIds.join(',')})`, order: 'turn_index.asc,role.asc' }),
    db.select<LeakFlagRow & { session_id: string }>('leak_flags', { select: '*', session_id: `in.(${sessionIds.join(',')})` }),
  ]);
  const callsigns = new Map(profiles.rows.map((profile) => [profile.id, profile.callsign]));
  const turnsBySession = new Map<string, TurnRow[]>();
  for (const turn of allTurns.rows) turnsBySession.set(turn.session_id, [...(turnsBySession.get(turn.session_id) ?? []), turn]);
  const flagsBySession = new Map<string, (LeakFlagRow & { session_id: string })[]>();
  for (const flag of allFlags.rows) flagsBySession.set(flag.session_id, [...(flagsBySession.get(flag.session_id) ?? []), flag]);
  return {
    guard: { id: guard.id, familyId: guard.family_id, version: guard.version, instructions: guard.instructions },
    sessions: result.rows.map((session) => ({
      id: session.id,
      attackerCallsign: callsigns.get(session.attacker_id) ?? 'Unknown player',
      outcome: session.end_reason,
      status: session.status,
      picksUsed: session.picks_used,
      secondsUsed: session.ended_at ? Math.max(0, Math.ceil((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 1000)) : null,
      createdAt: session.created_at,
      winningGuess: session.status === 'active' ? null : session.winning_guess,
      transcript: session.status === 'active' ? [] : (turnsBySession.get(session.id) ?? []).map((turn) => ({
        role: turn.role, content: turn.content, turn: turn.turn_index, timestamp: turn.created_at,
      })),
      leakFlags: session.status === 'active' ? [] : (flagsBySession.get(session.id) ?? []).map((flag) => ({
        turn: flag.turn_index, method: flag.method, matchedText: flag.matched_text, index: flag.char_index,
      })),
    })),
  };
}

async function reportCreate(request: Request, user: User, db: DbLike): Promise<unknown> {
  const body = await readBody(request);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'INVALID_REPORT', 'Choose a report reason and add a note of at most 2,000 characters.', parsed.error.flatten());
  const guard = await one<GuardRow>(db, 'guards', { id: `eq.${parsed.data.guardId}`, published: 'eq.true' }, 'Published Warden');
  if (guard.owner_id === user.id) throw new ApiError(400, 'CANNOT_REPORT_OWN_GUARD', 'You cannot report your own Warden.');
  const rows = await db.insert<Record<string, unknown>>('reports', [{
    guard_id: guard.id,
    reporter_id: user.id,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
    status: 'open',
  }]);
  return { report: { id: rows[0]?.id, status: 'open' } };
}

type HandlerName = 'guard-create' | 'guard-list-mine' | 'guard-publish' | 'guard-browse' | 'attack-start' | 'attack-message' | 'attack-guess' | 'attack-result' | 'attack-state' | 'owner-sessions' | 'report-create';

export function serveFunction(name: HandlerName): void {
  Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST' && !(name === 'guard-browse' || name === 'owner-sessions') ) {
      return json(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this request.' } });
    }
    try {
      const auth = await authenticate(request);
      let response: unknown;
      switch (name) {
        case 'guard-create': response = await guardCreate(request, auth.user, auth.db); break;
        case 'guard-list-mine': response = await guardListMine(auth.user, auth.db, auth.callerDb); break;
        case 'guard-publish': response = await guardPublish(request, auth.user, auth.db); break;
        case 'guard-browse': response = await guardBrowse(request, auth.callerDb, auth.db); break;
        case 'attack-start': response = await attackStart(request, auth.user, auth.db); break;
        case 'attack-message': response = await attackMessage(request, auth.user, auth.db); break;
        case 'attack-guess': response = await attackGuess(request, auth.user, auth.db); break;
        case 'attack-result': response = await attackResult(request, auth.user, auth.db); break;
        case 'attack-state': response = await attackState(request, auth.user, auth.db); break;
        case 'owner-sessions': response = await ownerSessions(request, auth.user, auth.db); break;
        case 'report-create': response = await reportCreate(request, auth.user, auth.db); break;
      }
      return json(200, response);
    } catch (error) {
      return handleError(error);
    }
  });
}
