# Library module

> Status: **Phases 1 and 2 shipped · Phase 3 partial · Phase 4 not started.**
> Scoping decisions ratified 2026-04-26 (cf. §9). Code shipped on
> `refacto-design-v2`; an internal refactor of `Library/index.tsx`
> (1438 monolithic lines) is required before Phase 4.

---

## 1. Purpose & scope

Library is the **personal book library** module: the works the user
has read / abandoned / has in progress, with notes, quotes, and
impressions.

The explicit goal is to **replace Babelio / Goodreads / StoryGraph**
with a self-hosted, end-to-end-encrypted version. The server never
knows what the user is reading.

**Books only.** Audiovisual media (films, TV series, documentaries)
are out of scope and will get a separate module — their APIs (TMDB)
and semantics (episodes, runtime, streaming platforms) are different
enough to deserve their own surface.

---

## 3. Data schema

Three E2E-encrypted tables (same crypto rules as Mood / Goals /
Journal — `module_user_id`, AES-GCM `payload`, `cipher_iv`,
deterministic HMAC `guard`, two-phase creation).

### 3.1 `library_items_entries` (works)

```jsonc
{
  "type": "book",
  "title": "Les Misérables",         // required

  // External identity — for metadata fetch + import dedup.
  // All optional (manual entry is allowed).
  "providers": {
    "openlibrary": "OL45804W",
    "googlebooks": "abc123",
    "isbn13": "9782070409228",
    "isbn10": "2070409228"
  },

  // Descriptive metadata — frozen at fetch time (snapshot).
  // Naming convention: `<First name> <LAST NAME>` with the LAST
  // NAME in CAPS. Applied to manual entry, to imports (Babelio
  // hands over names inverted and in normal case — we flip and
  // uppercase), and to provider results (Open Library / Google
  // Books often return a raw text blob that we normalise).
  "creators": [
    { "name": "Victor HUGO", "role": "author" }
  ],
  "year": 1862,
  "language": "fr",                  // language of the read edition
  "original_language": "fr",
  "page_count": 1463,
  "publisher": "Folio classique",
  "summary": "Short text, optional",
  "series": {                        // optional
    "name": "Les Misérables",
    "position": 2,
    "of": 5
  },

  // Cover stored as an encrypted blob in `library_covers_entries`
  // (cf. §6). Only a logical pointer is kept here.
  "cover_rid": "rec_cov_xyz",        // null if no cover

  // State and personal experience.
  "status": "in_progress",           // planned | in_progress | finished | abandoned
  "format": "paper",                 // paper | ebook | audio | unknown
  "started_at": "2024-11-03",        // optional
  "finished_at": null,               // null until finished
  "current_page": 318,               // useful when status === in_progress
  "rating": 4,                       // 0..5, optional
  "tags": ["classic", "to gift"],    // free, user-specific
  "is_favorite": false
}
```

> **No re-read array.** If the user re-reads, they can update the
> rating or add a dated review — but we don't keep a history of
> reading dates. That's machine behaviour, not human (ratified
> 2026-04-26).

### 3.2 `library_reviews_entries` (notes & quotes)

A work can have **several dated reviews**. That's where quotes the
user likes, mid-reading thoughts, or the wrap-up notes live.

```jsonc
{
  "item_rid": "rec_abc123",          // required — id of the related work
  "date": "2025-01-08T19:42:00.000Z",
  "kind": "quote",                   // quote | note
  "title": "Chapter 12 — Cosette",   // optional
  "content": "Free Markdown…",       // required
  "page": 318,                       // optional (typical for quote)
  "spoiler": false                   // UI-side hide toggle
}
```

- **`quote`** = a passage from the book, often short, with a page
  reference — quotes the user likes from books they read.
- **`note`** = everything else: in-flight reflection, final wrap-up,
  impression, links to other reads…

The UI renders the two differently (italic + indent for quotes,
normal prose for notes) without forking the model.

### 3.3 `library_covers_entries` (covers, dedicated table)

```jsonc
{
  "item_rid": "rec_abc123",          // required — join key
  "mime": "image/jpeg",
  "blob_b64": "/9j/4AAQSkZJRgABAQ…", // reasonable size (≤80 KB)
  "fetched_from": "openlibrary",     // info, can be null
  "fetched_at": "2026-04-26T12:00:00Z"
}
```

> Dedicated table (rather than inline in `library_items_entries`) to
> keep item payloads light and to allow deletion / re-fetch of the
> cover independently.

---

## 4. External metadata — Nodea proxy

Architecture ratified: **proxy through the Nodea server**. Client
requests go through `POST /library/lookup` on the Nodea API, which:

1. Caches the response (key: ISBN or normalised query).
2. On a miss, calls the external provider with **the Nodea
   instance's API key** (key shared by every user of that
   instance — not per-user).
3. Returns the normalised result to the client.

The external provider only sees **one IP per Nodea instance** with
no cross-account correlation. The Nodea server does see the
searches — acceptable since the user is also the host.

> **Privacy tradeoff (assumed, audit 2026-06).** Unlike the
> encrypted-records surface (single `/records` path + `X-Collection`
> header, issue #67), the lookup endpoints keep explicit
> `/library/lookup/*` paths — every search logs a request line that
> says « this user is using Library, now » to whoever reads the api
> stdout. The search TEXT never leaks (POST body, not query string ;
> the `?url=` of cover-fetch is wholesale-redacted from logs), and
> the searches do transit in clear to the external providers via the
> proxy by design. Neutralising the path (e.g. generic `/lookup`)
> would buy little since Library is the only lookup consumer —
> revisit if a second module gains a lookup.

### 4.1 Selected providers

| Provider | Auth | Coverage | Notes |
|---|---|---|---|
| **Open Library** | none | very good, international books | default |
| **Google Books** | API key | good, summaries | useful for recent / French editions poorly covered by OL |
| **BNF (data.bnf.fr)** | none | FR books, author authority | complement, especially for French |
| **BNE (datos.bne.es)** | none | Spanish books, author authority | BNF-equivalent on the ES side |
| **Wikidata / SPARQL** | none | universal, cross-linked with Open Library / GB | used to resolve Q-numbers (notably Inventaire.io imports) |
| **Amazon (headless scraping)** | none | FR/EN/ES editions | last resort when bibliographic databases return nothing — TLD currently locked to `amazon.fr` (cf. issue #38) |

> **Shared API key**: lives in the server config (env var like
> `LIBRARY_GOOGLE_BOOKS_API_KEY`). No client-side secret.

### 4.2 Proxy endpoints (Nodea API side)

```
POST /library/lookup/by-isbn      { "isbn": "9782070409228" }
POST /library/lookup/by-query     { "q": "les misérables hugo" }
GET  /library/cover/proxy?u=<...>  // optional — server-side download
                                   // of a remote URL for later blob
                                   // storage
```

All routes are rate-limited (aligned with `auth/login`,
~10/min/IP) and log requests minimally (no payload, no user).

### 4.3 Preferences toggle

A Preferences option lets the user **fully disable** external calls
(manual entry only). Enabled by default.

---

## 5. Import

Sources, by support priority:

1. **Babelio** — CSV with confirmed format (cf. §5.1).
2. **Inventaire.io** — federated free service backed by Wikidata
   ([inventaire.io](https://inventaire.io/)). Export available on
   the user side; format to confirm at implementation time. Bonus:
   works already carry Wikidata IDs (Q-numbers) that fetch metadata
   without hitting Open Library.
3. **Goodreads** — very standard, stable CSV.
4. **The StoryGraph** — CSV.
5. **Generic CSV format** — manually mappable columns.

### 5.1 Babelio format (confirmed)

Separator `;`, double quotes around each field, UTF-8 encoding.
Header:

```
ISBN;Titre;Auteur;Editeur;Date de publication;Date d'entrée dans Babelio;Statut;Note
```

Mapping to the Nodea schema:

| Babelio | Nodea | Notes |
|---|---|---|
| `ISBN` | `providers.isbn13` or `providers.isbn10` | length-based detection (13 or 10) |
| `Titre` | `title` | as-is |
| `Auteur` | `creators[0].name` | Babelio hands over `Lastname Firstname` ("Hugo Victor"). We **flip** and CAP the LAST NAME → "Victor HUGO". Convention applied everywhere in Library (§3.1). |
| `Editeur` | `publisher` | as-is |
| `Date de publication` | `year` | extract `YYYY` from `YYYY-MM-DD`; `0000-00-00` → `null` |
| `Date d'entrée dans Babelio` | (ignored) | Babelio metadata, irrelevant on the Nodea side |
| `Statut` | `status` | `Lu` → `finished`; `A lire` → `planned`; `En cours` → `in_progress` |
| `Note` | `rating` | parseFloat then rounded to 0..5; `0.0` is treated as "no rating" → `null` (Babelio defaults to 0.0 for unrated) |

> **Subtlety**: Babelio doesn't distinguish "explicit 0 rating" from
> "no rating" — both export as `0.0`. Since explicit 0/5 ratings are
> rare, we treat `0.0` as "unrated". If users want to keep explicit
> zeros, we'll add an import toggle.

### 5.1 Pipeline

```
CSV file
   │
   ▼
provider-specific parser (Goodreads / Babelio / …)
   │  → normalise to `library_items_entries`
   ▼
(optional) metadata enrichment via /library/lookup
   │  → known ISBN → fetch missing cover + page_count
   ▼
local encryption + upload (POST guard:"init" → PATCH promote)
   │
   ▼
review mapping
   │  → Goodreads "My Review" → `library_reviews_entries`
   │     entry kind="note"
   ▼
summary: X works, Y reviews, Z duplicates merged on ISBN
```

### 5.2 Deduplication

Dedup key, in priority order:
1. `providers.isbn13`
2. `providers.isbn10`
3. `(title, creators[0].name)` normalised (lowercased, accent-stripped)
4. fallback: no automatic merge, the UI offers manual merging.

### 5.3 Nodea export format

```jsonc
{
  "meta": { "version": 2, "exported_at": "2026-04-26T12:00:00Z", "app": "Nodea" },
  "modules": {
    "library_items": [ /* … schema §3.1 … */ ],
    "library_reviews": [ /* … schema §3.2 … */ ],
    "library_covers": [ /* … schema §3.3 … */ ]
  }
}
```

---

## 6. Security

- **Confidentiality**: titles, notes, ratings, tags, reads — all
  E2E-encrypted. The server stores AES-GCM `payload` + HMAC `guard`.
- **External metadata**: see §4. The server proxy avoids direct
  leakage to providers; the Nodea server sees the requests but it
  is the user's self-hosted instance.
- **Covers**: encrypted blob locally, no leak at render time.
- **Imports**: file processed client-side, never transmitted raw to
  the server.

---

## 7. Stats & Goals integration — V2

Possibilities discussed, **out of MVP**:

- "X books read in 2026" counter on Home + Library page.
- Heatmap of reading sessions (similar to Mood).
- "Read 30 books in 2026" goal auto-checked at `status: finished`.

To scope after the MVP. Nothing is required as long as the basics
don't work end to end.

---

## 8. Tags — keep free at MVP

Tags stay **free-form** (free string, comma-separated in the UI,
suggestions over already-used tags — same as the Journal's
ThreadSuggestInput).

A potential pre-defined genre taxonomy (novel / essay / poetry /
play / comic / etc.) can be added later if usage demands it,
without breaking the existing format.

---

## 9. Scoping decisions (ratified 2026-04-26)

| # | Topic | Decision |
|---|---|---|
| Q1 | Media scope | **Books only.** Audiovisual = separate, later module. |
| Q2 | Metadata fetch | **Server proxy** with API key shared per Nodea instance. Preferences toggle to disable. |
| Q3 | Covers | **Encrypted blob** in dedicated `library_covers_entries` table. |
| Q4 | Priority imports | **Babelio** (format confirmed, cf. §5.1), **Inventaire.io**, then **Goodreads** / **StoryGraph** / generic CSV. |
| Q6 | Multi-reads | **No `reads[]` array** — flat `started_at` / `finished_at`. |
| Q7 | Review distinction | **Two kinds**: `quote` (passages / quotes) and `note` (everything else). |
| Q8 | Tags | **Free-form** at MVP, no pre-defined taxonomy. |

---

## 10. Status

### Phase 1 — Foundations · **shipped**

- ✅ Zod schemas in `@nodea/shared` (`LibraryItemPayload`,
  `LibraryReviewPayload`, `LibraryCoverPayload`).
- ✅ Drizzle tables: `library_items_entries`,
  `library_reviews_entries`, `library_covers_entries`.
- ✅ Backend routes via `collection-factory`.
- ✅ K-page module with catalog and three URL-driven sub-views
  (`?subview=livres|extraits|notes`):
  - **`livres`**: grouped catalog, four display modes
    (`list-plain` / `list-cover` / `grid` / `wall`), choice
    persisted in localStorage.
  - **`extraits`**: flat list of `kind=quote` reviews with the
    parent book's context.
  - **`notes`**: flat list of `kind=note` reviews.
- ✅ Filters: status (`all` / `planned` / `in_progress` /
  `finished` / `abandoned`) + favourites + chip-tag.
- ✅ Five grouping axes: `status` (default), `author`, `tag`,
  `publisher`, `collection`. The `tag` axis lets a book appear in
  several groups (intentional).
- ✅ Composer add / edit of items and reviews via the global
  `ComposerModal`.
- ✅ `BookPickerModal` for the "+ New quote / New note" flow:
  pick the parent book first, then the composer opens pre-filled.

### Phase 2 — Metadata proxy · **shipped**

- ✅ `POST /library/lookup/by-isbn` and
  `POST /library/lookup/by-query` endpoints.
- ✅ In-memory server-side cache
  (`packages/api/src/lookup/cache.ts`).
- ✅ Six adapters: Open Library, Google Books, BNF, BNE, Wikidata
  (via SPARQL), Amazon headless scraping (cf. §4.1). One more than
  the three originally planned.
- ⚠️ **TODO**: Preferences "External metadata" toggle + info
  banner (the feature exists in the backend but isn't disableable
  via the UI).

### Phase 3 — Covers · **partial**

- ✅ Storage: encrypted `library_covers_entries` table, bulk
  decryption at mount, mapped front-side by `cover_rid` (`<img src>`
  as a `data:<mime>;base64,…` URL).
- ⚠️ **TODO**: `/library/cover/proxy` endpoint for server-side
  download of remote URLs (avoids mixed-content + client-side IP
  leaks).
- ⚠️ **TODO**: automatic cover fetch when adding an item via the
  enriched composer.

### Phase 4 — Imports · **not started**

Parsers to implement (descending priority, cf. §5):

- Babelio CSV (format confirmed §5.1).
- Inventaire.io (probably JSON export, Wikidata IDs available).
- Goodreads CSV.
- The StoryGraph CSV.
- Generic CSV with manual column mapping.
- Import UI: upload → preview → mapping → progress + summary.

### Internal refactor · **plan before Phase 4**

`packages/web/src/app/flow/Library/index.tsx` is **1438 lines** and
carries 11 distinct responsibilities (orchestrator + 5 views +
2 modals + 3 logic modules). A split toward the
`flow/<Module>/{components,views,hooks,lib}/` pattern (already
applied in `Habits/` and `Review/`) is required before adding an
import UI and an enriched composer — otherwise the file becomes
unmaintainable.

---

## 11. References

- Reused composer / Markdown editor: `packages/web/src/ui/dirk/ComposerModal.tsx`
- K-page model: `packages/web/src/app/flow/Journal/index.tsx`
  (grouped list + Markdown viewer)
- `collection-client` pattern: `packages/web/src/core/api/modules/collection-client.ts`
- Backend routes factory: `packages/api/src/routes/collection-factory.ts`
- Modular split pattern (to mirror in the refactor):
  `packages/web/src/app/flow/Habits/` and `packages/web/src/app/flow/Review/`
