# Knesset Vote — Israeli Parliamentary Transparency Platform

> Data-driven voting assistance using verifiable Knesset parliamentary data.
> No invented claims. Full source provenance. Neutral language.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/knesset-vote.git
cd knesset-vote
pnpm i

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Start infrastructure
docker compose up -d

# 4. Run database migrations
pnpm db:migrate

# 5. Load data (choose one)
pnpm etl:sync        # Sync from Knesset OData API (requires network access)
pnpm db:seed         # Load demo data for UI testing when OData is unreachable

# 6. Start development servers
pnpm dev
```

Web app: http://localhost:3000
API: http://localhost:3001
Swagger docs: http://localhost:3001/docs

---

## Architecture

```
knesset-vote/
├── apps/
│   ├── api/          # Fastify + TypeScript REST API
│   └── web/          # Next.js 14 App Router + Tailwind
├── packages/
│   ├── db/           # Prisma schema + migrations + seed
│   ├── etl/          # OData client + sync pipeline
│   └── shared/       # Zod schemas, types, constants
├── docker-compose.yml
└── .github/workflows/ci.yml
```

**Stack:** pnpm workspaces + Turborepo · Fastify · Next.js 14 · Prisma · PostgreSQL · Redis · Vitest · Playwright · GitHub Actions

---

## Commands Reference

| Command | Description |
|---|---|
| `pnpm i` | Install all workspace dependencies |
| `docker compose up -d` | Start Postgres + Redis |
| `pnpm db:migrate` | Run Prisma migrations (dev) |
| `pnpm db:migrate:deploy` | Run migrations (production) |
| `pnpm db:seed` | Seed demo data (marked `is_demo=true`) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm etl:sync` | Sync all data from Knesset OData API |
| `pnpm etl:sync:demo` | Show demo mode info |
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format with Prettier |
| `pnpm test` | Run unit + API tests |
| `pnpm test:e2e` | Run Playwright E2E tests |

---

## Data Flow

```
Knesset OData API
    ↓ (ETL: packages/etl)
    OData Metadata Discovery ($metadata)
    → Parse entity sets dynamically
    → Paginate with $top/$skip + nextLink
    → Retry with exponential backoff
    → Store RawSnapshot per entity
    → Upsert to PostgreSQL
    → Log ETLRun summary
         ↓
PostgreSQL (packages/db)
    ↓ (cached via Redis 60s)
API (apps/api)
    ↓
Web (apps/web)
```

---

## Non-Negotiable Principles

1. **No hallucinations** — Never invent claims. Missing data → "Not available from source"
2. **Full provenance** — Every field links to Knesset OData with external_id + URL
3. **Neutral language** — "No matching parliamentary activity found as of [date]", not "failed"
4. **Methodology-first** — `/methodology` page documents all computation methods
5. **Auditability** — RawSnapshot table stores all API payloads + hashes

---

## ETL Details

### OData Metadata Discovery

The ETL **never hardcodes entity set names**. It fetches `$metadata`, parses the XML,
and discovers available entity sets dynamically. See:
- `packages/etl/src/client/odata-metadata.ts` — metadata parser
- `packages/etl/src/client/odata-client.ts` — typed OData client

### Entity Set Candidates

The ETL tries multiple candidate names for each entity type (in priority order):

| Entity | Candidates |
|---|---|
| Parties (Factions) | `KnssFaction`, `Faction`, `ParliamentFaction` |
| MKs (Members) | `KnssMember`, `Person`, `MK`, `Member` |
| Bills | `KnssBill`, `Bill`, `PrivateBill` |
| Committees | `KnssCommittee`, `Committee` |
| MK-Faction | `KnssMemberFaction`, `MemberFaction` |
| Bill Initiators | `KnssBillInitiator`, `BillInitiator` |
| Bill Stages | `KnssBillHistoryByStage`, `BillHistory` |

If an entity set is not found, that feature is gracefully omitted with a log warning.

### SSRF Prevention

All outbound fetches go through `packages/etl/src/client/ssrf-guard.ts`.
Only domains in `ALLOWED_FETCH_DOMAINS` are permitted: `knesset.gov.il`, `gov.il`.

---

## API

All endpoints return:
```json
{
  "data": {...},
  "sources": [{"label": "Knesset OData", "url": "...", "external_source": "knesset_odata", "external_id": "123"}],
  "computed_fields": {"definition": "...", "limitations": "..."},
  "methodology_url": "/methodology#..."
}
```

| Endpoint | Description |
|---|---|
| `GET /api/health` | Health check |
| `GET /api/meta` | Data sources, last sync, ETL summary |
| `GET /api/parties?search=` | List parties |
| `GET /api/parties/:id` | Party detail + activity summary |
| `GET /api/mks?party_id=&search=` | List MKs |
| `GET /api/mks/:id` | MK profile + metrics + bills + memberships |
| `GET /api/bills?search=&topic=&status=` | List bills |
| `GET /api/bills/:id` | Bill detail + sponsors + stage history |
| `GET /api/search?q=` | Unified search (MK, party, bill) |
| `GET /api/promises` | Statements/commitments list |
| `POST /api/promises` | Add statement (requires `API_KEY`) |

Swagger UI: http://localhost:3001/docs

---

## Database Schema

Key models:
- `Party` → `PartyMembership` ← `MK`
- `MK` → `MKBillRole` ← `Bill`
- `Bill` → `BillStage`
- `Committee` → `CommitteeMembership` ← `MK`
- `Vote` → `VoteRecord` ← `MK`
- `Promise` → `PromiseMatch` → `Bill`/`Vote`
- `SourceLink` — polymorphic provenance links
- `RawSnapshot` — audit trail (raw API payloads + SHA-256 hash)
- `ETLRun` — sync run metadata

---

## Security

| Layer | Implementation |
|---|---|
| Input validation | Zod schemas on all API inputs |
| Rate limiting | 100 req/min per IP (`@fastify/rate-limit`) |
| Security headers | Helmet (`X-Frame-Options`, `CSP`, etc.) |
| SSRF prevention | Domain allowlist for all outbound fetches |
| SQL injection | Prisma parameterized queries only |
| XSS | React server components + Next.js CSP headers |

---

## Known TODOs & Limitations

### OData Entity Sets
After running `pnpm etl:sync` for the first time, check logs for discovered entity set names.
If a candidate name doesn't match, add it to the `*_ENTITY_SET_CANDIDATES` arrays in:
- `packages/etl/src/mappers/party-mapper.ts`
- `packages/etl/src/mappers/mk-mapper.ts`
- `packages/etl/src/mappers/bill-mapper.ts`
- `packages/etl/src/mappers/committee-mapper.ts`

### Votes Data
Vote records depend on entity `VoteRecord` being available in OData. If not present,
the feature displays "Not available from source" rather than failing.

### AI Summaries
AI bill summarization is infrastructure-ready (model: `BillAISummary`). To enable:
1. Set `OPENAI_API_KEY` in `.env`
2. Implement `packages/etl/src/sync/sync-ai-summaries.ts`
3. Generate summaries ONLY from `description_he` fields (never invented)

### Images
MK profile photos are not in OData. Future: scrape `knesset.gov.il/mk` pages for photo URLs
(requires careful rate limiting and robots.txt compliance).

### NLP Topic Classification
Currently uses keyword matching. Future: Hebrew NLP model for better accuracy.

---

## Demo Mode

When the Knesset OData API is unreachable, the UI shows demo data:

```bash
pnpm db:seed
```

All demo records are marked `is_demo=true` and shown with a yellow banner.
Demo data uses factual party/MK names from the 25th Knesset but makes **no claims**.

---

## Environment Variables

See `.env.example` for all variables. Required:

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Optional:
```
API_KEY=           # Enables POST /api/promises
OPENAI_API_KEY=    # Enables AI bill summaries
```

---

## Contributing

1. All PRs must pass CI (lint + typecheck + unit tests + API tests)
2. Never add claims about MKs/parties that aren't from an official source
3. Follow the neutral language rules (see Methodology page + `packages/shared/src/schemas/common.ts`)
4. New metrics must include: source link, confidence level, methodology anchor

---

## License

MIT — See LICENSE file.

This project is not affiliated with the Knesset or any political party.
