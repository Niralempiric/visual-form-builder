import { expect, test } from 'vitest';
import { fieldTypes, formDefinitionSchema, validateAnswers } from '@visual-form-builder/form-schema';
import { fieldRendererRegistry, resolveFieldRenderer } from '@visual-form-builder/form-renderer';
import { createFieldContractFixtures } from '@visual-form-builder/test-fixtures';

// Independent expected semantics: a schema change cannot silently omit/mis-map a control.
const expected = {
  shortText: ['text', 'string', 'none', 'input'],
  longText: ['textarea', 'string', 'none', 'input'],
  email: ['email', 'string', 'none', 'input'],
  number: ['number', 'number', 'none', 'input'],
  dropdown: ['select', 'string', 'field-options', 'input'],
  radio: ['radio-group', 'string', 'field-options', 'legend'],
  multipleChoice: ['checkbox-group', 'string[]', 'field-options', 'legend'],
  checkbox: ['checkbox', 'boolean', 'none', 'input'],
  date: ['date', 'string', 'none', 'input'],
  rating: ['rating-group', 'number', 'rating-range', 'legend'],
  heading: ['heading', null, 'none', 'element'],
  description: ['description', null, 'none', 'element'],
} as const;

test('the registry, type allowlist and independent fixture set cover exactly the same twelve types', () => {
  const fixtures = createFieldContractFixtures();
  expect(Object.keys(fieldRendererRegistry)).toEqual([...fieldTypes]);
  expect(fixtures.map(fixture => fixture.type)).toEqual([...fieldTypes]);
  expect(new Set(fixtures.map(fixture => fixture.type)).size).toBe(fieldTypes.length);
  expect(Object.isFrozen(fieldRendererRegistry)).toBe(true);
  for (const type of fieldTypes) {
    const spec = fieldRendererRegistry[type];
    expect(Object.isFrozen(spec)).toBe(true);
    expect([spec.control, spec.valueKind, spec.optionSource, spec.labelTarget]).toEqual(expected[type]);
    expect(spec.purpose).toBe(type === 'heading' || type === 'description' ? 'layout' : 'input');
  }
});

test('every contract has an independently valid and invalid answer checked by the shared validator', () => {
  for (const fixture of createFieldContractFixtures()) {
    expect(formDefinitionSchema.safeParse(fixture.definition).success).toBe(true);
    const field = fixture.definition.fields[0];
    expect(field?.type).toBe(fixture.type);
    const result = resolveFieldRenderer(field);
    expect(result.success).toBe(true);
    if (!result.success || !field) throw new Error('Synthetic contract fixture is invalid.');
    expect(result.contract.type).toBe(fixture.type);
    expect(result.contract.field).toEqual(field);
    expect(result.contract.renderer).toEqual(fieldRendererRegistry[fixture.type]);
    expect(validateAnswers(fixture.definition, fixture.validAnswers)).toEqual({ success: true, answers: fixture.canonicalAnswers });
    const invalid = validateAnswers(fixture.definition, fixture.invalidAnswers);
    expect(invalid.success).toBe(false);
    if (invalid.success) throw new Error('Expected the synthetic invalid answer to fail.');
    expect(invalid.issues).toEqual([{ fieldId: field.id, code: fixture.expectedIssue }]);
    expect(Object.hasOwn(invalid, 'answers')).toBe(false);
  }
});

test('choice contracts expose option IDs and labels in schema order, independent of display text', () => {
  for (const fixture of createFieldContractFixtures().filter(fixture => ['dropdown', 'radio', 'multipleChoice'].includes(fixture.type))) {
    const field = fixture.definition.fields[0];
    if (!field || !('options' in field)) throw new Error('Expected a choice fixture.');
    const result = resolveFieldRenderer(field);
    if (!result.success) throw new Error('Expected a valid choice contract.');
    expect(result.contract.options).toEqual([
      { value: '22222222-2222-4222-8222-222222222221', label: 'Synthetic A' },
      { value: '22222222-2222-4222-8222-222222222222', label: 'Synthetic B' },
    ]);
    expect(result.contract.options.map(item => item.value)).toEqual(field.options.map(item => item.id));
    expect(result.contract.options).not.toBe(field.options);
  }
});

test('rating contracts expose the inclusive configured range as numeric values', () => {
  const fixture = createFieldContractFixtures().find(fixture => fixture.type === 'rating');
  const field = fixture?.definition.fields[0];
  if (!field || field.type !== 'rating') throw new Error('Expected the rating fixture.');
  const result = resolveFieldRenderer({ ...field, constraints: { min: 2, max: 4 } });
  expect(result.success).toBe(true);
  if (!result.success || result.contract.type !== 'rating') throw new Error('Expected a rating contract.');
  const min: number = result.contract.field.constraints.min;
  expect(min).toBe(2);
  expect(result.contract.options).toEqual([{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }]);
});

test('layout and individual controls expose no fabricated choice options', () => {
  for (const fixture of createFieldContractFixtures().filter(item => !['dropdown', 'radio', 'multipleChoice', 'rating'].includes(item.type))) {
    const result = resolveFieldRenderer(fixture.definition.fields[0]);
    if (!result.success) throw new Error('Expected a valid synthetic contract.');
    expect(result.contract.options).toEqual([]);
    if (fixture.type === 'heading' || fixture.type === 'description') expect(result.contract.field.required).toBe(false);
  }
});

test('invalid/unsafe fields fail with a static error without executing accessors or leaking inputs', () => {
  const fixture = createFieldContractFixtures()[0];
  if (!fixture) throw new Error('Fixture missing.');
  const field = fixture.definition.fields[0];
  const unsafe = JSON.parse('{"__proto__": {"synthetic": true}}') as object;
  let calls = 0;
  const accessor = Object.defineProperty({}, 'type', { enumerable: true, get() { calls++; return 'shortText'; } });
  const bad = [null, {}, { ...field, type: 'password' }, { ...field, type: '__proto__' },
    { ...field, syntheticSecret: 'synthetic private value' }, { ...field, ...unsafe }, accessor];
  for (const value of bad) {
    const result = resolveFieldRenderer(value);
    expect(result).toEqual({ success: false, code: 'invalid_field' });
    expect(JSON.stringify(result)).not.toContain('synthetic private');
  }
  expect(calls).toBe(0);
});

test('resolution and fixture factories avoid mutating or sharing caller-owned values', () => {
  const first = createFieldContractFixtures();
  const second = createFieldContractFixtures();
  expect(first).toEqual(second);
  const field = first[0]?.definition.fields[0];
  if (!field) throw new Error('Fixture missing.');
  const before = JSON.stringify(first);
  const result = resolveFieldRenderer(Object.freeze(field));
  expect(result.success).toBe(true);
  expect(JSON.stringify(first)).toBe(before);
  if (!result.success) throw new Error('Expected a valid field.');
  expect(result.contract.field).not.toBe(field);
  expect(first[1]?.definition.fields[0]).not.toBe(field);
  expect(second[0]?.definition.fields[0]).not.toBe(field);
});
