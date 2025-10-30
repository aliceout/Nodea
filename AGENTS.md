You are the project assistant for this Node.js codebase.

## Project source of truth

- **Documentation lives in `/documentation`**. Always read and follow it.
- Unless I explicitly say otherwise, **all changes must remain aligned with the logic and principles described there**.
- If something in `/documentation` conflicts with a request, ask for clarification before diverging.

## Change policy (no destructive edits)

- **Do not delete and recreate files just to modify them.** Prefer in-place edits so history and partial changes are preserved.
- Only remove files when I explicitly request it or when the documentation mandates deprecation/removal.

## Code & comments

- **Write code comments and docstrings in English.**
- Use clear function/parameter doc with **JSDoc/TSDoc** (types, side-effects, error cases, example).
- Keep naming consistent with existing patterns in the repo.

## Encoding & text handling

- Assume **UTF-8 everywhere**. Handle/emit text so French accents and non-ASCII chars are preserved (file headers, IO, HTTP headers, DB, logs).
- When reading/writing files, set encoding explicitly (`utf8`).
- When serializing, prefer `application/json; charset=utf-8`.

## Reuse UI components

- In `/ui`, prefer **existing reusable components** (buttons, inputs, textarea, etc.).
- If a new variant is needed, extend existing components rather than duplicating logic.
- Keep visual and behavioral consistency (props naming, accessibility patterns).

## Consistency & architecture

- Follow the current architectural style (layered modules, folder structure, DI patterns).
- Match current **module system** (ESM/CommonJS) and **language** (TypeScript if present, otherwise JS).
- Keep configuration in env vars and typed config modules; avoid hard-coding.

## Error handling & logging

- Fail loud on developer errors; fail soft on user/input errors.
- Use centralized error classes; **never swallow errors**.
- Log with structured logs (level, context, request id). No secrets in logs.

## Security & data

- Treat all external input as untrusted (validation/sanitization).
- Secrets only via env/secret manager; never commit them.
- Follow least-privilege for tokens/keys. Review third-party code before adding.

## Testing & CI (if present)

- Add/maintain **unit tests** for non-trivial logic.
- Keep fast tests colocated; integration tests behind flags.
- Make changes CI-green before considering the task complete.

## Performance & accessibility

- Avoid N+1 and unnecessary allocations; measure before optimizing.
- In `/ui`, meet basic **a11y** (labels, roles, focus, keyboard, contrast).
- Support i18n-safe text handling; no string concatenation of HTML.

## Dependencies

- Prefer stdlib and existing utils.
- Justify new deps; avoid heavy, unmaintained, or overlapping libraries.
- Pin versions; remove unused deps.

## Git hygiene

- Small, focused commits with imperative messages.
- Keep diffs minimal (no reformatting unrelated code).
- If a migration is needed, provide a script or clear steps.