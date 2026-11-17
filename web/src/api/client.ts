import type {
  AttackResult,
  AttackState,
  BrowseParams,
  BrowseResponse,
  CreateGuardInput,
  GuessResult,
  MessageResult,
  MyGuard,
  OwnerSessions,
  Profile,
  ReportReason,
  StartAttack,
} from './types';

/**
 * Everything the screens need from the backend. A mock and the real HTTP client both
 * implement it, so screens are built and tested against mock data first.
 */
export interface ApiClient {
  /* auth */
  getProfile(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  /** Returns null when the project requires email confirmation before the first sign-in. */
  signUp(email: string, password: string, callsign: string): Promise<Profile | null>;
  signOut(): Promise<void>;
  updateCallsign(callsign: string): Promise<Profile>;
  onSignedOut(listener: () => void): () => void;

  /* guards */
  browse(params: BrowseParams): Promise<BrowseResponse>;
  listMine(): Promise<MyGuard[]>;
  createGuard(input: CreateGuardInput): Promise<MyGuard>;
  publishGuard(guardId: string, published: boolean): Promise<MyGuard>;

  /* heist */
  startAttack(guardId: string): Promise<StartAttack>;
  sendMessage(sessionId: string, message: string): Promise<MessageResult>;
  submitGuess(sessionId: string, guess: string): Promise<GuessResult>;
  attackState(sessionId: string): Promise<AttackState>;
  attackResult(sessionId: string): Promise<AttackResult>;

  /* owner and reports */
  ownerSessions(guardId: string): Promise<OwnerSessions>;
  createReport(guardId: string, reason: ReportReason, note?: string): Promise<void>;
}
