# -----------------------------------------------------------------------------
# Nodea API — single-stage Node 22 + pnpm.
#
# The API runs TypeScript directly via `tsx` (see `packages/api/package.json`
# → `start`), so there is no dedicated compile step. Migrations run once on
# container start before the HTTP server boots.
# -----------------------------------------------------------------------------
FROM node:24-alpine

WORKDIR /app

# We run on pnpm via corepack — npm is never invoked at runtime.
# Stripping the bundled npm out of the image removes its own
# vendored dep tree (where Trivy keeps flagging things like
# picomatch CVE-2026-33671 we can't override) and reduces the
# image's attack surface by a small but free margin.
RUN corepack enable && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

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

# OPS-03 : drop privileges before the long-running process starts.
# The official `node:22-alpine` image already ships a `node` user
# (UID 1000). We chown the workspace + the pnpm store so the
# unprivileged process can read them, then switch via USER. The
# api binds on 3000 (unprivileged port) so no CAP_NET_BIND_SERVICE
# is needed. Migrations also run as `node` — Drizzle just needs
# DB credentials, no host privileges.
RUN chown -R node:node /app
WORKDIR /app/packages/api
USER node

EXPOSE 3000

# Apply any pending migration, then start the HTTP server. The image is
# deterministic across restarts: if every migration is already applied the
# migrate step is a no-op.
CMD ["sh", "-c", "pnpm db:migrate && pnpm start"]
