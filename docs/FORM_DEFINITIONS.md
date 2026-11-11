# Shared structural form definitions

D06.1 | 5 November 2026

`@visual-form-builder/form-schema` now exports `fieldDefinitionSchema`,
`formDefinitionSchema`, `formDefinitionJsonSchema`, `definitionIdSchema`,
`fieldTypeSchema`, `fieldTypes`, `formDefinitionLimits` and inferred
`FieldDefinition`/`FormDefinition` output types. These exports validate structure;
[D06.2 answer validation](ANSWER_VALIDATION.md) is a separate shared function. Rendering, publication validation and save/import
APIs remain pending.

The existing `initialDraftSchema`/`createInitialDraft` exports retain the canonical
empty creation shape. Current management creation still accepts only a name/title
and saves an empty draft; it does not accept arbitrary definitions. The new
structural parser also accepts that canonical empty draft. Saving nonempty drafts
and revision control remain D09; answer validation is now available in D06.2,
and renderer mappings/matching renderer fixtures remain D06.3. No later task is
completed by this foundation.

## Format and identifiers

A version-1 definition has exactly schemaFormatVersion, title, description, fields,
steps, visibilityRules and theme. Title uses the existing trimmed 1–160 UTF-16-code-
unit contract; description is plain text up to 10000 units. At this stage steps and
visibilityRules must be empty and theme is exactly `{ "preset": "neutral" }`.
Fields use `stepId: null` for the single implicit page. Steps/rules/themes widen
only in their later tasks, without prematurely building their behavior here.

Every field has id, type, label, helpText, stepId, required and constraints. Choice
fields also require options. All objects reject unknown keys. Field and option
IDs are required UUIDv4 strings, canonicalized to lowercase and unique across the
whole definition, including across different choices/field kinds. Each option has
exactly id and label. Duplicate display labels are allowed because IDs identify
options. Parsing never generates/replaces IDs and does not mutate input objects;
validated IDs/order survive JSON round trips.

A later editor must generate a fresh field ID when its type/meaning changes.
Single-snapshot structural parsing cannot detect historical changes; no editor,
revision-write or cross-version comparison is implemented by D06.1. Root management
IDs remain Mongo ObjectIds; these portable field/option IDs are separate UUIDs.

Labels must contain non-whitespace text, normally up to 200 UTF-16 units; a
`description` block may have up to 10000. helpText is required but may be empty,
up to 2000 units. Label/help/description text is preserved literally, including
HTML-looking strings; consumers must render plain text. There is no HTML, user
regex, expression, executable callback, arbitrary styling or answer payload.

## Field constraints

| Type | Allowed constraints and structural checks |
|---|---|
| shortText | minLength 0–2000 (default 0), maxLength 1–2000 (default 2000), min ≤ max |
| longText | minLength 0–10000 (default 0), maxLength 1–10000 (default 10000), min ≤ max |
| email | maxLength 1–254, default 254; syntactic answer checks use D06.2 |
| number | Optional finite numeric min/max within ±10^12; min ≤ max when both supplied; no coercion |
| dropdown, radio | 1–100 options with distinct UUIDs; constraints is `{}` |
| multipleChoice | 1–100 options; minChoices 0–100 (default 0), explicit maxChoices 1–100; min ≤ max ≤ option count |
| checkbox | constraints is `{}`; required-answer semantics use D06.2 |
| date | Optional min/max real Gregorian YYYY-MM-DD dates, years 0001–9999, min ≤ max; no Date objects/timezones |
| rating | Integer min/max within 1–10, defaults 1/5; min < max |
| heading, description | required must be false and constraints is `{}`; layout-only, with no options |

No string-to-number/boolean coercion occurs. These checks validate configured
bounds; they do not yet validate a respondent's answer. A structurally valid draft
may be empty or contain only layout blocks. Publication will require at least one
input field and its own complete validation in D10.

## JSON and resource bounds

There are at most **50 fields/layout blocks** and **100 options per choice field**.
Plain JSON validation runs before Zod's structural traversal. It rejects unsafe
keys (`__proto__`, `prototype`, `constructor`) at every depth, nonfinite numbers,
functions/undefined/symbols/bigints, class instances, accessors, nonstandard/sparse
arrays and cycles. Reused acyclic plain-object references are valid; JSON output
contains values, not aliases. Plain/null-prototype records are accepted. No
accessor or toJSON hook is called by the budget walk.

The generic guard caps depth at 8 (root is depth 0), visits at 32768 nodes and
individual arrays at 100 items before key enumeration. Compact JSON, including
keys, punctuation, escaping and UTF-8 bytes, is capped at **256 KiB inclusive**.
Canonical output is checked again because defaults can expand it. The JSON-text
entry point also bounds the original UTF-8 text, including whitespace, before
JSON.parse. Invalid text returns a validation failure. Object input has no original
wire whitespace to count, so its compact representation is measured.

Transport/body limits and authentication remain API responsibilities; this parser
does not replace them. The shared implementation uses only ES2022 and Zod, with
no Node Buffer, DOM TextEncoder, environment, storage, network, logging or random
ID dependency. Keep raw validation errors/private definitions out of public logs;
future APIs must use the existing safe error-envelope mapping.

## Run the synthetic example

Use the pinned runtime at the repository root, then:

```bash
npm run build:packages
node --input-type=module <<'JSDEFINITION'
import { readFile } from 'node:fs/promises';
import { formDefinitionJsonSchema } from '@visual-form-builder/form-schema';
const text = await readFile('docs/examples/workshop-definition.json', 'utf8');
const definition = formDefinitionJsonSchema.parse(text);
console.log(JSON.stringify({ title: definition.title, fieldTypes: definition.fields.map(field => field.type) }));
JSDEFINITION
npm test -- tests/fast/form-definition.test.ts
```

The [example JSON](examples/workshop-definition.json) contains synthetic definitions
only, with no answers, account context or credentials. It is not an imported or
published form. Tests exercise all structural variants, IDs/constraints, exact
UTF-8 budget boundaries, malformed/unsafe/deep/large JSON and unchanged empty-draft
creation. Shared answer fixtures now exist in D06.2; matching renderer fixtures
remain later work. See [testing](TESTING.md) and [progress](IMPLEMENTATION_PROGRESS.md) for observed verification and limitations.
