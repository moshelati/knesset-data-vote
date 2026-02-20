import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { setupRedis } from "./plugins/redis.js";
import { healthRoutes } from "./routes/health.js";
import { metaRoutes } from "./routes/meta.js";
import { partyRoutes } from "./routes/parties.js";
import { mkRoutes } from "./routes/mks.js";
import { billRoutes } from "./routes/bills.js";
import { searchRoutes } from "./routes/search.js";
import { promiseRoutes } from "./routes/promises.js";
import { voteRoutes } from "./routes/votes.js";
import { recommendationRoutes } from "./routes/recommendations.js";
import { RATE_LIMIT } from "@knesset-vote/shared";

const PORT = Number(process.env["API_PORT"] ?? 3001);
const HOST = process.env["API_HOST"] ?? "0.0.0.0";

async function build() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      transport:
        process.env["NODE_ENV"] !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId",
  });

  // ─── Security headers ───
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
      },
    },
  });

  // ─── CORS ───
  await app.register(cors, {
    origin:
      process.env["NODE_ENV"] === "production"
        ? [process.env["WEB_ORIGIN"] ?? "https://knesset-vote.il"]
        : true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  // ─── Rate limiting ───
  await app.register(rateLimit, {
    max: RATE_LIMIT.MAX_REQUESTS,
    timeWindow: RATE_LIMIT.TIME_WINDOW_MS,
    errorResponseBuilder: () => ({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Max ${RATE_LIMIT.MAX_REQUESTS} requests per minute.`,
      statusCode: 429,
    }),
  });

  // ─── Swagger docs ───
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "Knesset Vote API",
        description:
          "Data-driven Israeli elections transparency platform API. " +
          "All data sourced from Knesset OData. " +
          "No claims are invented. See /methodology for data definitions.",
        version: "0.1.0",
        contact: {
          name: "Open Source Project",
          url: "https://github.com/knesset-vote/knesset-vote",
        },
      },
      externalDocs: {
        description: "Data Methodology",
        url: "/methodology",
      },
      servers: [{ url: `http://${HOST}:${PORT}`, description: "Development" }],
      components: {
        securitySchemes: {
          apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
        },
      },
      tags: [
        { name: "System", description: "Health and metadata" },
        { name: "Parties", description: "Party/faction data" },
        { name: "MKs", description: "Member of Knesset data" },
        { name: "Bills", description: "Legislative bills" },
        { name: "Search", description: "Unified search" },
        { name: "Votes", description: "Parliamentary votes and MK vote records" },
        { name: "Statements", description: "Statements and commitments tracker" },
        {
          name: "Recommendations",
          description: "My Election — personalized party recommendations",
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "tag",
      deepLinking: true,
    },
  });

  // ─── Redis ───
  await setupRedis(app);

  // ─── Error handler ───
  app.setErrorHandler((error, request, reply) => {
    app.log.error({ err: error, requestId: request.id }, "Request error");
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: error.name ?? "Internal Server Error",
      message: statusCode === 500 ? "An unexpected error occurred" : error.message,
      statusCode,
      requestId: request.id,
    });
  });

  // ─── Not found handler ───
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  });

  // ─── Routes ───
  await app.register(healthRoutes);
  await app.register(metaRoutes);
  await app.register(partyRoutes);
  await app.register(mkRoutes);
  await app.register(billRoutes);
  await app.register(searchRoutes);
  await app.register(promiseRoutes);
  await app.register(voteRoutes);
  await app.register(recommendationRoutes);

  return app;
}

async function start() {
  const app = await build();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API server running at http://${HOST}:${PORT}`);
    app.log.info(`Swagger docs at http://${HOST}:${PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { build };
