import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ApiClient } from './client';
import { ApiError } from './errors';
import {
  AttackResultSchema,
  AttackStateSchema,
  BrowseResponseSchema,
  GuessResultSchema,
  MessageResultSchema,
  OwnerSessionsSchema,
  StartAttackSchema,
} from './types';
import type { MyGuard, Profile, VersionStats, WardFields } from './types';

interface GuardRow {
  id: string;
  family_id: string;
  version: number;
  name: string;
  instructions: string;
  fields: WardFields;
  refusal_style: MyGuard['refusalStyle'];
  talkativeness: MyGuard['talkativeness'];
  key_type: MyGuard['keyType'];
  lock_type: MyGuard['lockType'];
  reveal_key_format: boolean;
  look_seed: string;
  published: boolean;
  created_at: string;
  stats?: {
    attempts: number;
    breaks: number;
    break_rate: number | null;
    average_picks_to_crack: number | null;
    average_survival_picks: number | null;
  } | null;
}

function toMyGuard(row: GuardRow): MyGuard {
  const stats: VersionStats | null = row.stats
    ? {
        attempts: row.stats.attempts,
        breaks: row.stats.breaks,
        breakRate: row.stats.break_rate,
        averagePicksToCrack: row.stats.average_picks_to_crack,
        averageSurvivalPicks: row.stats.average_survival_picks,
      }
    : null;
  return {
    id: row.id,
    familyId: row.family_id,
    version: row.version,
    name: row.name,
    instructions: row.instructions,
    refusalStyle: row.refusal_style,
    talkativeness: row.talkativeness,
    keyType: row.key_type,
    lockType: row.lock_type,
    revealKeyFormat: row.reveal_key_format,
    lookSeed: row.look_seed,
    published: row.published,
    createdAt: row.created_at,
    fields: row.fields,
    stats,
  };
}

const ErrorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string() }), details: z.unknown().optional() });

export function createHttpClient(supabaseUrl: string, anonKey: string): ApiClient {
  const supabase: SupabaseClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  const signedOutListeners = new Set<() => void>();
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') signedOutListeners.forEach((listener) => listener());
  });

  async function profileFor(userId: string, email: string): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').select('callsign').eq('id', userId).maybeSingle();
    if (error) throw new ApiError(500, 'INTERNAL_ERROR', error.message);
    return { userId, email, callsign: data?.callsign ?? 'player' };
  }

  async function call<T>(name: string, schema: z.ZodType<T>, options: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
    const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
    let response: Response;
    try {
      response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}${query}`, {
        method: options.method ?? 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: options.method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'The network request failed.');
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ApiError(response.status, 'INTERNAL_ERROR', 'The server sent an unreadable reply.');
    }
    if (!response.ok) {
      const parsed = ErrorBodySchema.safeParse(json);
      if (response.status === 401) signedOutListeners.forEach((listener) => listener());
      if (parsed.success) throw new ApiError(response.status, parsed.data.error.code, parsed.data.error.message, parsed.data.details);
      throw new ApiError(response.status, 'INTERNAL_ERROR', 'The request failed.');
    }
    const result = schema.safeParse(json);
    if (!result.success) throw new ApiError(502, 'INTERNAL_ERROR', 'The server sent an unexpected reply.');
    return result.data;
  }

  const guardEnvelope = z.object({ guard: z.record(z.unknown()) });

  return {
    async getProfile() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      return user ? profileFor(user.id, user.email ?? '') : null;
    },
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) throw new ApiError(400, 'BAD_CREDENTIALS', error?.message ?? 'Sign-in failed.');
      return profileFor(data.user.id, data.user.email ?? email);
    },
    async signUp(email, password, callsign) {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { callsign } } });
      if (error) {
        const taken = /database error|callsign|duplicate|unique/i.test(error.message);
        throw new ApiError(400, taken ? 'CALLSIGN_TAKEN' : 'INVALID_GUARD', error.message);
      }
      if (!data.session || !data.user) return null;
      return profileFor(data.user.id, data.user.email ?? email);
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    async updateCallsign(callsign) {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.');
      const { error } = await supabase.from('profiles').update({ callsign }).eq('id', user.id);
      if (error) throw new ApiError(error.code === '23505' ? 409 : 400, error.code === '23505' ? 'CALLSIGN_TAKEN' : 'INVALID_GUARD', error.message);
      return { userId: user.id, email: user.email ?? '', callsign };
    },
    onSignedOut(listener) {
      signedOutListeners.add(listener);
      return () => signedOutListeners.delete(listener);
    },

    browse: (params) => call('guard-browse', BrowseResponseSchema, {
      method: 'GET',
      query: { lockType: params.lockType, sort: params.sort, page: String(params.page) },
    }),
    async listMine() {
      const result = await call('guard-list-mine', z.object({ guards: z.array(z.record(z.unknown())) }));
      return result.guards.map((row) => toMyGuard(row as unknown as GuardRow));
    },
    async createGuard(input) {
      const result = await call('guard-create', guardEnvelope, { body: input });
      return toMyGuard(result.guard as unknown as GuardRow);
    },
    async publishGuard(guardId, published) {
      const result = await call('guard-publish', guardEnvelope, { body: { guardId, published } });
      return toMyGuard(result.guard as unknown as GuardRow);
    },

    startAttack: (guardId) => call('attack-start', StartAttackSchema, { body: { guardId } }),
    sendMessage: (sessionId, message) => call('attack-message', MessageResultSchema, { body: { sessionId, message } }),
    submitGuess: (sessionId, guess) => call('attack-guess', GuessResultSchema, { body: { sessionId, guess } }),
    attackState: (sessionId) => call('attack-state', AttackStateSchema, { body: { sessionId } }),
    attackResult: (sessionId) => call('attack-result', AttackResultSchema, { body: { sessionId } }),

    ownerSessions: (guardId) => call('owner-sessions', OwnerSessionsSchema, { method: 'GET', query: { guardId } }),
    async createReport(guardId, reason, note) {
      await call('report-create', z.object({ report: z.unknown() }), { body: { guardId, reason, note: note ?? null } });
    },
  };
}
