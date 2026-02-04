FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.build.json ./
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @windhelm/db exec prisma generate

FROM base AS api
WORKDIR /app
RUN pnpm -r --filter @windhelm/api... build
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM base AS web
WORKDIR /app
RUN pnpm -r --filter @windhelm/web... build
WORKDIR /app/apps/web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]

FROM base AS worker-temporal
WORKDIR /app
RUN pnpm -r --filter @windhelm/worker-temporal... build
WORKDIR /app/apps/worker-temporal
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
