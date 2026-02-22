/**
 * AI routes
 *
 * POST /api/ai/answer  → Gemini-powered "Ask + Verify" with real DB data
 *
 * Security:
 * - GEMINI_API_KEY never returned to client
 * - Per-IP rate limit: 10 req/minute (separate from global 100 req/minute)
 * - Question max 500 chars
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { askAI } from "../services/ai-service.js";

const AiAnswerBodySchema = z.object({
  question: z.string().min(3, "השאלה קצרה מדי").max(500, "השאלה ארוכה מדי"),
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────
  // POST /api/ai/answer
  // ─────────────────────────────────────────────
  app.post(
    "/api/ai/answer",
    {
      config: {
        // Per-route rate limit — overrides the global limit for this endpoint
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            error: "Too Many AI Requests",
            message: "מותרות 10 שאלות לדקה לכתובת IP. נסה שוב עוד דקה.",
            statusCode: 429,
          }),
        },
      },
      schema: {
        description:
          "Gemini-powered AI assistant. Answers questions about the Israeli Knesset using real DB data only. " +
          "GEMINI_API_KEY is server-side only — never exposed to client.",
        tags: ["AI"],
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: {
              type: "string",
              minLength: 3,
              maxLength: 500,
              description: "שאלה בעברית על הכנסת, חברי כנסת, הצעות חוק, שרים, או ועדות",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer_md: { type: "string" },
                  citations: { type: "array" },
                  entity_cards: { type: "array" },
                  tool_calls_made: { type: "array", items: { type: "string" } },
                  model: { type: "string" },
                  disclaimer: { type: "string" },
                },
              },
              methodology_url: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
          429: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
          502: {
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Validate body
      const parseResult = AiAnswerBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "Validation Error",
          message: parseResult.error.issues[0]?.message ?? "שאלה לא תקינה",
          statusCode: 400,
        });
      }

      const { question } = parseResult.data;
      const requestIp = request.ip;

      app.log.info({ question: question.slice(0, 80), ip: requestIp }, "AI question received");

      try {
        const answer = await askAI(question);

        app.log.info(
          {
            toolCalls: answer.tool_calls_made,
            citationsCount: answer.citations.length,
          },
          "AI answer generated",
        );

        reply.send({
          data: answer,
          methodology_url: "/methodology#ai-assistant",
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Don't expose GEMINI_API_KEY or internal details in the error message
        const isKeyError = errorMessage.includes("GEMINI_API_KEY");
        const isMissingKey = isKeyError || errorMessage.includes("API_KEY_INVALID");

        app.log.error(
          { err: isKeyError ? "GEMINI_API_KEY configuration error" : err },
          "AI service error",
        );

        if (isMissingKey) {
          return reply.status(502).send({
            error: "AI_UNAVAILABLE",
            message: "שירות ה-AI אינו מוגדר כרגע. פנה למנהל המערכת.",
            statusCode: 502,
          });
        }

        return reply.status(502).send({
          error: "AI_UNAVAILABLE",
          message: "שגיאה בחיבור לשירות ה-AI. נסה שוב מאוחר יותר.",
          statusCode: 502,
        });
      }
    },
  );
}
