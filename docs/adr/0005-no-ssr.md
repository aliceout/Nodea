# 0005 — No SSR — pure CSR, single-page application

- **Status**: Accepted
- **Date**: 2026-02

## Context

Server-Side Rendering (SSR) is the standard for most modern React
apps — Next.js, Remix, SvelteKit. Usual benefits:

- **Faster first render**: the user sees content while the JS
  downloads.
- **SEO**: crawlers index rendered HTML, not an empty shell that
  hydrates.
- **Sharing**: a link shared on social networks previews properly
  (OG meta tags are read from the server HTML).

For Nodea, the counter to SSR is **the E2EE invariant**:

> *All user content is encrypted client-side with a key derived
> from the password. The server only sees AES-GCM blobs.*

If a logged-in user requested `/flow`, the server has **nothing to
pre-render** — it doesn't have the key to decrypt, so it can't
produce the Mood/Goals/Library/Journal list HTML. SSR only works
for surfaces where the server can produce content without the key:
public pages (login, register, docs).

The team considered:

- **Full-app SSR via Next.js / Remix**: would force a server-side
  fetch layer for public pages while delegating `/flow` to CSR —
  two rendering models coexisting. Expensive, for a gain that only
  touches public pages (~10 % of an authenticated user's traffic).
- **Partial SSR on public pages only**: Next.js with an aggressive
  `'use client'` across `/flow`. Works but requires a Next.js stack
  to do the job of a Vite SPA. Low value.
- **Pure CSR + static OG meta in `index.html`**: the server serves
  the same `index.html` for every route; the OG meta tags are
  pinned to the home (shared links to `/docs` show Nodea's preview,
  not the exact tier — acceptable).

## Decision

**Pure CSR. Vite builds a standalone SPA. Every route (public and
authenticated) is rendered in the browser. The OG meta in
`index.html` is static and points at the home.**

The Hono server only:
- Serves the `/api/*` API (JSON encrypted-blobs round-trip).
- Serves static assets (the Vite bundle + public files).
- Nothing pre-rendered.

## Consequences

**Positive:**
- **Consistency**: a single rendering model (CSR), no surface where
  the server has special render logic.
- **E2EE compatible**: no surface where the server could *"see"*
  decrypted content. Conforms to the invariant.
- **Thin stack**: Vite + React + Hono + Drizzle. No hybrid SSR
  framework to learn.
- **Trivial self-hosting**: an nginx + an api container + a static
  web container. No server rendering layer to scale.

**Negative:**
- **Slower first render**: a user loading `/login` sees blank for
  ~300-700 ms (JS download, parse, mount). Mitigated by: a11y
  skip-link straight from static HTML, Vite manualChunks
  (react-vendor + crypto + markdown + headlessui as separate
  cacheable chunks), preconnect to Google Fonts.
- **Weak SEO on public pages**: `/docs/<tier>` doesn't serve the
  tier content as HTML. Mitigated in V1 by static OG meta +
  dynamic `<link rel="canonical">` in `Docs.tsx`. Real SEO would
  need selective pre-render on `/docs/*`. To revisit if docs
  becomes an acquisition channel.
- **Generic shared OG links**: a link shared toward `/docs/tech`
  shows the home preview. Acceptable — the target audience
  (tech-savvy self-hosters) doesn't navigate via social previews.

## Alternatives considered

- **Next.js or Remix with hybrid SSR**: technically feasible,
  superseded by the simplicity of pure CSR on an E2EE app. If SEO
  on `/docs` becomes critical, we can add a **static pre-render**
  of public pages at build time (via `vite-plugin-ssr` or a build
  script that mounts React in JSDOM) without breaking the rest of
  CSR.
- **React 19 Server Components**: promising, but requires Next.js
  or a custom framework. Same constraints as full-app SSR.
