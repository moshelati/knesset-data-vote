import type { FastifyInstance } from "fastify";
import { RecommendationRequestSchema, CACHE_TTL } from "@knesset-vote/shared";
import { getCached, buildCacheKey } from "../plugins/redis.js";
import { getRecommendations } from "../services/recommendation-service.js";

export async function recommendationRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/api/recommendations",
    {
      schema: {
        description:
          "Return top 3 parties ranked by legislative activity in user-selected topics. " +
          "Scores reflect bill data only — no political endorsements. " +
          "Run `pnpm etl:aggregate` first to populate the PartyTopicAgg table.",
        tags: ["Recommendations"],
        body: {
          type: "object",
          required: ["topics"],
          properties: {
            topics: {
              type: "array",
              minItems: 1,
              maxItems: 10,
              items: {
                type: "object",
                required: ["id", "weight"],
                properties: {
                  id: { type: "string" },
                  weight: { type: "integer", minimum: 1, maximum: 5 },
                },
              },
              description: "Selected topics with importance weights (1–5)",
            },
            free_text: {
              type: "string",
              maxLength: 500,
              description: "Optional Hebrew free-text for keyword suggestions",
            },
            ideological_preference: {
              type: "string",
              enum: ["right", "center", "left", "none"],
              description:
                "UI-only preference — accepted but NOT used in scoring (guardrail 1)",
            },
          },
        },
        response: {
          // 200 response is not schema-validated to avoid fast-json-stringify
          // stripping dynamic fields from the rich recommendation payload.
          // The payload is validated by RecommendationResponseSchema in the service.
          400: {
            description: "Invalid request body",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              details: { type: "array" },
            },
          },
          503: {
            description: "PartyTopicAgg table empty — run pnpm etl:aggregate",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Validate with Zod (more precise than JSON Schema)
      const parsed = RecommendationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Bad Request",
          message: "Invalid request body",
          details: parsed.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      }

      // Build a stable cache key from sorted topic weights
      const sortedTopics = [...parsed.data.topics]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((t) => `${t.id}:${t.weight}`)
        .join(",");
      const cacheKey = buildCacheKey("recommendations", { t: sortedTopics });

      const result = await getCached(
        cacheKey,
        CACHE_TTL.LONG,
        () => getRecommendations(parsed.data),
      );

      if (result === null) {
        return reply.code(503).send({
          message:
            "Recommendation data not available. Run `pnpm etl:aggregate` first to populate party topic scores.",
        });
      }

      return reply.send(result);
    },
  );
}
