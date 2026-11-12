import { createInitialDraft, formDefinitionSchema, type AnswerIssueCode, type FormDefinition } from '@visual-form-builder/form-schema';

export interface FieldContractFixture {
  readonly type: FormDefinition['fields'][number]['type'];
  readonly definition: FormDefinition;
  readonly validAnswers: Record<string, unknown>;
  readonly canonicalAnswers: Record<string, unknown>;
  readonly invalidAnswers: Record<string, unknown>;
  readonly expectedIssue: AnswerIssueCode;
}

// Fixed, invented UUIDs and values; each call supplies fresh independent objects.
export function createFieldContractFixtures(): FieldContractFixture[] {
  const fieldId = '11111111-1111-4111-8111-111111111111';
  const optionA = '22222222-2222-4222-8222-222222222221';
  const optionB = '22222222-2222-4222-8222-222222222222';
  const otherOption = '22222222-2222-4222-8222-222222222223';
  const choices = [{ id: optionA, label: 'Synthetic A' }, { id: optionB, label: 'Synthetic B' }];
  function make(type: FieldContractFixture['type'], extra: object, valid: unknown, invalid: unknown,
    expectedIssue: AnswerIssueCode, canonical: unknown = valid): FieldContractFixture {
    const layout = type === 'heading' || type === 'description';
    const field = { id: fieldId, type, label: 'Synthetic ' + type, helpText: 'Synthetic help', stepId: null,
      required: !layout, constraints: {}, ...extra };
    const definition = formDefinitionSchema.parse({ ...createInitialDraft('Synthetic fixture'), fields: [field] });
    return { type, definition, validAnswers: layout ? {} : { [fieldId]: valid },
      canonicalAnswers: layout ? {} : { [fieldId]: canonical },
      invalidAnswers: { [fieldId]: invalid }, expectedIssue };
  }
  return [
    make('shortText', { constraints: { minLength: 2, maxLength: 10 } }, 'Hello', 'x', 'out_of_range'),
    make('longText', { constraints: { maxLength: 100 } }, 'Synthetic\ntext', 42, 'invalid_type'),
    make('email', {}, 'attendee@example.test', 'invalid-email', 'invalid_value'),
    make('number', { constraints: { min: -5, max: 5 } }, 0, 6, 'out_of_range'),
    make('dropdown', { options: choices }, optionA, otherOption, 'invalid_value'),
    make('radio', { options: choices }, optionB, 'Synthetic B', 'invalid_value'),
    make('multipleChoice', { options: choices, constraints: { minChoices: 1, maxChoices: 2 } },
      [optionB, optionA], [optionA, optionA], 'invalid_value', [optionA, optionB]),
    make('checkbox', { required: false }, false, 'false', 'invalid_type'),
    make('date', { constraints: { min: '2028-01-01', max: '2028-12-31' } }, '2028-02-29', '2027-02-29', 'invalid_value'),
    make('rating', { constraints: { min: 1, max: 5 } }, 3, 5.5, 'out_of_range'),
    make('heading', {}, null, null, 'layout_answer'),
    make('description', {}, null, null, 'layout_answer'),
  ];
}
