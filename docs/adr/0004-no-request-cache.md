# 0004 — No request cache (TanStack Query, SWR, etc.)

- **Status**: Accepted
- **Date**: 2026-02

## Context

Almost every modern React SPA adopts a **request-caching** lib:
TanStack Query (formerly react-query), SWR, RTK Query, Apollo. These
libs solve four common problems:

1. **Deduplication**: two components asking for the same data only
   trigger one fetch.
2. **Cross-mount cache**: navigating off a page and back shows the
   previous data while the refetch runs in the background.
3. **Multi-tab sync**: a tab focus triggers a refetch; two tabs stay
   roughly consistent.
4. **Tag-based invalidation**: `mutation.invalidate('mood-entries')`
   purges the cache of related reads.

For Nodea, several factors change the equation:

- **E2EE architecture**: every fetch goes through a client-side
  encryption / decryption layer. The "raw" result a cache would
  store is already a post-AES-GCM `LibraryItem[]` — not the
  network payload. Caching libs aim to avoid network cost; here
  the dominant cost is the **crypto derivation**, not HTTP
  latency.
- **Single-instance, single-user per session**: a Nodea instance
  serves one user at a time (even if the server hosts N). No
  *"two tabs fight over invalidation"* scenario at the scale
  where caching libs shine.
- **Modest data volume**: a user's journal fits in a few hundred
  entries, not gigabytes. A full-list refetch stays under a
  second.
- **Hand-rolled optimistic mutations**: each module handles its
  rollback via `setItems(previous)` in a `catch`. The pattern
  works, is testable, and doesn't need a lib's invalidation
  engine.

## Decision

**Do not adopt a request-caching lib. Keep the manual pattern:
`useEffect(() => fetch())` + `setState`, optimistic update +
rollback in `catch`, version-bump (`bumpItemsVersion`) to force a
refetch after a mutation.**

## Consequences

**Positive:**
- **The code stays readable**: a `useEffect` that calls
  `clientX.list()` and does `setItems(...)` is understandable
  without knowing an external lib. A new contributor doesn't need
  to learn another abstraction's API.
- **Slimmer bundle**: ~30 KB gzip saved (TanStack Query v5 minified)
  that we don't pay.
- **No cache to invalidate on logout**: the purged `mainKey` makes
  encrypted blobs unusable; no risk that a surviving cache leaks
  decrypted content to the next user.
- **No surprise background refetches**: the explicit *"I fetch on
  mount, I refetch on version bump"* pattern is predictable and
  debuggable.

**Negative:**
- **No native dedup**: if two pages mount in parallel asking for
  the same data, we double-fetch. In practice modules lazy-load
  one at a time, and the situation doesn't arise.
- **No cross-mount cache**: navigating off a module and back
  re-triggers the fetch. At Nodea volumes (~seconds max), that's
  acceptable. If a module becomes heavy to hydrate, we'll
  revisit.
- **Race conditions on rapid mutations**: no `requestId` to cancel
  a stale rollback. Acceptable for the current app (libs would
  have the same issue without explicit `mutationKey` config).

## Alternatives considered

- **TanStack Query** — the reference lib. Excellent for a
  multi-tab SaaS app. On Nodea: over-equipped without measurable
  gain. **Reversible decision** if a *"live collab"*-style module
  ever arrives (unlikely given the E2EE invariant).
- **SWR** — lighter than TanStack Query but the same cognitive
  overhead for marginal gain.
- **Apollo Client** — irrelevant: no GraphQL.

If the situation changes (much slower network, multi-user on the
same machine, expensive server-side queries), **supersede this
ADR** rather than amend it.
