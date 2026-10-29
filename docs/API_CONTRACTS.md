# Shared API contracts

D03.1 | 27 October 2026

`packages/contracts` exports runtime Zod schemas and inferred types shared by the
frontend and Express. `apps/api/src/http.ts` supplies validation, cursor encoding,
correlation and safe error handling. No account, form or response endpoints exist
yet. The success/list examples below are synthetic contract examples exercised
through a test-only router, not shipped data endpoints.

## Envelopes and errors

Normal JSON success uses `{ data, correlationId }`. Lists use
`{ data: [], nextCursor: string | null, correlationId }`, with `nextCursor: null`
on the last page. Supply an endpoint-specific **strict, allowlisted DTO schema**
to `successEnvelopeSchema(dto)` or `pageEnvelopeSchema(dto)`; these factories do
not automatically remove secrets from arbitrary objects. Parse the outgoing DTO
before sending it. Root-level unknown properties and invalid DTO fields fail.

Synthetic single success:

```json
{
  "data": {"id": "0123456789abcdef01234567"},
  "correlationId": "123e4567-e89b-42d3-a456-426614174001"
}
```

Errors use this stable shape; the same ID is in the `X-Correlation-ID` header:

```json
{
  "error": {"code": "MALFORMED_REQUEST", "message": "The request is malformed."},
  "correlationId": "123e4567-e89b-42d3-a456-426614174001"
}
```

| HTTP | Shared code | Intended meaning |
|---|---|---|
| 400 | MALFORMED_REQUEST | Invalid structure, ID, page query or cursor |
| 401 | UNAUTHENTICATED | Missing management identity |
| 403 | FORBIDDEN | Known forbidden action |
| 404 | NOT_FOUND | Missing or inaccessible resource |
| 409 | CONFLICT / CONTEXT_EXPIRED | Revision/idempotency conflict, or expired render context |
| 410 | FORM_CLOSED | Closed/revoked public form |
| 413 | PAYLOAD_TOO_LARGE | Body limit exceeded |
| 422 | ANSWER_INVALID | Invalid answers |
| 429 | RATE_LIMITED | Configured request limit |
| 503 | DEPENDENCY_UNAVAILABLE | Required dependency unavailable |
| 500 | INTERNAL_ERROR | Unexpected internal failure |

The catalog defines fixed messages. Only `ANSWER_INVALID` may include an optional
`error.fieldErrors` array of 1–50 strict `{ fieldId, message }` objects. Each ID is
a UUID; messages come from the shared required/invalid/allowed-option catalog.
Never include entered answers, schema labels, arbitrary exception text, stack
traces, database details or workspace metadata. Add future safe messages to the
catalog intentionally rather than inserting raw validator issues.

`parseContract(schema, unknownInput)` converts schema failures to
`ApiError('MALFORMED_REQUEST')`. Trusted application decisions may throw an
`ApiError` with a catalog code. Unexpected failures, including invalid internally
constructed errors, become safe 500 responses. The terminal handler sends JSON
instead of Express's HTML error page and does not log raw exceptions. If headers
were already sent, it closes the response; it cannot replace a partial stream
with a JSON envelope. Streaming exports require their own later delivery contract.

Express installs correlation first, the `/api/v1` router next, and JSON 404/error
handlers last. Unknown paths return safe 404 JSON. This actual current behavior
can be checked against a running API (after loading local configuration):

```bash
curl --silent --show-error --include \
  -H 'X-Correlation-ID: 123e4567-e89b-42d3-a456-426614174001' \
  "http://127.0.0.1:${API_PORT}/api/v1/does-not-exist"
```

Expect HTTP 404, `error.code: NOT_FOUND`, `Cache-Control: no-store`, and the supplied
correlation ID in header/body. All current responses are uncached. Operational
`/health/live` and `/health/ready` keep their original `{ status, service }` JSON
for existing health consumers, with a correlation **header**, without an envelope.

## Identifiers and correlation

- Management document IDs use exactly 24 hexadecimal characters, canonicalized
  to lowercase before a database lookup. Objects, arrays, numbers and whitespace
  fail; no generic object/string coercion is used.
- Stable field/option/step UUIDs use `fieldIdSchema` (UUID syntax); schema generation,
  uniqueness and reference validation belong to the later form-schema work.
- Correlation IDs use UUID v4. A valid incoming `X-Correlation-ID` is reused;
  absent, malformed, duplicated/joined or oversized values are replaced with a
  fresh server-generated UUID. Values within Node's accepted header-size limit
  reach this middleware; transport-level header rejection occurs before Express.
- A caller-supplied ID is untrusted operational metadata. It grants no identity,
  authorization, tenant access or submission deduplication. Do not put secrets in
  it. No new request logging or browser persistence is introduced here.

## Bounded pagination

`paginationQuerySchema` accepts only optional `limit` and `cursor`. Omitted limit
is **25**, maximum **100**. A supplied limit must be a decimal string from 1–100;
repeated keys, nested objects, unknown keys, fractions, signs, leading zeroes and
numeric exponent notation fail with 400. Future list endpoints may explicitly
extend this schema with their own bounded, allowlisted filters.

`encodeCursor({ v: 1, at, id })` creates a base64url token; `parsePagination(query)`
returns `{ limit, after: position | null }`. The token is bounded to 256 characters
before decoding. The server rejects malformed/noncanonical base64url, invalid
JSON, unknown keys, unsupported versions, invalid dates and invalid document IDs.
`at` is a UTC ISO timestamp with three fractional digits, `id` a document ID.

This tuple supports descending timestamp/ID keyset pagination (for responses,
`acceptedAt`, then `_id`); later list implementations must use that deterministic
order, a strict boundary and matching indexes. No database list query or claim of
cross-page database correctness is implemented by D03.1. Cursors are opaque client
bookmarks, **unsigned and non-secret**. They can be forged and are never proof of
access. Every later query must independently apply authenticated tenant/form,
expiry and filter scope; never merge a cursor object into a Mongo query.

## Verification and limits

```bash
npm run test:contracts
```

This builds shared packages, then runs the typed Vitest/Supertest contract suite
against the Express source with disposable loopback HTTP listeners. Checks cover
strict DTOs, malformed IDs,
page bounds, cursor payloads, safe error codes/messages, correlation propagation
and regeneration, real HTTP success/failure and health compatibility. Synthetic
routes are installed only by the test; no debug route ships in the default app.

D03.2 configures lint, strict test types and reusable database fixtures; see
[Repository testing](TESTING.md). D03.3 adds CI. Body parsing/size enforcement,
auth/CSRF, tenant queries, immutable
publishing and submissions remain later tasks. No JSON body parser was introduced.
The previously recorded Express/body-parser advisory remains unresolved; see the
D02.3 progress entry for its precise scope and triage requirement before parsing
requests or hosted use. This contract task does not claim a complete form release.
