#!/bin/bash
# Vercel build script for monorepo
# Run from apps/web with Root Directory = apps/web in Vercel settings
set -e

echo "→ Moving to monorepo root"
cd "$(dirname "$0")/../../.."

echo "→ Generating Prisma client"
DATABASE_URL="postgresql://x:x@localhost:5432/x" pnpm --filter @knesset-vote/db generate

echo "→ Building shared package"
pnpm --filter @knesset-vote/shared build

echo "→ Building db package"
pnpm --filter @knesset-vote/db build

echo "→ Building web"
pnpm --filter @knesset-vote/web next build
