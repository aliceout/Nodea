# -----------------------------------------------------------------------------
# Nodea Web — multi-stage:
#   1. builder: pnpm install + vite build
#   2. runtime: nginx serving static assets + proxying /api to the api service
# -----------------------------------------------------------------------------

# ---- Stage 1: build ----------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable

# Force the install to include devDeps (vite, @vitejs/plugin-react, etc.).
# Docker builds occasionally ship with NODE_ENV=production in the image env
# or CI wrappers; the `--prod=false` flag is the safe belt-and-braces.
ENV NODE_ENV=development

# The front is built with VITE_API_URL=/api so same-origin calls flow through
# the nginx reverse-proxy in the runtime stage. Override at build time if the
# front is served behind a different prefix.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Copy the entire source first. `.dockerignore` strips host node_modules and
# dist/, so the image sees a clean tree and pnpm populates node_modules next.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod=false

# Build from inside the package — using `pnpm run` here (rather than
# `pnpm --filter @nodea/web build`) ensures the local .bin/vite is on PATH.
WORKDIR /app/packages/web
RUN pnpm run build

# ---- Stage 2: runtime --------------------------------------------------------
FROM nginx:alpine AS runtime

COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# OPS-03 — drop privileges and listen on an unprivileged port.
# The `nginx` user already exists in `nginx:alpine` (UID 101).
# nginx normally needs root to bind 80 ; we listen on 8080
# instead and let the compose port-mapping translate 80→8080
# externally. The `nginx` user must be able to write its
# pid + temp + cache directories, so we chown them first.
# `cache.d` and the pid file path are nginx defaults.
RUN chown -R nginx:nginx \
      /var/cache/nginx \
      /var/log/nginx \
      /etc/nginx/conf.d \
      /usr/share/nginx/html \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080
