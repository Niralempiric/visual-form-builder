# Field renderer contracts and synthetic fixtures

D06.3 | 12 November 2026

The existing `@visual-form-builder/form-renderer` workspace exports a frozen,
exhaustive `fieldRendererRegistry` and `resolveFieldRenderer(field)`. The latter
validates an unknown single-field definition with the shared structural schema,
then returns either `{ success: true, contract }` or the static failure
`{ success: false, code: 'invalid_field' }`. It does not echo invalid data.

A successful `FieldRendererContract` is a discriminated union: `type` narrows
`field` and `renderer` together. The parsed `field` retains its stable UUID,
plain-text label/help, required flag and typed constraints. The renderer descriptor
specifies its purpose, control, answer value kind, option source and label target.
`options` is a fresh ordered list of `{ value, label }` entries. The resolver does
not mutate the supplied field; the registry and each descriptor are frozen.

| Field | Control contract | Value kind | Options | Label target |
|---|---|---|---|---|
| shortText | text | string | none | input |
| longText | textarea | string | none | input |
| email | email | string | none | input |
| number | number | number | none | input |
| dropdown | select | string | field options | input |
| radio | radio-group | string | field options | legend |
| multipleChoice | checkbox-group | string[] | field options | legend |
| checkbox | checkbox | boolean | none | input |
| date | date | string | none | input |
| rating | rating-group | number | configured inclusive range | legend |
| heading | heading | no answer | none | element |
| description | description | no answer | none | element |

For choices, option values are stable UUIDs and labels are display text in schema
order. Rating options have numeric values and decimal labels over the validated
integer range. Other controls have an empty options list. Group `legend` means
future controls need an accessible group label; `input` requires an associated
label and `element` is layout text. Labels/help/options remain untrusted plain text;
consumers must render them as text, never HTML. The descriptor is an implementation
contract, not proof of accessibility or an interactive component.

`@visual-form-builder/test-fixtures` exports `createFieldContractFixtures()` and
`FieldContractFixture`. The factory makes twelve independent synthetic definitions
(one for each input/layout type), with valid answers, expected canonical answers,
invalid answers and an expected shared validation issue. Each invocation returns
fresh objects. Choice fixtures demonstrate stable IDs and canonical selection
order, number zero and optional checkbox false are retained, and layout answers
are rejected. Fixture UUIDs, labels and email are synthetic, with no real responses.

The registry validates one definition field, not the whole form. A future renderer
must validate the containing definition, use the matching version snapshot, call
shared answer validation, preserve option value types and implement accessible
controls. Visibility, editor integration, UI events, preview/public rendering,
submission, persistence and publication remain later tasks. Management APIs still
create empty drafts only. The registry/fixture task does not claim an end-to-end
form journey or browser/server rendering parity.

## Reproduce the synthetic contract check

From the repository root with pinned Node/npm selected:

```bash
npm run build:packages
node --input-type=module <<'JSREGISTRY'
import { createFieldContractFixtures } from '@visual-form-builder/test-fixtures';
import { resolveFieldRenderer } from '@visual-form-builder/form-renderer';
import { validateAnswers } from '@visual-form-builder/form-schema';
const fixtures = createFieldContractFixtures();
for (const fixture of fixtures) {
  const contract = resolveFieldRenderer(fixture.definition.fields[0]);
  const valid = validateAnswers(fixture.definition, fixture.validAnswers);
  const invalid = validateAnswers(fixture.definition, fixture.invalidAnswers);
  if (!contract.success || !valid.success || invalid.success ||
      !invalid.issues.some(issue => issue.code === fixture.expectedIssue)) throw new Error('Synthetic contract check failed.');
}
console.log(JSON.stringify({ contracts: fixtures.length, inputTypes: 10, layoutTypes: 2 }));
JSREGISTRY
npm test -- tests/fast/field-contracts.test.ts tests/fast/answers.test.ts tests/fast/form-definition.test.ts
```

Expected output: `{"contracts":12,"inputTypes":10,"layoutTypes":2}`. The
[testing guide](TESTING.md) and [progress record](IMPLEMENTATION_PROGRESS.md)
distinguish these contract checks from future browser and release gates.
