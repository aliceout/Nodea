# Mood module (`mood_entries`)

## Functional description

Daily module for tracking mood and recording three positive things.
- Ideal cadence: one entry per day (optional).
- UI: mood score (−2 to +2), emoji, three positives, optional comment,
  optionally an introspection question / answer.

## Expected cleartext payload

```json
{
  "date": "YYYY-MM-DD",
  "mood_score": "<-2..+2|string|number>",
  "mood_emoji": "🙂",
  "positive1": "string",
  "positive2": "string",
  "positive3": "string",
  "comment": "string|optional",
  "question": "string|optional",
  "answer": "string|optional"
}
```

The `positive1..3` fields are required (the "gratitude" goal).
`question` / `answer` feed downstream analysis modules.

## Security

Mood follows the rules shared by every module — see
[Architecture.md §7](../Architecture.md#7-schéma-commun-des-modules) for the detail
(AES-GCM, HMAC guard, two-phase creation, `requireGuard` validation).

## Export / Import

- Cleartext export: `modules.mood[]` array in `export.json`.
- Import: re-encrypts locally, then replays the POST init → PATCH
  promotion flow.
- Natural deduplication key: the `date` (one entry per day max on the
  client side).
- Read pagination: 200 entries per request.
- Unreadable payloads (main key changed, corruption) are logged
  locally and skipped — no import-blocker.

### Export sample

```json
{
  "modules": {
    "mood": [
      {
        "date": "2025-08-20",
        "mood_score": 1,
        "mood_emoji": "😊",
        "positive1": "Walk with Eva",
        "positive2": "Made progress on Nodea",
        "positive3": "Good meal",
        "comment": "Quiet, productive day",
        "question": "What gave me energy?",
        "answer": "Sunlight and conversation with Anouk"
      }
    ]
  }
}
```

## Key points

1. One entry = one day (but not mandatory).
2. Blind server: the cleartext only exists after decryption in the
   browser.
3. Guards prevent any server-side modification without the main key.
4. Cleartext export is human-readable and reimportable without loss.
