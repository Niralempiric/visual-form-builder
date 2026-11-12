# Shared answer validation

D06.2 | 11 November 2026

`@visual-form-builder/form-schema` exports `validateAnswers(definition, input)`,
`answerLimits` and the types `AnswerValue`, `CanonicalAnswers`, `AnswerIssueCode`,
`AnswerIssue`, `AnswerValidationResult`. The function accepts unknown values,
validates the supplied definition using the existing strict structural parser,
and returns one of:

```ts
type AnswerValidationResult =
  | { success: true; answers: CanonicalAnswers }
  | { success: false; issues: Array<{ fieldId: string | null; code: AnswerIssueCode }> };
```

There are no partial accepted answers on failure. Issues contain only static
codes and validated definition-owned IDs, never raw answers, unknown keys, labels
or Zod errors. No values are logged or persisted. Callers must provide the exact
trusted version snapshot they intend to validate. The function does not look up
a current draft, make a version immutable, authorize a caller or accept a response.
Current management endpoints still create empty drafts; no submission route or
new definition write endpoint is introduced.

## Empty and required answers

Input is an ordinary or null-prototype JSON object keyed by canonical field UUIDs.
Field/option IDs must exactly match the supplied definition's lowercase IDs;
there is no answer ID remapping. Unknown field IDs fail even when their values are
empty. Any supplied heading/description key fails, including null or an empty
value: layout blocks never collect answers.

For every input, absent keys, null and the empty string mean unanswered. For text
fields, whitespace-only strings also mean unanswered. For multiple choice, an
empty array means unanswered. Unanswered optional values are omitted from the
canonical result, even when a configured minimum would reject a nonempty answer.
Unanswered required inputs fail. A required checkbox additionally requires true;
an optional checkbox accepts and preserves false. Zero is a present numeric answer.

This explicit empty-input convention does not coerce other strings, arrays,
numbers or booleans. An own property containing undefined is not JSON and fails;
use an absent key. Whitespace is not an empty numeric/email/date/choice answer and
fails its respective type/syntax check. Accepted nonempty text preserves original
spacing and literal HTML-looking content. Rendering it safely as plain text is a
consumer responsibility.

## Type semantics

| Type | Accepted nonempty answer |
|---|---|
| shortText / longText | String within configured min/max UTF-16 code-unit lengths, with at least one non-whitespace character when required |
| email | String within configured maxLength and Zod's default bounded email syntax; original case preserved, no trimming or ownership/deliverability claim |
| number | Finite JSON number within ±10^12 and inclusive configured min/max; zero preserved, negative zero canonicalized to zero |
| dropdown / radio | Exact option ID from this definition, never its label or a different snapshot's ID |
| multipleChoice | Array of distinct exact option IDs, configured min/max count; canonical order follows definition option order |
| checkbox | Boolean; required confirmation must be true |
| date | Real Gregorian YYYY-MM-DD string, years 0001–9999, inclusive configured bounds; no timezone conversion |
| rating | Integer in the definition's inclusive rating range |
| heading / description | No supplied key allowed |

Canonical answers have fresh object/array containers and JSON-round-trip without
changing accepted values or IDs. The function does not mutate the definition or
input. Multiple-choice order and negative-zero normalization are deterministic;
this foundation does not implement hashing, idempotency or transaction admission.

## Bounds and error codes

The answer map has an inclusive **128 KiB compact UTF-8 JSON** limit before field
validation. Existing bounded plain-JSON checks reject unsafe keys at every depth,
nonfinite numbers, cycles, functions/undefined, getters/hooks, class instances and
sparse/nonstandard arrays; depth, node and array limits remain those in
[form definitions](FORM_DEFINITIONS.md). The definition retains its separate
256 KiB budget. No accessor/toJSON hook is executed by the data guard.

This object-input function cannot measure original wire whitespace or enforce an
HTTP envelope/body limit before JSON.parse. Future transport routes must enforce
their body limit (including their other envelope fields), safe errors, rate limits
and admission rules independently. No raw validation issues belong in public logs.

| Code | Meaning |
|---|---|
| invalid_definition | Unsupported, malformed or excessive definition; root issue |
| invalid_answers | Invalid/non-JSON/oversized answer container; root issue |
| unknown_field | One root issue for any unknown key, without echoing it |
| layout_answer | An answer was supplied for a layout block |
| required | Required input unanswered, or required confirmation false |
| invalid_type | Nonempty value has the wrong JSON type |
| invalid_value | Invalid syntax, unknown option ID or duplicate choices |
| out_of_range | Valid type exceeds configured length/count/numeric/date/rating bounds |

Issues follow definition order after a possible unknown-field root issue. There
is at most one issue per field plus one root issue (51 at the current field limit).
A malformed container/definition produces a single root issue. Nonfinite numbers
fail the JSON guard before numeric field checks. Codes are shared logic results;
the future API's status/envelope mapping and accessible UI messages remain their
own tasks.

All fields in the current flat definition contract are visible: visibilityRules
is empty. Future rule evaluation must independently compute visibility and prune
known hidden answers before validating visible required fields. This task does
not trust caller-supplied hidden IDs or implement conditional/multistep behavior.
[D06.3 renderer mappings and matching synthetic fixtures](FIELD_REGISTRY.md) are
now available; interactive renderer components remain later work.

## Reproduce the synthetic example

From the repository root with pinned Node/npm selected:

```bash
npm run build:packages
node --input-type=module <<'JSANSWERS'
import { readFile } from 'node:fs/promises';
import { validateAnswers } from '@visual-form-builder/form-schema';
const read = async name => JSON.parse(await readFile(`docs/examples/${name}`, 'utf8'));
const result = validateAnswers(await read('workshop-definition.json'), await read('workshop-answers.json'));
if (!result.success) throw new Error('Synthetic example validation failed.');
console.log(JSON.stringify({ success: result.success, answerCount: Object.keys(result.answers).length }));
JSANSWERS
npm test -- tests/fast/answers.test.ts tests/fast/form-definition.test.ts
```

Expected console result: `{"success":true,"answerCount":3}`. The
[definition](examples/workshop-definition.json) and
[answers](examples/workshop-answers.json) are synthetic local engineering examples,
not an imported/published form, real respondents or stored response data.
