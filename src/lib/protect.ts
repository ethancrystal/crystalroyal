import "server-only";
import { headers } from "next/headers";
import { env } from "./env";

// Bot protection (Cloudflare Turnstile) and per-IP rate limits (Upstash REST, or in-memory in development).

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export const LIMITS = {
  reserve: { max: 5, windowSec: 600 },
  upload: { max: 10, windowSec: 3600 },
  availability: { max: 60, windowSec: 60 },
  adminLogin: { max: 5, windowSec: 900 },
  cancelRequest: { max: 5, windowSec: 3600 },
} as const;

const memory = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window limiter. Returns true when the request is allowed. */
export async function rateLimit(kind: keyof typeof LIMITS, key?: string): Promise<boolean> {
  const { max, windowSec } = LIMITS[kind];
  const id = `rl:${kind}:${key ?? (await clientIp())}`;
  if (env.upstashUrl && env.upstashToken) {
    try {
      const res = await fetch(`${env.upstashUrl}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.upstashToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", id],
          ["EXPIRE", id, String(windowSec), "NX"],
        ]),
        cache: "no-store",
      });
      const out = (await res.json()) as { result: number }[];
      return (out[0]?.result ?? 0) <= max;
    } catch (e) {
      console.error("rate limit backend failed; allowing request", e);
      return true;
    }
  }
  const now = Date.now();
  const cur = memory.get(id);
  if (!cur || cur.resetAt < now) {
    memory.set(id, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  cur.count++;
  return cur.count <= max;
}

/** Verifies a Turnstile token. Skipped (true) only when no secret is configured outside production. */
export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  if (!env.turnstileSecret) {
    if (env.isProduction) console.error("TURNSTILE_SECRET_KEY is not set in production; refusing.");
    return !env.isProduction;
  }
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env.turnstileSecret, response: token, remoteip: await clientIp() });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const out = (await res.json()) as { success: boolean };
    return out.success === true;
  } catch (e) {
    console.error("turnstile verification failed", e);
    return false;
  }
}
