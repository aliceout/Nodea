# Journal module (`journal_entries`)

## Functional description

**Free journaling** module — long entries grouped by thread, for
running notes, personal journals, or structured tracking along
thematic threads.

- One entry = a dated text with an optional title and Markdown
  content. The entry date is user-pickable in the composer
  (defaults to today) via the shared `DateField`.
- Two grouping views, toggled in the side column: **by month**
  (the default — date headers like « Mars 2026 ») and **by
  thread** (free string like `#travel`, `#therapy`, `#project-X`,
  autocomplete over existing threads via `ThreadSuggestInput`).
- Inline attachments: 0 to 3 photos per entry, base64-encoded in the
  encrypted payload.

## Expected cleartext payload

```jsonc
{
  "type": "journal.entry",
  "date": "YYYY-MM-DD",
  "thread": "string",                       // free thematic thread, optional
  "title": "string|null",                   // title, optional
  "content": "string",                      // free Markdown, required
  "attachments": [
    {
      "id": "string",                       // unique local identifier
      "mime": "image/png|jpeg|jpg|webp|gif",
      "data": "base64..."                   // raw bytes in base64 (no `data:` prefix)
    }
  ]
}
```

- `content` is required; everything else is optional.
- `attachments` are kept inline as long as the volume stays
  reasonable (~a few hundred KB per entry). If usage demands more,
  a separate `journal_attachments` collection mirroring
  `library_covers_entries` will be added.

## Security

Journal follows the rules shared by every module — see
[Architecture.md §7](../Architecture.md#7-common-modules-schema) for the detail
(AES-GCM, HMAC guard, two-phase creation, `requireGuard` validation).

## Export / Import

- Cleartext export: `modules.journal[]` array in `export.json`.
- Import: re-encrypts locally, then replays the POST init → PATCH
  promotion flow.
- Read pagination: 200 entries per request.
- No natural deduplication key: the user can write several entries
  on the same day in the same thread. Import doesn't deduplicate.

## Key points

1. One entry = a dated free-form text, no constraint on count per
   day.
2. The **thread** is a free grouping — no imposed hierarchy. The UI
   defaults to a by-month view (newest month first); a side-column
   toggle switches to grouping by thread.
3. Attachments stay inline (base64) — sized for the "0-3 small
   photos per entry" use case.
4. Blind server: title, content, photos, threads — everything is
   encrypted, nothing surfaces in plain SQL.
