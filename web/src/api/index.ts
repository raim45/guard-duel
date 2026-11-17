import type { ApiClient } from './client';
import { createHttpClient } from './http';
import { createMockClient } from './mock';

export type { ApiClient } from './client';
export { ApiError, errorMessage, isErrorCode } from './errors';
export * from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? (url && anon ? 'live' : 'mock');

/** The one client every screen uses. Set VITE_API_MODE=mock to run on mock data. */
export const api: ApiClient = mode === 'mock' || !url || !anon ? createMockClient() : createHttpClient(url, anon);
export const apiMode: 'mock' | 'live' = mode === 'mock' || !url || !anon ? 'mock' : 'live';
