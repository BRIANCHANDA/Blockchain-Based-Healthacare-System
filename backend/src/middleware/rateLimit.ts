import type { MiddlewareHandler } from 'hono';

interface RateLimitOptions {
  /** Maximum requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional message returned on 429 */
  message?: string;
}

interface Bucket {
  count:     number;
  resetAt:   number;
}

/**
 * Factory that returns a Hono middleware applying a sliding-window
 * rate limit per IP address. Uses a plain Map — no external dependencies.
 *
 * Stale buckets are purged every `windowMs` to avoid unbounded memory growth.
 */
export function createRateLimiter(opts: RateLimitOptions): MiddlewareHandler {
  const store = new Map<string, Bucket>();

  // Periodic cleanup of expired buckets
  const purge = () => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (now >= bucket.resetAt) store.delete(key);
    }
  };
  setInterval(purge, opts.windowMs);

  return async (c, next) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return next();

    // Prefer X-Forwarded-For (set by a reverse proxy) then fall back to
    // the direct connection address. Never trust the header blindly in
    // production without a trusted-proxy list, but it is fine here.
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    const now  = Date.now();
    const key  = ip;
    let bucket = store.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, bucket);
    }

    bucket.count++;

    const remaining = Math.max(0, opts.limit - bucket.count);
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

    // Always set rate-limit headers so the client can adapt
    c.header('X-RateLimit-Limit',     String(opts.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset',     String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > opts.limit) {
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          success: false,
          error: {
            message: opts.message ?? 'Too many requests. Please try again later.',
          },
        },
        429,
      );
    }

    await next();
  };
}

// ── Pre-configured limiters ───────────────────────────────────────────────────

/** Strict limiter for login endpoints — 5 attempts per 15 minutes */
export const loginLimiter = createRateLimiter({
  limit:     5,
  windowMs:  15 * 60 * 1000,
  message:   'Too many login attempts. Please wait 15 minutes before trying again.',
});

/** Limiter for OTP verification — 5 attempts per 10 minutes */
export const otpLimiter = createRateLimiter({
  limit:     5,
  windowMs:  10 * 60 * 1000,
  message:   'Too many verification attempts. Please request a new code.',
});

/** Limiter for OTP resend — 3 requests per 10 minutes */
export const resendOtpLimiter = createRateLimiter({
  limit:     3,
  windowMs:  10 * 60 * 1000,
  message:   'Too many resend requests. Please wait before requesting another code.',
});

/** Limiter for registration — 10 accounts per hour per IP */
export const registerLimiter = createRateLimiter({
  limit:     10,
  windowMs:  60 * 60 * 1000,
  message:   'Too many registration attempts from this address.',
});

/** Limiter for password-change — 5 per hour */
export const passwordLimiter = createRateLimiter({
  limit:     5,
  windowMs:  60 * 60 * 1000,
  message:   'Too many password change requests. Please try again later.',
});

/** Broad API limiter — 200 requests per minute (DDoS backstop) */
export const apiLimiter = createRateLimiter({
  limit:     200,
  windowMs:  60 * 1000,
  message:   'Request rate exceeded. Please slow down.',
});
