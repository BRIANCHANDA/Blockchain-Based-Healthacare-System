import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

// ── AppError ──────────────────────────────────────────────────────────────────
// Throw this anywhere in route handlers when you want a specific, safe message
// shown to the user. The message is intentional and will be forwarded as-is.
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Error fingerprinting ──────────────────────────────────────────────────────
function classify(err: unknown): 'app' | 'validation' | 'database' | 'fabric' | 'auth' | 'timeout' | 'server' {
  if (err instanceof AppError) return 'app';

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  if (
    msg.includes('relation') || msg.includes('column') ||
    msg.includes('duplicate key') || msg.includes('violates') ||
    msg.includes('foreign key') || msg.includes('not-null') ||
    msg.includes('syntax error') || msg.includes('pg_') ||
    msg.includes('drizzle') || msg.includes('econnrefused')
  ) return 'database';

  if (
    msg.includes('chaincode') || msg.includes('endorse') ||
    msg.includes('aborted') || msg.includes('orderer') ||
    msg.includes('fabric') || msg.includes('peer unreachable') ||
    msg.includes('anchor') || msg.includes('msp')
  ) return 'fabric';

  if (
    msg.includes('jwt') || msg.includes('token') ||
    msg.includes('signature') || msg.includes('expired') ||
    msg.includes('jsonwebtoken')
  ) return 'auth';

  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('timed out')) {
    return 'timeout';
  }

  // Zod errors surface as { issues: [...] }
  if ((err as any)?.issues || (err as any)?.name === 'ZodError') return 'validation';

  return 'server';
}

const USER_MESSAGES: Record<ReturnType<typeof classify>, string> = {
  app:        '', // replaced with AppError's own message
  validation: 'The submitted data is invalid. Please check your inputs and try again.',
  database:   'A data error occurred. Please try again or contact support if the problem persists.',
  fabric:     'The blockchain audit service is temporarily unavailable. Your action was saved but could not be anchored to the ledger.',
  auth:       'Your session has expired or is invalid. Please sign in again.',
  timeout:    'The request took too long to complete. Please try again.',
  server:     'An unexpected error occurred. Please try again or contact support.',
};

// ── handleError ───────────────────────────────────────────────────────────────
// Drop-in replacement for the raw `c.json({ error: { message: err.message } }, 500)`
// pattern. Logs the real error server-side; sends only a safe message to the client.
export function handleError(err: unknown, c: Context) {
  // Hono raises HTTPException for problems it detects before a handler runs —
  // a malformed JSON body, an unsupported media type. Those are the CLIENT's
  // fault and already carry the right status, so preserve it. Without this they
  // fell through to the generic branch below and were reported as 500, telling
  // the caller the server had failed when their request was simply malformed.
  if (err instanceof HTTPException) {
    console.error('[HTTP]', err.status, err.message);
    return c.json(
      { success: false, error: { message: err.message || 'Invalid request.' } },
      err.status as any,
    );
  }

  const kind = classify(err);

  // Always log the full error on the server
  console.error(`[${kind.toUpperCase()}]`, err);

  if (kind === 'app') {
    const appErr = err as AppError;
    return c.json(
      { success: false, error: { message: appErr.message } },
      appErr.statusCode as any,
    );
  }

  return c.json(
    { success: false, error: { message: USER_MESSAGES[kind] } },
    500,
  );
}

// ── Hono global onError handler ───────────────────────────────────────────────
// Register with: app.onError(globalErrorHandler)
export function globalErrorHandler(err: Error, c: Context) {
  return handleError(err, c);
}
