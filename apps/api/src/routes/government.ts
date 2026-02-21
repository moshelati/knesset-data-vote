/**
 * Government routes
 *
 * GET /api/government       → list current ministers
 * GET /api/government/:id   → minister detail by MK id
 */

import type { FastifyInstance } from "fastify";
import { listMinisters, getMinisterById } from "../services/government-service.js";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";

export async function governmentRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────
  // GET /api/government
  // ─────────────────────────────────────────────
  app.get(
    "/api/government",
    {
      schema: {
        description: "List current government ministers with ministry, role, and related bills",
        tags: ["Government"],
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array" },
              total: { type: "integer" },
              methodology_url: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const cacheKey = buildCacheKey("government", {});
      const result = await getCached(cacheKey, CACHE_TTL.MEDIUM, () => listMinisters());

      reply.send({
        ...result,
        methodology_url: "/methodology#government-roles",
      });
    },
  );

  // ─────────────────────────────────────────────
  // GET /api/government/:id
  // ─────────────────────────────────────────────
  app.get(
    "/api/government/:id",
    {
      schema: {
        description: "Get full minister detail by MK id — includes role, bills, committee roles",
        tags: ["Government"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const cacheKey = buildCacheKey("government_detail", { id });
      const minister = await getCached(cacheKey, CACHE_TTL.SHORT, () => getMinisterById(id));

      if (!minister) {
        return reply.status(404).send({
          error: "Minister not found",
          message: `No current government minister found for MK id: ${id}`,
        });
      }

      reply.send({
        data: minister,
        methodology_url: "/methodology#government-roles",
        computed_fields: {
          related_bills: {
            definition:
              "Bills filtered by topic associated with the minister's ministry (manual mapping)",
            methodology_anchor: "/methodology#government-roles",
            limitations:
              "Bills are attributed by topic, not causally linked to the minister's actions",
          },
        },
      });
    },
  );
}
