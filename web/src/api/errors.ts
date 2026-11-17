/** An error returned by the API, with the server's stable code. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Plain messages from the design doc's system states. Anything unknown becomes the server-error line. */
const MESSAGES: Record<string, string> = {
  ATTACKS_DISABLED: 'Heists are paused for now. You can still build and post Wardens.',
  GLOBAL_DAILY_TOKEN_BUDGET: 'The workshop is out of power for today. Come back tomorrow.',
  USER_DAILY_TOKEN_BUDGET: "You're out of heists for today.",
  USER_GUARD_DAILY_SESSION_LIMIT: "You've used today's heists on this vault. Try another one.",
  USER_DAILY_SESSION_LIMIT: "You're out of heists for today.",
  GUARD_DISABLED: 'This Warden has been sealed.',
  GUARD_NOT_AVAILABLE: "That vault doesn't exist. It may have been taken down.",
  COOLDOWN: 'Easy there. Wait a few seconds between messages.',
  MESSAGE_RATE_LIMIT: 'Easy there. Wait a few seconds between messages.',
  AUTH_REQUIRED: 'Your session ended. Sign in again.',
  NETWORK: "You're offline. Messages can't be sent.",
  ORDERS_TOO_LONG: 'Orders are over the limit. Shorten them to 2,000 characters.',
  CALLSIGN_TAKEN: 'That callsign is taken.',
  BAD_CREDENTIALS: "That email and password don't match.",
};

const SERVER_ERROR = 'Something broke on our side. Try again in a moment.';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const known = MESSAGES[error.code];
    if (known) return known;
    // Codes the design has no line for keep the server's own plain-language message.
    if (['ACTIVE_SESSION_LIMIT', 'CANNOT_ATTACK_OWN_GUARD', 'CANNOT_REPORT_OWN_GUARD', 'INVALID_GUESS', 'INVALID_GUARD'].includes(error.code)) {
      return error.message;
    }
  }
  return SERVER_ERROR;
}

export function isErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
