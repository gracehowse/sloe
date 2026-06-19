import { Redis } from "@upstash/redis";

const gUpstash = globalThis as unknown as {
  __pm_upstashRedis?: Redis | null;
};

export function getRedis(): Redis | null {
  if (gUpstash.__pm_upstashRedis !== undefined) return gUpstash.__pm_upstashRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    gUpstash.__pm_upstashRedis = null;
    return null;
  }
  gUpstash.__pm_upstashRedis = new Redis({ url, token });
  return gUpstash.__pm_upstashRedis;
}

export function __setUpstashRedisForTests(redis: Redis | null | undefined): void {
  gUpstash.__pm_upstashRedis = redis;
}
