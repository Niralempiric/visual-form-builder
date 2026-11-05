import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { createInitialDraft, definitionIdSchema, fieldDefinitionSchema, fieldTypes, formDefinitionJsonSchema,
  formDefinitionLimits as limits, formDefinitionSchema, initialDraftSchema } from '@visual-form-builder/form-schema';

let sequence = 0;
const id = () => 'aaaaaaaa-bbbb-4ccc-8ddd-' + (++sequence).toString(16).padStart(12, '0');
function field(type = 'shortText', overrides: object = {}) {
  return { id: id(), type, label: 'Synthetic question', helpText: '', stepId: null, required: true, constraints: {}, ...overrides };
}
const option = (label = 'Synthetic option') => ({ id: id(), label });
const form = (fields: unknown[] = []) => ({ ...createInitialDraft('Synthetic workshop'), fields });
const accepted = (value: unknown) => formDefinitionSchema.safeParse(value).success;

test('all twelve structural variants parse through the built shared package and keep stable IDs across JSON round trips', () => {
  const input = form([
    field(), field('longText'), field('email'), field('number'),
    field('dropdown', { options: [option('Same label'), option('Same label')] }),
    field('radio', { options: [option()] }),
    field('multipleChoice', { options: [option(), option()], constraints: { minChoices: 1, maxChoices: 2 } }),
    field('checkbox'), field('date'),
    field('rating'), field('heading', { required: false }), field('description', { required: false }),
  ]);
  const parsed = formDefinitionSchema.parse(input);
  expect(parsed.fields.map(item => item.type)).toEqual([...fieldTypes]);
  expect(parsed.fields.map(item => item.id)).toEqual(input.fields.map(item => (item as { id: string }).id));
  expect(formDefinitionJsonSchema.parse(JSON.stringify(parsed))).toEqual(parsed);
  expect(parsed.fields[0]?.constraints).toEqual({ minLength: 0, maxLength: 2000 });
  expect(parsed.fields[9]?.constraints).toEqual({ min: 1, max: 5 });
});

test('canonical empty creation remains compatible without widening current management creation', () => {
  const empty = createInitialDraft('Synthetic empty form');
  expect(formDefinitionSchema.parse(empty)).toEqual(empty);
  expect(accepted(form([field()]))).toBe(true);
  expect(initialDraftSchema.safeParse(form([field()])).success).toBe(false);
  const frozen = Object.freeze(form([Object.freeze(field())]));
  const before = JSON.stringify(frozen);
  formDefinitionSchema.parse(frozen);
  expect(JSON.stringify(frozen)).toBe(before);
});

test('UUIDv4 identifiers are normalized once, never generated, and duplicate field/option IDs fail across the form', () => {
  const first = field('dropdown', { options: [option(), option()] });
  expect(definitionIdSchema.parse(first.id.toUpperCase())).toBe(first.id);
  for (const bad of ['', 'field-uuid', '0123456789abcdef01234567', '00000000-0000-0000-0000-000000000000', first.id.replace('-4ccc-', '-1ccc-')]) {
    expect(fieldDefinitionSchema.safeParse({ ...first, id: bad }).success).toBe(false);
  }
  expect(accepted(form([first, { ...field(), id: first.id.toUpperCase() }]))).toBe(false);
  const shared = option();
  expect(accepted(form([field('dropdown', { options: [shared, shared] })]))).toBe(false);
  expect(accepted(form([field('dropdown', { options: [shared] }), field('radio', { options: [shared] })]))).toBe(false);
  expect(accepted(form([field('dropdown', { options: [{ id: first.id, label: 'Collision' }] }), first]))).toBe(false);
  expect(fieldDefinitionSchema.safeParse({ ...first, options: [{ id: first.id, label: 'Own field ID' }] }).success).toBe(false);
});

test('unknown field types, keys, executable configuration and future features fail while plain text is preserved', () => {
  for (const type of ['password', 'file', 'html', 'shorttext', '', null]) expect(accepted(form([field('shortText', { type })]))).toBe(false);
  for (const extra of [{ answers: {} }, { workspaceId: id() }, { schemaFormatVersion: 2 }, { steps: [{ id: id(), title: 'Later' }] },
    { visibilityRules: [{}] }, { theme: { preset: 'custom', css: 'body{}' } }]) expect(accepted({ ...form(), ...extra })).toBe(false);
  for (const extra of [{ html: '<b>raw</b>' }, { constraints: { regex: '.*' } }, { stepId: id() }, { options: [option()] }]) {
    expect(accepted(form([field('shortText', extra)]))).toBe(false);
  }
  expect(accepted(form([field('dropdown', { options: [{ ...option(), value: 'not-an-ID' }] })]))).toBe(false);
  const text = '<script>literal text</script>';
  expect(formDefinitionSchema.parse(form([field('shortText', { label: text })])).fields[0]?.label).toBe(text);
  expect(accepted(form([field('heading')]))).toBe(false);
  expect(accepted(form([field('description', { required: true })]))).toBe(false);
});

test('type-specific limits reject contradictions, nonfinite values and coercions', () => {
  for (const constraints of [{ maxLength: 2001 }, { maxLength: 0 }, { maxLength: 1.5 }, { minLength: 3, maxLength: 2 }, { maxLength: '200' }]) {
    expect(accepted(form([field('shortText', { constraints })]))).toBe(false);
  }
  expect(accepted(form([field('longText', { constraints: { maxLength: 10001 } })]))).toBe(false);
  expect(accepted(form([field('email', { constraints: { maxLength: 255 } })]))).toBe(false);
  for (const constraints of [{ min: 2, max: 1 }, { min: -1e12 - 1 }, { max: 1e12 + 1 }, { max: Infinity }, { min: NaN }, { min: '0' }]) {
    expect(accepted(form([field('number', { constraints })]))).toBe(false);
  }
  for (const constraints of [{ min: 5, max: 5 }, { max: 11 }, { min: 0 }, { max: 3.5 }]) {
    expect(accepted(form([field('rating', { constraints })]))).toBe(false);
  }
  expect(accepted(form([field('number', { constraints: { min: -1e12, max: 1e12 } })]))).toBe(true);
  expect(accepted(form([field('shortText', { constraints: { minLength: 0, maxLength: 2000 } })]))).toBe(true);
});

test('date bounds use real Gregorian days and choice-count bounds fit distinct stable options', () => {
  for (const day of ['1900-02-29', '2025-02-29', '2026-04-31', '0000-01-01', '2026-00-01', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00Z']) {
    expect(accepted(form([field('date', { constraints: { min: day } })]))).toBe(false);
  }
  expect(accepted(form([field('date', { constraints: { min: '2028-01-02', max: '2028-01-01' } })]))).toBe(false);
  expect(accepted(form([field('date', { constraints: { min: '2000-02-29', max: '2400-02-29' } })]))).toBe(true);
  for (const constraints of [{ minChoices: 2, maxChoices: 1 }, { maxChoices: 3 }, { maxChoices: 0 }, { maxChoices: 1.5 }]) {
    expect(accepted(form([field('multipleChoice', { options: [option(), option()], constraints })]))).toBe(false);
  }
  for (const options of [[], Array.from({ length: 101 }, () => option())]) expect(accepted(form([field('dropdown', { options })]))).toBe(false);
  expect(accepted(form([field('dropdown', { options: Array.from({ length: 100 }, () => option()) })]))).toBe(true);
});

test('field, label and help bounds reject oversized structures independently of the total byte budget', () => {
  expect(accepted(form(Array.from({ length: 50 }, () => field())))).toBe(true);
  expect(accepted(form(Array.from({ length: 51 }, () => field())))).toBe(false);
  for (const extra of [{ label: ' ' }, { label: 'x'.repeat(201) }, { helpText: 'x'.repeat(2001) }]) expect(accepted(form([field('shortText', extra)]))).toBe(false);
  expect(accepted({ ...form(), description: 'x'.repeat(10001) })).toBe(false);
});

function boundaryForm(expandDefaults: boolean) {
  const fields = Array.from({ length: 25 }, () => field('description', { label: 'x'.repeat(8192), helpText: 'h'.repeat(2000), required: false }));
  fields.push(field('shortText', { constraints: expandDefaults ? {} : { minLength: 0, maxLength: 2000 } }));
  const definition = form(fields);
  const padding = limits.bytes - Buffer.byteLength(JSON.stringify(definition));
  expect(padding >= 0 && padding <= limits.description).toBe(true);
  return { ...definition, description: 'x'.repeat(padding) };
}
test('the 256 KiB UTF-8 budget is inclusive and applies before parsing and after canonical defaults', () => {
  const exact = boundaryForm(false);
  expect(Buffer.byteLength(JSON.stringify(exact))).toBe(limits.bytes);
  expect(accepted(exact)).toBe(true);
  for (const [text, replacedBytes] of [['😀', 4], ['\n', 2], ['\ud800', 6]] as const) {
    const variant = { ...exact, description: text + exact.description.slice(replacedBytes) };
    expect(Buffer.byteLength(JSON.stringify(variant))).toBe(limits.bytes);
    expect(accepted(variant)).toBe(true);
  }
  expect(accepted({ ...exact, description: exact.description + 'x' })).toBe(false);
  expect(accepted(boundaryForm(true))).toBe(false);
  const unicode = form(Array.from({ length: 15 }, () => field('description', { label: 'é'.repeat(10000), required: false })));
  expect(JSON.stringify(unicode).length < limits.bytes && Buffer.byteLength(JSON.stringify(unicode)) > limits.bytes).toBe(true);
  expect(accepted(unicode)).toBe(false);
  const parse = vi.spyOn(JSON, 'parse');
  expect(formDefinitionJsonSchema.safeParse(' '.repeat(limits.bytes) + JSON.stringify(form())).success).toBe(false);
  expect(formDefinitionJsonSchema.safeParse(JSON.stringify(unicode)).success).toBe(false);
  expect(parse.mock.calls.length).toBe(0); parse.mockRestore();
  expect(formDefinitionJsonSchema.safeParse('{').success).toBe(false);
});

test('unsafe keys, cycles, excessive depth/nodes and non-JSON values fail without evaluating accessors or toJSON', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const raw = '{"' + key + '":{}}';
    expect(accepted({ ...form(), extra: JSON.parse(raw) as unknown })).toBe(false);
    expect(formDefinitionJsonSchema.safeParse(raw).success).toBe(false);
  }
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  let deep: unknown = {}; for (let i = 0; i <= limits.depth; i++) deep = { nested: deep };
  for (const value of [cycle, deep, new Date(), new Map(), { missing: undefined }, { big: 1n }, { callback() {} }, Array(2)]) {
    expect(accepted({ ...form(), extra: value })).toBe(false);
  }
  const largeTree = Array.from({ length: 4 }, () => Array.from({ length: 100 }, () => Array(100).fill(null)));
  const nodeResult = formDefinitionSchema.safeParse({ ...form(), extra: largeTree });
  expect(nodeResult.success).toBe(false);
  if (!nodeResult.success) expect(nodeResult.error.issues[0]?.code).toBe('custom');
  const tooMany = form(Array(100000).fill(null));
  const result = formDefinitionSchema.safeParse(tooMany);
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues.length).toBe(1);
  let calls = 0;
  const accessor = Object.defineProperty(form(), 'fields', { enumerable: true, get() { calls++; throw new Error('Do not execute.'); } });
  expect(accepted(accessor)).toBe(false);
  expect(accepted({ ...form(), toJSON() { calls++; return {}; } })).toBe(false);
  expect(calls).toBe(0);
  expect(accepted({ ...form(), [Symbol('hidden')]: true })).toBe(false);
  const nullPrototype = Object.assign(Object.create(null) as object, form());
  expect(accepted(nullPrototype)).toBe(true);
  const shared = {};
  expect(accepted(form([field('shortText', { constraints: shared }), field('longText', { constraints: shared })]))).toBe(true);
  const nonstandard = [field()];
  Object.defineProperty(nonstandard, 'hidden', { value: true });
  expect(accepted(form(nonstandard))).toBe(false);
});


test('the committed synthetic example parses through the documented JSON entry point', () => {
  const text = readFileSync(new URL('../../docs/examples/workshop-definition.json', import.meta.url), 'utf8');
  const definition = formDefinitionJsonSchema.parse(text);
  expect(definition.title).toBe('Synthetic workshop registration');
  expect(definition.fields.map(item => item.type)).toEqual(['shortText', 'email', 'dropdown']);
  expect(definition.fields[2]?.id).toBe('11111111-1111-4111-8111-111111111113');
});
