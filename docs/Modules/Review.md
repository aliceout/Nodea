# Review module

Digital version of the **YearCompass** booklet (https://yearcompass.com/),
faithful to the printable A4 booklet. Each section of the booklet
maps to a step in the guided journey; labels and order match the
booklet exactly.

## 1. `review_entries` table

Schema shared by every module (cf. [Architecture.md §7](../Architecture.md#7-schéma-commun-des-modules)).
Mutations validated via `requireGuard(reviewEntries)` on the api side
— the `(user, sid, guard)` tuple is checked in a single centralised
pass by the `collection-factory`.

**Access**:

* `list/view`: by `module_user_id` (header `X-Sid: <sid>`).
* `update/delete`: headers `X-Sid: <sid>` + `X-Guard: <guard>`; the
  guard is checked against the server-stored value, never returned
  on read. Headers and not query params (SEC-01) — the guard is
  HMAC material derived from the main key, it must not leak into
  logs.

**System fields** (5 columns only, minimum-readable-surface design):

| Field            | Type          | Required | Notes                                          |
| ---------------- | ------------- | -------- | ---------------------------------------------- |
| `id`             | `text` PK     | yes      | UUID generated server-side, handle for `/records/:id` |
| `module_user_id` | `text`        | yes      | Opaque sid — **the only access key** (the user → sid mapping lives encrypted in `modules_config`) |
| `payload`        | `text`        | yes      | Base64 of an AES-GCM blob (encrypted content, **+ application-level `updated_at`** for the "modified on" sort) |
| `cipher_iv`      | `text`        | yes      | AES-GCM IV (12 bytes, base64)                  |
| `guard`          | `text`        | yes      | Stored HMAC, never returned on read            |

**No `user_id`, no timestamp columns.** The server doesn't know who
a review belongs to or when it was written at the DB level.

---

## 2. Expected cleartext payload (encrypted client-side)

Order and names follow the YearCompass booklet, page by page. The
`ReviewPayloadSchema` (`packages/shared/src/schemas/modules.ts`) is
`passthrough` — adding or removing a field doesn't break validation,
but the wizard and the reader only render what's listed here.

```json
{
  "year": 2026,

  "last_year": {
    // Page 4 — Review your calendar
    "agenda_review": ["string"],

    // Page 5 — This is what my past year was like
    // (eight life areas, exactly as in the booklet)
    "life_areas": {
      "personal_family":   ["string"],   // personal life, family
      "career_studies":    ["string"],   // career, studies
      "friends_community": ["string"],   // friends, community
      "leisure_creativity":["string"],   // relaxation, hobbies, creativity
      "physical_health":   ["string"],   // physical health, vitality
      "mental_health":     ["string"],   // mental and emotional health
      "habits":            ["string"],   // habits that define you
      "better_world":      ["string"]    // a better future (booklet footnote)
    },

    // Page 6 — Six sentences about my past year
    // (booklet order)
    "six_phrases": {
      "wisest_decision":       "string", // The wisest decision I made…
      "biggest_lesson":        "string", // The biggest lesson I learned…
      "biggest_risk":          "string", // The biggest risk I took…
      "biggest_surprise":      "string", // The biggest surprise of the year…
      "service_rendered":      "string", // The greatest service I did for others…
      "biggest_accomplishment":"string"  // The biggest thing I accomplished…
    },

    // Page 7 — Six questions about my past year
    // (booklet order)
    "six_questions": {
      "proud_of":            "string",   // What are you most proud of?
      "influenced_by":       ["string"], // Three people who influenced you the most
      "influenced":          ["string"], // Three people you influenced the most
      "not_realized":        "string",   // What couldn't you accomplish?
      "best_self_discovery": "string",   // The best thing you discovered about yourself
      "gratitude":           "string"    // What are you most grateful for?
    },

    // Page 8 — The best moments (free text, replaces the drawing)
    "best_moments": "string",

    // Page 9 — My three biggest successes + my three biggest challenges
    // (both blocks share the same booklet page)
    "successes_and_challenges": {
      "three_successes":  ["string"], // Note your three biggest successes
      "successes_how":    "string",   // What did you do to achieve them? Who helped, how?
      "three_challenges": ["string"], // Note your three biggest challenges
      "challenges_how":   "string"    // Who or what helped you? What did you learn about yourself?
    },

    // Page 10 — Forgiveness
    "forgiveness": "string",

    // Page 11 — Letting go (free text, replaces the drawing)
    "letting_go": "string",

    // Page 12 — Closing the past year
    "closing": {
      "three_words": ["string"], // The past year in three words
      "book_title":  "string",   // The book / film of my past year
      "farewell":    "string"    // Say goodbye to your past year
    }
  },

  "next_year": {
    // Page 14 — Dare to dream big!
    "dream_big": "string",

    // Page 15 — This new year will look like this for me
    // (same eight life areas as last_year)
    "life_areas": {
      "personal_family":   ["string"],
      "career_studies":    ["string"],
      "friends_community": ["string"],
      "leisure_creativity":["string"],
      "physical_health":   ["string"],
      "mental_health":     ["string"],
      "habits":            ["string"],
      "better_world":      ["string"]
    },

    // Pages 16-17 — The magical triplet for the year ahead
    // (exact booklet order)
    "triplets": {
      "self_love":       ["string"], // three things about myself I'm going to love
      "let_go":          ["string"], // three things I'm ready to let go of
      "main_goals":      ["string"], // three most important things I want to accomplish
      "support":         ["string"], // three people who'll be my support
      "discover":        ["string"], // three things I'll dare to discover
      "say_no":          ["string"], // three things I'll have the power to say no to
      "environment":     ["string"], // three things to make my environment more comfortable
      "morning_routines":["string"], // three things I'll do every morning
      "self_care":       ["string"], // three things to take care of myself regularly
      "places":          ["string"], // three places I'll visit
      "get_closer":      ["string"], // three ways to grow closer to those I love
      "rewards":         ["string"]  // three rewards for my successes
    },

    // Page 18 — Six sentences about my year ahead
    // (booklet order)
    "six_phrases": {
      "no_procrastination":"string", // This year, I won't put off any longer…
      "energy_source":     "string", // This year, I'll get most of my energy from…
      "courage":           "string", // This year I'll be most courageous when…
      "positive_answer":   "string", // This year, I'll answer positively when…
      "advice":            "string", // For this new year, I advise myself to…
      "special_because":   "string"  // This year will be special for me because…
    },

    // Page 19 — My word for next year
    "word_of_year": "string",

    // Page 19 — Secret wish
    "secret_wish": "string"
  }
}
```

### Intended differences from the paper booklet

* **Pages 2-3 (Welcome / Get ready)** are replaced by a short intro
  screen tuned to the app's tone (calm, encrypted draft, no
  judgement) — no associated payload.
* **Drawings** (best_moments, letting_go, dream_big) become free
  text — writing replaces drawing.
* **Pages 12-13 (transition between halves)** are not a separate
  screen: the wizard moves on directly, the progress bar marks the
  switch to the second half.
* **Page 20 (date + signature under the credo)** is dropped — the
  record's `updatedAt` and the account identity replace the paper
  ritual; the secret wish (page 19) closes the journey.

---

## 3. Export / Import

**Cleartext export** (same shape as Mood / Goals):

```json
{
  "meta": {
    "version": 1,
    "exported_at": "2026-01-15T20:00:00Z",
    "app": "Nodea"
  },
  "modules": {
    "review": [
      {
        "year": 2026,
        "last_year": {
          "agenda_review": ["trip to Tana", "leaving the mission"],
          "life_areas": {
            "personal_family":    ["closer to my sister"],
            "career_studies":     ["finished a project"],
            "friends_community":  ["trip with Eva"],
            "leisure_creativity": ["writing workshop"],
            "physical_health":    ["more sport"],
            "mental_health":      ["started therapy"],
            "habits":             ["daily reading"],
            "better_world":       ["regular volunteering"]
          },
          "six_phrases":  { "wisest_decision": "…", "...": "..." },
          "six_questions":{ "proud_of": "…", "...": "..." },
          "best_moments": "evening on the beach with Anouk…",
          "successes_and_challenges": {
            "three_successes":  ["building Nodea"],
            "successes_how":    "I took the time, I learned to ask for help",
            "three_challenges": ["burnout"],
            "challenges_how":   "my sister pulled me back up"
          },
          "forgiveness": "I forgive…",
          "letting_go":  "I let go of…",
          "closing": {
            "three_words": ["tired", "learning", "love"],
            "book_title":  "A long road",
            "farewell":    "Goodbye 2025, thanks for everything."
          }
        },
        "next_year": {
          "dream_big": "see myself in a job that fits",
          "life_areas": { "...": "..." },
          "triplets":   { "self_love": ["my hands"], "...": "..." },
          "six_phrases":{ "no_procrastination": "writing", "...": "..." },
          "word_of_year": "grounding",
          "secret_wish":  "feel more free"
        }
      }
    ]
  }
}
```

* **Export**: never `payload`, `cipher_iv`, `guard`, `id`.
* **Import**: local re-encryption, `POST init` → `PATCH promote`
  flow.

---

## 4. Key points

* **Faithful to the YearCompass booklet**: labels, question order
  and grouping (page 9 successes + challenges, page 12 three
  closing sections, etc.) reproduce the paper booklet.
* **Drawings → text**: three sections where the booklet asks for
  drawings (best_moments, letting_go, dream_big) accept free text.
* **No symbolic image**: no `year_image` field — the booklet
  doesn't have one.
* **Full confidentiality**: everything is encrypted client-side
  (AES-GCM + HMAC guard). Nothing leaves the browser in cleartext.
* **Cadence**: one entry per year, but it can be redone any time.
* **UX**: guided, question-by-question, like turning the booklet's
  pages. Encrypted auto-save in `localStorage` while writing.
