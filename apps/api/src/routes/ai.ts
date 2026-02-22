/**
 * AI routes
 *
 * POST /api/ai/answer   → Gemini-powered "Ask + Verify" with real DB data
 * POST /api/ai/feedback → thumbs-up / thumbs-down stored in Redis
 * GET  /api/ai/stats    → question count + feedback totals (admin-friendly)
 *
 * Security:
 * - GEMINI_API_KEY never returned to client
 * - Per-IP rate limit: 10 req/minute (separate from global 100 req/minute)
 * - Question max 500 chars
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { askAI, askAIStream } from "../services/ai-service.js";
import { getRedis } from "../plugins/redis.js";

// Redis key helpers
const AI_STATS_KEY = "ai:stats"; // HASH: questions_total, feedback_up, feedback_down
const AI_QUESTIONS_ZSET = "ai:questions"; // ZSET: question → score=count (top questions)

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

        // ── Analytics: increment counters in Redis (best-effort) ──
        const redis = getRedis();
        if (redis) {
          void Promise.all([
            redis.hincrby(AI_STATS_KEY, "questions_total", 1),
            redis.zincrby(AI_QUESTIONS_ZSET, 1, question.slice(0, 200)),
          ]).catch(() => {
            /* ignore redis errors */
          });
        }

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

  // ─────────────────────────────────────────────
  // GET /api/ai/stream?q=<question>
  // Server-Sent Events — streams tool events + text chunks
  // ─────────────────────────────────────────────
  app.get(
    "/api/ai/stream",
    {
      config: {
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
          "Streaming SSE endpoint. Emits tool_start / tool_done / text_chunk / done / error events.",
        tags: ["AI"],
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 3, maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q: string };

      if (!q || q.trim().length < 3) {
        return reply.status(400).send({ error: "Bad Request", message: "שאלה קצרה מדי" });
      }

      // Set SSE headers — bypass Fastify's JSON serialization.
      // Because we use reply.raw.writeHead() directly, Fastify's CORS plugin
      // headers don't get injected automatically — we must add them manually.
      const requestOrigin = request.headers["origin"] ?? "";
      const allowedOriginPatterns = [
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/knesset-data-vote-web\.vercel\.app$/,
        /^http:\/\/localhost(:\d+)?$/,
      ];
      const corsOrigin = allowedOriginPatterns.some((p) => p.test(requestOrigin))
        ? requestOrigin
        : "";

      void reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // disable nginx buffering
        ...(corsOrigin && {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        }),
      });

      const send = (event: object) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Heartbeat every 15s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        reply.raw.write(": heartbeat\n\n");
      }, 15_000);

      try {
        for await (const event of askAIStream(q.trim())) {
          send(event);
          if (event.type === "done" || event.type === "error") break;
        }
        // Analytics (best-effort)
        const redis = getRedis();
        if (redis) {
          void Promise.all([
            redis.hincrby(AI_STATS_KEY, "questions_total", 1),
            redis.zincrby(AI_QUESTIONS_ZSET, 1, q.trim().slice(0, 200)),
          ]).catch(() => {});
        }
      } catch (err) {
        send({ type: "error", message: "שגיאה פנימית" });
        app.log.error({ err }, "AI stream error");
      } finally {
        clearInterval(heartbeat);
        reply.raw.end();
      }
    },
  );

  // ─────────────────────────────────────────────
  // POST /api/ai/feedback
  // ─────────────────────────────────────────────
  app.post(
    "/api/ai/feedback",
    {
      schema: {
        description: "Submit thumbs-up / thumbs-down feedback on an AI answer.",
        tags: ["AI"],
        body: {
          type: "object",
          required: ["question", "positive"],
          properties: {
            question: { type: "string", maxLength: 500 },
            positive: { type: "boolean" },
            model: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { ok: { type: "boolean" } } },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { question: string; positive: boolean; model?: string };
      const redis = getRedis();
      if (redis) {
        const field = body.positive ? "feedback_up" : "feedback_down";
        void redis.hincrby(AI_STATS_KEY, field, 1).catch(() => {
          /* ignore */
        });
        app.log.info(
          { positive: body.positive, question: body.question.slice(0, 80) },
          "AI feedback received",
        );
      }
      reply.send({ ok: true });
    },
  );

  // ─────────────────────────────────────────────
  // GET /api/ai/stats
  // ─────────────────────────────────────────────
  app.get(
    "/api/ai/stats",
    {
      schema: {
        description: "AI usage stats: total questions, feedback counts, top questions.",
        tags: ["AI"],
        response: {
          200: {
            type: "object",
            properties: {
              questions_total: { type: "number" },
              feedback_up: { type: "number" },
              feedback_down: { type: "number" },
              top_questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    count: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const redis = getRedis();
      if (!redis) {
        return reply.send({
          questions_total: 0,
          feedback_up: 0,
          feedback_down: 0,
          top_questions: [],
        });
      }

      const [statsHash, topRaw] = await Promise.all([
        redis.hgetall(AI_STATS_KEY),
        redis.zrevrange(AI_QUESTIONS_ZSET, 0, 9, "WITHSCORES"),
      ]);

      // Parse ZSET WITHSCORES: [member, score, member, score, ...]
      const top_questions: Array<{ question: string; count: number }> = [];
      for (let i = 0; i < topRaw.length; i += 2) {
        top_questions.push({
          question: topRaw[i] ?? "",
          count: Number(topRaw[i + 1] ?? 0),
        });
      }

      reply.send({
        questions_total: Number(statsHash?.["questions_total"] ?? 0),
        feedback_up: Number(statsHash?.["feedback_up"] ?? 0),
        feedback_down: Number(statsHash?.["feedback_down"] ?? 0),
        top_questions,
      });
    },
  );
}
