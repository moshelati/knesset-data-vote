import type { FastifyInstance } from "fastify";
import { db } from "@knesset-vote/db";
import { DATA_STATUS_LABELS } from "@knesset-vote/shared";
import { z } from "zod";

const CreatePromiseSchema = z.object({
  text: z.string().min(10).max(2000),
  category: z.enum(["statement", "commitment", "pledge"]),
  topic: z.string().optional(),
  mk_id: z.string().optional(),
  party_id: z.string().optional(),
  stated_on: z.string().datetime().optional(),
  source_url: z.string().url(),
  source_label: z.string().min(2).max(200),
});

export async function promiseRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/promises
  app.get(
    "/api/promises",
    {
      schema: {
        description:
          "List statements/commitments with parliamentary activity matches. " +
          "Note: 'Promise' is shown as 'Statement' or 'Commitment' in UI per editorial policy.",
        tags: ["Statements"],
        querystring: {
          type: "object",
          properties: {
            person: { type: "string" },
            party: { type: "string" },
            topic: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        person,
        party,
        topic,
        page = 1,
        limit = 20,
      } = request.query as {
        person?: string;
        party?: string;
        topic?: string;
        page?: number;
        limit?: number;
      };

      const where: NonNullable<Parameters<typeof db.promise.findMany>[0]>["where"] = {};
      if (topic) where.topic = topic;
      if (person) where.mk_id = person;
      if (party) where.party_id = party;

      const [promises, total] = await Promise.all([
        db.promise.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { stated_on: "desc" },
          include: {
            mk: { select: { id: true, name_he: true } },
            party: { select: { id: true, name_he: true } },
            matches: {
              include: {
                bill: { select: { id: true, title_he: true, status: true } },
              },
            },
          },
        }),
        db.promise.count({ where }),
      ]);

      reply.send({
        data: promises.map((p) => ({
          id: p.id,
          // Use "statement" terminology per legal guardrails
          type: p.category,
          text: p.text,
          topic: p.topic,
          mk: p.mk ? { id: p.mk.id, name: p.mk.name_he } : null,
          party: p.party ? { id: p.party.id, name: p.party.name_he } : null,
          stated_on: p.stated_on?.toISOString() ?? null,
          source: { url: p.source_url, label: p.source_label },
          is_demo: p.is_demo,
          matches: p.matches.map((m) => ({
            id: m.id,
            match_type: m.match_type,
            confidence: m.confidence,
            // Use neutral status language per principle 3
            status: m.status,
            status_label:
              DATA_STATUS_LABELS[m.status as keyof typeof DATA_STATUS_LABELS] ??
              "Not available from source",
            status_date: m.status_date?.toISOString() ?? null,
            bill: m.bill ? { id: m.bill.id, title: m.bill.title_he, status: m.bill.status } : null,
          })),
        })),
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        editorial_note:
          "Statements/Commitments are sourced from publicly available media and official statements. " +
          "Parliamentary activity matches use neutral status labels only. " +
          "See /methodology for definitions.",
      });
    },
  );

  // POST /api/promises - only if API_KEY is configured
  if (process.env["API_KEY"]) {
    app.post(
      "/api/promises",
      {
        schema: {
          description: "Create a new statement/commitment (requires API key)",
          tags: ["Statements"],
          security: [{ apiKey: [] }],
        },
      },
      async (request, reply) => {
        // Verify API key
        const apiKey = request.headers["x-api-key"];
        if (apiKey !== process.env["API_KEY"]) {
          reply.code(401).send({
            error: "Unauthorized",
            message: "Invalid or missing API key",
            statusCode: 401,
          });
          return;
        }

        const parsed = CreatePromiseSchema.safeParse(request.body);
        if (!parsed.success) {
          reply.code(400).send({
            error: "Bad Request",
            message: "Invalid input",
            details: parsed.error.flatten(),
            statusCode: 400,
          });
          return;
        }

        const { data } = parsed;

        // Verify MK exists if provided
        if (data.mk_id) {
          const mk = await db.mK.findFirst({ where: { id: data.mk_id } });
          if (!mk) {
            reply.code(404).send({
              error: "Not Found",
              message: "MK not found",
              statusCode: 404,
            });
            return;
          }
        }

        const promise = await db.promise.create({
          data: {
            text: data.text,
            category: data.category,
            topic: data.topic ?? null,
            mk_id: data.mk_id ?? null,
            party_id: data.party_id ?? null,
            stated_on: data.stated_on ? new Date(data.stated_on) : null,
            source_url: data.source_url,
            source_label: data.source_label,
            added_by: "api",
          },
        });

        reply.code(201).send({ data: promise });
      },
    );
  } else {
    // Explicitly return 404 if no API key configured
    app.post(
      "/api/promises",
      {
        schema: {
          description: "Not available - requires API_KEY configuration",
          tags: ["Statements"],
        },
      },
      async (_, reply) => {
        reply.code(404).send({
          error: "Not Found",
          message: "POST /api/promises is not enabled. Set API_KEY environment variable to enable.",
          statusCode: 404,
        });
      },
    );
  }
}
