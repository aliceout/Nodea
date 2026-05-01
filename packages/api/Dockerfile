# -----------------------------------------------------------------------------
# Nodea API — single-stage Node 22 + pnpm.
#
# The API runs TypeScript directly via `tsx` (see `packages/api/package.json`
# → `start`), so there is no dedicated compile step. Migrations run once on
# container start before the HTTP server boots.
# -----------------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app
RUN corepack enable

# Ensure pnpm installs devDeps (`tsx`, `drizzle-kit`) regardless of any
# stray NODE_ENV=production in the build env.
ENV NODE_ENV=development

# Build-time metadata surfaced by `GET /version`. Pass these from CI :
#   docker build \
#     --build-arg BUILD_COMMIT="$(git rev-parse HEAD)" \
#     --build-arg BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD)" \
#     --build-arg BUILD_DATE="$(date -Iseconds)" \
#     ...
# All three default to `unknown` so a manual `docker build` (without
# the args) still produces a runnable image — `/version` just reports
# `unknown` for the missing fields.
ARG BUILD_COMMIT=unknown
ARG BUILD_BRANCH=unknown
ARG BUILD_DATE=unknown
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_BRANCH=${BUILD_BRANCH}
ENV BUILD_DATE=${BUILD_DATE}

# Root config needed by the workspace + api tsconfig.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod=false

WORKDIR /app/packages/api

EXPOSE 3000

# Apply any pending migration, then start the HTTP server. The image is
# deterministic across restarts: if every migration is already applied the
# migrate step is a no-op.
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
