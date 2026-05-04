# Habits module (habit tracking)

## Layout

Two tables, like Library:

1. **`habits_items_entries`**
   → One entry = one habit you want to track (e.g. "tennis",
   "meditation").

2. **`habits_logs_entries`**
   → One entry = one dated occurrence (e.g. "did tennis on
   2025-08-25").
   → Powers the heatmap / consistency metric.

Encryption and security rules are identical to every other module —
see [Architecture.md §7](../Architecture.md#7-schéma-commun-des-modules) for the detail (AES-GCM,
HMAC guard, two-phase creation, `requireGuard` validation).

---

## Expected cleartext payload

### A) `habits_items_entries` (habits)

```json
{
  "title": "string",           // e.g. "Tennis"
  "category": "sport|health|creativity|relationship|other",
  "frequency": "daily|weekly|monthly|custom",
  "target": "number|optional", // count/day or count/week if applicable
  "duration": "P6M|optional",  // expected period, ISO 8601 format
  "started_at": "YYYY-MM-DD",
  "archived": "boolean|optional"
}
```

### B) `habits_logs_entries` (occurrences)

```json
{
  "date": "YYYY-MM-DD",
  "item_rid": "string",  // UUID of the related habit (server-side id)
  "done": true
}
```

---

## Export / Import

Cleartext export format (same shape as Mood / Goals / Library):

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "habits_items": [
      {
        "title": "Tennis",
        "category": "sport",
        "frequency": "weekly",
        "target": 1,
        "duration": "P6M",
        "started_at": "2025-08-01"
      }
    ],
    "habits_logs": [
      { "date": "2025-08-05", "item_rid": "rec_abc123", "done": true },
      { "date": "2025-08-12", "item_rid": "rec_abc123", "done": true }
    ]
  }
}
```

* Export: only the cleartext payloads, never `guard`, `cipher_iv`,
  or the encrypted `payload`.
* Import: standard two-phase flow (encrypt locally, POST init, PATCH
  promote).

---

## Key points

* **Everything is end-to-end encrypted** — the server doesn't know
  which habits you track or when you did them.
* **Simplicity**:
  * `items` = habit definitions,
  * `logs` = "done / not done" records at a date.
* **Analytics**:
  * generate a GitHub-style **heatmap** from the `logs`,
  * compute a completion rate (number of logs / expected count via
    `frequency + target`).
* **Flexibility**: when a habit stops → `archived: true` on the item,
  without erasing the logs.
