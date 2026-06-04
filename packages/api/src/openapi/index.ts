/**
 * OpenAPI shared helpers.
 *
 * Centralises the moving parts of the `@hono/zod-openapi` integration
 * so individual route files stay terse :
 *   - extends Zod with `.openapi()` once (idempotent), so any schema
 *     in `@nodea/shared` becomes documentable without code changes ;
 *   - exposes a single `OpenAPIHono` factory pre-typed with our
 *     `AuthVariables` so the sub-routers don't repeat the generic ;
 *   - ships ready-made response schemas for the two ubiquitous
 *     shapes — `{ ok: true }` and `{ error: 'snake_case_code' }` —
 *     plus the `jsonContent` / `errorContent` helpers that turn a
 *     Zod schema + description into the OpenAPI `responses` slot.
 *
 * Why a shared module rather than per-route inline schemas : the
 * Nodea API has 50+ routes and ~80 % of them return either
 * `{ ok: true }` or `{ error }` for half the status codes. Inlining
 * those everywhere would balloon the route declarations 3× and
 * obscure the actual shape contract. The helper gives us one source
 * of truth + lets a future audit grep for `errorContent` to see
 * every documented error response.
 */
import {
  OpenAPIHono,
  createRoute,
  extendZodWithOpenApi,
  z,
} from '@hono/zod-openapi';
import type { AuthVariables } from '../middleware/require-user.ts';

// Idempotent at module load — `@asteasolutions/zod-to-openapi` guards
// against double-extension internally.
extendZodWithOpenApi(z);

export { OpenAPIHono, createRoute, z };

/** Standard `{ ok: true }` response body — pervasive across the API. */
export const OkResponseSchema = z.object({ ok: z.literal(true) }).openapi('OkResponse');

/** Standard `{ error: 'snake_case_code' }` response body. */
export const ErrorResponseSchema = z
  .object({ error: z.string() })
  .openapi('ErrorResponse');

/** Helper : declare a JSON response with the given Zod schema + description. */
export function jsonContent<T extends z.ZodTypeAny>(schema: T, description: string) {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  } as const;
}

/** Helper : declare a `{ error }` response with the given description. */
export function errorContent(description: string) {
  return jsonContent(ErrorResponseSchema, description);
}

/** Helper : declare an `{ ok: true }` response. */
export function okContent(description: string = 'Success') {
  return jsonContent(OkResponseSchema, description);
}

/**
 * Default validation-failure hook for every `OpenAPIHono` we build :
 * surface the legacy `{ error: 'invalid_body' }` shape so existing
 * tests + the SPA's error parsing still match. Without this the lib
 * returns its raw `ZodError`, which is a wire-contract change none
 * of the routes intended.
 *
 * We swallow the actual Zod issues — the API's privacy posture is
 * « never echo client input back ». A future opt-in surface for
 * validation details would land here, scoped to dev mode only.
 *
 * Typed as a plain pass-through over the `result` object's
 * `success` discriminant so it satisfies @hono/zod-openapi's `Hook<
 * any, E, any, any>` slot without dragging the full union signature
 * through every router file.
 */
export function defaultInvalidBodyHook(
  result: { success: boolean },
  c: import('hono').Context,
) {
  if (!result.success) {
    return c.json({ error: 'invalid_body' }, 400);
  }
  return undefined;
}

/** Pre-typed OpenAPIHono with our `AuthVariables`. */
export function makeAuthedRouter() {
  return new OpenAPIHono<{ Variables: AuthVariables }>({
    defaultHook: defaultInvalidBodyHook,
  });
}
