import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { CACHE_TTL } from "@knesset-vote/shared";

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  return redisClient;
}

export async function setupRedis(app: FastifyInstance): Promise<void> {
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) {
    app.log.warn("REDIS_URL not set - caching disabled");
    return;
  }

  try {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    await redisClient.connect();
    app.log.info("Redis connected");

    // Decorate the fastify instance
    app.decorate("redis", redisClient);
  } catch (err) {
    app.log.warn({ err }, "Failed to connect to Redis - caching disabled");
    redisClient = null;
  }
}

export async function getCached<T>(
  key: string,
  ttl: number = CACHE_TTL.SHORT,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Cache miss or error - fall through to fetcher
    }
  }

  const data = await fetcher();

  if (redis) {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
    } catch {
      // Non-fatal
    }
  }

  return data;
}

export function buildCacheKey(route: string, params: Record<string, unknown>): string {
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v ?? "")}`)
    .join("&");
  return `cache:${route}:${paramStr}`;
}
