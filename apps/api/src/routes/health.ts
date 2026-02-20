import type { FastifyInstance } from "fastify";
import { db } from "@knesset-vote/db";
import { getRedis } from "../plugins/redis.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/health",
    {
      schema: {
        description: "Health check endpoint",
        tags: ["System"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              timestamp: { type: "string" },
              services: {
                type: "object",
                properties: {
                  database: { type: "string" },
                  redis: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (_, reply) => {
      let dbStatus: "ok" | "error" = "ok";
      let redisStatus: "ok" | "error" | "unavailable" = "unavailable";

      try {
        await db.$queryRaw`SELECT 1`;
      } catch {
        dbStatus = "error";
      }

      const redis = getRedis();
      if (redis) {
        try {
          await redis.ping();
          redisStatus = "ok";
        } catch {
          redisStatus = "error";
        }
      }

      const overallStatus =
        dbStatus === "ok"
          ? redisStatus === "ok" || redisStatus === "unavailable"
            ? "ok"
            : "degraded"
          : "error";

      reply.code(overallStatus === "error" ? 503 : 200).send({
        status: overallStatus,
        version: process.env["npm_package_version"] ?? "0.1.0",
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
      });
    },
  );
}
