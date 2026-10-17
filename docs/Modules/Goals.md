# Goals module (`goals_entries`)

## Functional description

Tracking of annual (or multi-year) goals.
- One entry = one goal.
- Goals can be grouped by thread (free tag) and filtered by status
  (`open` → `wip` → `done`).
- No automatic logs. The encrypted payload carries an `updatedAt`
  that the client bumps on every save (used by the "Recent" sort) and
  a `completedAt` set when the status flips to `done`.

## Expected cleartext payload

```jsonc
{
  "date": "YYYY-MM-DD",          // reference date (creation, deadline...)
  "title": "string",             // headline
  "note": "string|optional",     // free description
  "status": "open|wip|done",     // progression (see enum note below)
  "thread": "string",            // free tag / group (optional)
  "completedAt": "ISO|null",     // set when status flips to `done`, else null
  "updatedAt": "ISO|string"      // bumped on every save (defaults to "")
}
```

- `title` and `status` are required.
- `thread` powers the history view and the form autocomplete.
- The full `status` enum is `open | wip | done | active | archived`.
  `active` / `archived` are **legacy import aliases** kept for
  forwards-compat with older export files ; they are collapsed in
  `Goals/lib/mappers.ts` (`normalizeStatus`) to `open` / `done`
  respectively, so the UI only ever surfaces the three canonical
  states.
- `completedAt` defaults to `null` (cleared when the goal cycles back
  to `open` / `wip`) ; `updatedAt` defaults to `""`. Both live in the
  encrypted payload, not in a server column.

## Security

Goals follows the rules shared by every module — see
[Architecture.md §7](../Architecture.md#7-common-modules-schema) for the detail
(AES-GCM, HMAC guard, two-phase creation, `requireGuard` validation).

## Export / Import

- Cleartext export: `modules.goals[]`.
- Import: re-encrypts locally, then replays the POST init → PATCH
  promotion flow.
- Natural deduplication key: the `(thread, date, title)` tuple.
- Read pagination: 200 entries per request. Unreadable records are
  surfaced in the import UI via a `legend` listing the missing
  payloads.

### Export sample

```json
{
  "modules": {
    "goals": [
      {
        "date": "2025-01-01",
        "title": "Learn React",
        "note": "Build a small side project",
        "status": "wip",
        "thread": "#learning",
        "completedAt": null,
        "updatedAt": "2025-02-10T09:30:00.000Z"
      },
      {
        "date": "2025-03-15",
        "title": "Tennis every week",
        "status": "open",
        "thread": "#sport",
        "completedAt": null,
        "updatedAt": "2025-03-15T08:00:00.000Z"
      }
    ]
  }
}
```

## Key points

1. UI: detailed form (date, status, tags) + filterable / groupable
   history view.
2. Fast mutations (status toggle) use HMAC guards computed locally.
3. Blind server: goals are fully encrypted. Only `id` (UUID handle),
   `module_user_id` (access sid) and `cipher_iv` (AES-GCM IV) are
   visible. No `user_id`, no timestamp columns — the operator cannot
   link a goal to a user, nor date a write at the DB level.
4. Export / Import preserve the business payload structure, making
   user archiving straightforward.
