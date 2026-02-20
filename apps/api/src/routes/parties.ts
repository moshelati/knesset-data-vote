import type { FastifyInstance } from "fastify";
import { listParties, getPartyById } from "../services/party-service.js";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { CACHE_TTL } from "@knesset-vote/shared";

export async function partyRoutes(app: FastifyInstance): Promise<void> {
  // List parties
  app.get(
    "/api/parties",
    {
      schema: {
        description: "List all parties/factions",
        tags: ["Parties"],
        querystring: {
          type: "object",
          properties: {
            search: { type: "string", maxLength: 200 },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { search, page = 1, limit = 20 } = request.query as {
        search?: string;
        page?: number;
        limit?: number;
      };

      const cacheKey = buildCacheKey("parties", { search, page, limit });
      const result = await getCached(cacheKey, CACHE_TTL.SHORT, () =>
        listParties({ search, page, limit }),
      );

      reply.send({
        ...result,
        page,
        limit,
        pages: Math.ceil(result.total / limit),
        methodology_url: "/methodology#parties",
        computed_fields: {
          definitions: "See /methodology#parties for field definitions and limitations",
        },
      });
    },
  );

  // Get single party
  app.get(
    "/api/parties/:id",
    {
      schema: {
        description: "Get party detail with MK list and activity summary",
        tags: ["Parties"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const cacheKey = buildCacheKey("party", { id });

      const party = await getCached(cacheKey, CACHE_TTL.SHORT, () => getPartyById(id));

      if (!party) {
        reply.code(404).send({ error: "Not Found", message: "Party not found", statusCode: 404 });
        return;
      }

      reply.send({
        data: party,
        methodology_url: "/methodology#parties",
        computed_fields: {
          activity_summary: {
            definition: "Counts derived from Knesset OData bill and committee data",
            limitations: "Historical data may be incomplete for earlier Knesset sessions",
            last_updated: "See /api/meta for sync timestamp",
          },
        },
      });
    },
  );
}
