import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash is reached over plain HTTPS, so this works from serverless functions
// without connection pooling. Free tier: 500K commands/month — each limit
// check costs ~1 command, far below that at portfolio scale.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  console.warn(
    "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — rate limiting is disabled."
  );
}

// Sliding window instead of fixed window: a fixed window lets a client send
// 2x the limit by straddling the window boundary.
function limiter(requests: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  return redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        prefix,
        analytics: false,
      })
    : null;
}

// Unauthenticated endpoints are keyed by IP: strict, because attackers here
// have no account to lose.
export const authLimiter = limiter(10, "10 m", "rl:auth");

// AI endpoints are keyed by user id: each request spends shared free-tier
// model quota, so one user must not be able to drain it in a burst.
export const aiLimiter = limiter(10, "1 m", "rl:ai");

// General authenticated writes (documents, invitations), keyed by user id.
export const apiLimiter = limiter(60, "1 m", "rl:api");

// Returns a 429 response if the key is over the limit, or null to proceed.
// Fails open on missing config or Redis outage: availability of the app
// matters more than rate limiting being airtight.
export async function enforceRateLimit(
  rl: Ratelimit | null,
  key: string
): Promise<NextResponse | null> {
  if (!rl) return null;
  try {
    const { success, reset } = await rl.limit(key);
    if (success) return null;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  } catch (error) {
    console.error("Rate limit check failed, allowing request:", error);
    return null;
  }
}

// First entry in x-forwarded-for is the real client; Vercel sets this header
// on every request. Locally it is absent, so all traffic shares one bucket.
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
