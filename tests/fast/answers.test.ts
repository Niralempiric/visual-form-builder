import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { answerLimits, createInitialDraft, formDefinitionSchema, validateAnswers } from '@visual-form-builder/form-schema';
let sequence = 0;
const id = () => 'aaaaaaaa-bbbb-4ccc-8ddd-' + (++sequence).toString(16).padStart(12, '0');
function field(type = 'shortText', overrides: object = {}) {
  return { id: id(), type, label: 'Synthetic question', helpText: '', stepId: null, required: true, constraints: {}, ...overrides };
}
const option = () => ({ id: id(), label: 'Synthetic option' });
const form = (fields: unknown[] = []) => ({ ...createInitialDraft('Synthetic answers'), fields });
const inputTypes = ['shortText', 'longText', 'email', 'number', 'dropdown', 'radio', 'multipleChoice', 'checkbox', 'date', 'rating'];
function fixture(type: string, overrides: object = {}) {
  return field(type, { ...(['dropdown', 'radio', 'multipleChoice'].includes(type) ? { options: [option(), option()] } : {}),
    ...(type === 'multipleChoice' ? { constraints: { minChoices: 1, maxChoices: 2 } } : {}), ...overrides });
}
function accepted(definition: unknown, input: unknown) {
  const result = validateAnswers(definition, input);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected valid synthetic answers.');
  return result.answers;
}
function rejected(definition: unknown, input: unknown, code: string) {
  const result = validateAnswers(definition, input);
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected invalid synthetic answers.');
  expect(result.issues.some(issue => issue.code === code)).toBe(true);
  expect(Object.hasOwn(result, 'answers')).toBe(false);
  return result;
}

test('all ten inputs validate in the shared Node-only package with stable canonical values and no input mutation', () => {
  const a = option(), b = option();
  const fields = [field(), field('longText'), field('email'), field('number'),
    field('dropdown', { options: [a, b] }), field('radio', { options: [option()] }),
    field('multipleChoice', { options: [option(), option()], constraints: { maxChoices: 2 } }),
    field('checkbox', { required: false }), field('date'), field('rating'),
    field('heading', { required: false }), field('description', { required: false })];
  const definition = formDefinitionSchema.parse(form(fields));
  const multi = definition.fields[6];
  if (multi?.type !== 'multipleChoice') throw new Error('Fixture must contain choices.');
  const selected = multi.options.map(item => item.id);
  const values = ['  Synthetic <b>name</b>  ', 'Synthetic\nlong answer', 'attendee+tag@example.test', 0,
    a.id, (definition.fields[5] as { options: { id: string }[] }).options[0]?.id,
    Object.freeze([...selected].reverse()), false, '2028-02-29', 5];
  const input = Object.freeze(Object.fromEntries(definition.fields.slice(0, 10).map((item, i) => [item.id, values[i]])));
  const before = JSON.stringify({ definition, input });
  const result = accepted(definition, input);
  expect(Object.values(result)).toEqual([...values.slice(0, 6), selected, false, '2028-02-29', 5]);
  expect(JSON.stringify({ definition, input })).toBe(before);
  expect(accepted(JSON.parse(JSON.stringify(definition)) as unknown, JSON.parse(JSON.stringify(result)) as unknown)).toEqual(result);
});

test('empty optional inputs are omitted consistently, while zero and false are retained', () => {
  for (const type of inputTypes) {
    const item = fixture(type, { required: false });
    for (const value of [null, '']) expect(accepted(form([item]), { [item.id]: value })).toEqual({});
    expect(accepted(form([item]), {})).toEqual({});
  }
  for (const type of ['shortText', 'longText']) {
    const item = fixture(type, { required: false, constraints: { minLength: 3 } });
    expect(accepted(form([item]), { [item.id]: ' \t\n ' })).toEqual({});
  }
  const multi = fixture('multipleChoice', { required: false });
  expect(accepted(form([multi]), { [multi.id]: [] })).toEqual({});
  const zero = field('number'), falseValue = field('checkbox', { required: false });
  expect(accepted(form([zero, falseValue]), { [zero.id]: 0, [falseValue.id]: false })).toEqual({ [zero.id]: 0, [falseValue.id]: false });
});

test('each required input rejects missing/null/empty values; confirmation false is explicitly required', () => {
  for (const type of inputTypes) {
    const item = fixture(type);
    for (const input of [{}, { [item.id]: null }, { [item.id]: '' }]) rejected(form([item]), input, 'required');
  }
  for (const type of ['shortText', 'longText']) {
    const item = field(type); rejected(form([item]), { [item.id]: ' \n\t ' }, 'required');
  }
  const multi = fixture('multipleChoice'); rejected(form([multi]), { [multi.id]: [] }, 'required');
  const checkbox = field('checkbox'); rejected(form([checkbox]), { [checkbox.id]: false }, 'required');
  expect(accepted(form([checkbox]), { [checkbox.id]: true })).toEqual({ [checkbox.id]: true });
});

test('text preserves accepted content and applies published UTF-16 length bounds without coercion', () => {
  const item = field('shortText', { constraints: { minLength: 2, maxLength: 4 } });
  for (const value of ['x', '12345']) rejected(form([item]), { [item.id]: value }, 'out_of_range');
  for (const value of [0, false, [], {}]) rejected(form([item]), { [item.id]: value }, 'invalid_type');
  for (const value of [' 😀 ', '<b>']) expect(accepted(form([item]), { [item.id]: value })[item.id]).toBe(value);
  const long = field('longText');
  expect(accepted(form([long]), { [long.id]: 'x'.repeat(10000) })[long.id]).toHaveLength(10000);
  rejected(form([long]), { [long.id]: 'x'.repeat(10001) }, 'out_of_range');
});

test('email uses bounded syntax checks, preserves case and does not trim or imply ownership', () => {
  const item = field('email');
  const value = 'Synthetic+Tag@Example.test';
  expect(accepted(form([item]), { [item.id]: value })[item.id]).toBe(value);
  for (const value of ['invalid', 'a@@example.test', 'a@example', ' a@example.test ', 'a\nb@example.test']) {
    rejected(form([item]), { [item.id]: value }, 'invalid_value');
  }
  rejected(form([item]), { [item.id]: true }, 'invalid_type');
  const bounded = field('email', { constraints: { maxLength: 8 } });
  expect(accepted(form([bounded]), { [bounded.id]: 'a@b.test' })[bounded.id]).toBe('a@b.test');
  rejected(form([bounded]), { [bounded.id]: 'aa@b.test' }, 'out_of_range');
});

test('numbers preserve zero, canonicalize negative zero and enforce finite absolute/published bounds', () => {
  const item = field('number', { constraints: { min: -2, max: 2 } });
  for (const value of [-2, 0, 2, 0.5]) expect(accepted(form([item]), { [item.id]: value })[item.id]).toBe(value);
  expect(Object.is(accepted(form([item]), { [item.id]: -0 })[item.id], -0)).toBe(false);
  for (const value of [-2.1, 2.1, -1e12 - 1, 1e12 + 1]) rejected(form([item]), { [item.id]: value }, 'out_of_range');
  for (const value of ['0', false, ' ', []]) rejected(form([item]), { [item.id]: value }, 'invalid_type');
  for (const value of [NaN, Infinity, -Infinity]) rejected(form([item]), { [item.id]: value }, 'invalid_answers');
  const wide = field('number');
  for (const value of [-1e12, 1e12]) expect(accepted(form([wide]), { [wide.id]: value })[wide.id]).toBe(value);
});

test('single choices accept only exact published option IDs, never labels, other-version IDs or arrays', () => {
  for (const type of ['dropdown', 'radio']) {
    const choice = option(); const item = field(type, { options: [choice] });
    expect(accepted(form([item]), { [item.id]: choice.id })[item.id]).toBe(choice.id);
    for (const value of [choice.label, choice.id.toUpperCase(), id()]) rejected(form([item]), { [item.id]: value }, 'invalid_value');
    for (const value of [false, [choice.id]]) rejected(form([item]), { [item.id]: value }, 'invalid_type');
  }
});

test('multiple choices reject duplicates/unknown IDs and cardinality violations and canonicalize option order', () => {
  const options = [option(), option(), option()];
  const item = field('multipleChoice', { options, constraints: { minChoices: 2, maxChoices: 2 } });
  const ids = options.map(item => item.id);
  expect(accepted(form([item]), { [item.id]: [ids[1], ids[0]] })[item.id]).toEqual(ids.slice(0, 2));
  for (const value of [[ids[0]], ids]) rejected(form([item]), { [item.id]: value }, 'out_of_range');
  for (const value of [[ids[0], ids[0]], [ids[0], id()]]) rejected(form([item]), { [item.id]: value }, 'invalid_value');
  for (const value of [ids[0], [0], false]) rejected(form([item]), { [item.id]: value }, 'invalid_type');
});

test('checkbox booleans have no string/number truthiness coercion', () => {
  const item = field('checkbox', { required: false });
  for (const value of [false, true]) expect(accepted(form([item]), { [item.id]: value })[item.id]).toBe(value);
  for (const value of ['false', 'true', 0, 1, []]) rejected(form([item]), { [item.id]: value }, 'invalid_type');
});

test('date answers use actual Gregorian days and inclusive version-specific bounds without timezone conversion', () => {
  const item = field('date', { constraints: { min: '2028-02-28', max: '2028-03-01' } });
  for (const value of ['2028-02-28', '2028-02-29', '2028-03-01']) expect(accepted(form([item]), { [item.id]: value })[item.id]).toBe(value);
  for (const value of ['2027-02-29', '1900-02-29', '2028-04-31', '0000-01-01', '2028-02-29T00:00:00Z', '2028-2-29']) {
    rejected(form([item]), { [item.id]: value }, 'invalid_value');
  }
  for (const value of ['2028-02-27', '2028-03-02']) rejected(form([item]), { [item.id]: value }, 'out_of_range');
  rejected(form([item]), { [item.id]: 20280229 }, 'invalid_type');
  const wide = field('date');
  for (const value of ['0001-01-01', '2000-02-29', '9999-12-31']) expect(accepted(form([wide]), { [wide.id]: value })[wide.id]).toBe(value);
});

test('rating answers are integers inside the published range', () => {
  const item = field('rating', { constraints: { min: 2, max: 4 } });
  for (const value of [2, 3, 4]) expect(accepted(form([item]), { [item.id]: value })[item.id]).toBe(value);
  for (const value of [0, 1, 5, 2.5]) rejected(form([item]), { [item.id]: value }, 'out_of_range');
  for (const value of ['3', true]) rejected(form([item]), { [item.id]: value }, 'invalid_type');
});

test('layout blocks reject any supplied answer, and unknown IDs never leak attacker keys/values', () => {
  for (const type of ['heading', 'description']) {
    const item = field(type, { required: false });
    expect(accepted(form([item]), {})).toEqual({});
    for (const value of [null, '', [], false, 0, 'synthetic private value']) rejected(form([item]), { [item.id]: value }, 'layout_answer');
  }
  const input = { 'synthetic private key': 'synthetic private value' };
  const error = rejected(form(), input, 'unknown_field');
  expect(error.issues).toEqual([{ fieldId: null, code: 'unknown_field' }]);
  expect(JSON.stringify(error)).not.toContain('synthetic private');
  const fields = Array.from({ length: 50 }, () => field());
  const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => ['unknown-' + i, 'synthetic']));
  const result = rejected(form(fields), many, 'unknown_field');
  expect(result.issues).toHaveLength(51);
  expect(result.issues.every(issue => issue.fieldId === null || fields.some(field => field.id === issue.fieldId))).toBe(true);
});

test('invalid definitions/answer containers produce static failures without partial answers or hook evaluation', () => {
  rejected({ ...form(), schemaFormatVersion: 2 }, {}, 'invalid_definition');
  rejected(form([field('password')]), {}, 'invalid_definition');
  for (const value of [null, [], 'JSON text', new Date(), new Map(), { missing: undefined }, { big: 1n }, JSON.parse('{"__proto__":{}}') as unknown]) {
    rejected(form(), value, 'invalid_answers');
  }
  let calls = 0;
  const accessor = Object.defineProperty({}, id(), { enumerable: true, get() { calls++; return 'private'; } });
  const hook = { toJSON() { calls++; return {}; } };
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const value of [accessor, hook, cycle, { nested: Array(2) }]) rejected(form(), value, 'invalid_answers');
  expect(calls).toBe(0);
  expect(accepted(form(), Object.create(null))).toEqual({});
  const good = field(), bad = field('number');
  rejected(form([good, bad]), { [good.id]: 'synthetic', [bad.id]: 'invalid' }, 'invalid_type');
});

test('the inclusive 128 KiB compact UTF-8 answer budget is independent of the definition budget', () => {
  const fields = Array.from({ length: 14 }, () => field('longText', { required: false }));
  const input = Object.fromEntries(fields.map((item, i) => [item.id, i < 13 ? 'x'.repeat(10000) : '']));
  const last = fields[13]; if (!last) throw new Error('Fixture missing last field.');
  const padding = answerLimits.bytes - Buffer.byteLength(JSON.stringify(input));
  expect(padding > 0 && padding < 10000).toBe(true); input[last.id] = 'x'.repeat(padding);
  expect(Buffer.byteLength(JSON.stringify(input))).toBe(answerLimits.bytes);
  expect(accepted(form(fields), input)).toEqual(input);
  for (const [value, bytes] of [['😀', 4], ['\n', 2], ['\ud800', 6]] as const) {
    const variant = { ...input, [last.id]: value + input[last.id]!.slice(bytes) };
    expect(Buffer.byteLength(JSON.stringify(variant))).toBe(answerLimits.bytes);
    expect(accepted(form(fields), variant)).toEqual(variant);
  }
  rejected(form(fields), { ...input, [last.id]: input[last.id] + 'x' }, 'invalid_answers');
});

test('validation uses the supplied definition snapshot instead of a mutable current draft', () => {
  const choice = option(), item = field('dropdown', { options: [choice] });
  const old = form([item]), newer = form([{ ...item, options: [option()] }]);
  const input = { [item.id]: choice.id };
  expect(accepted(old, input)).toEqual(input);
  rejected(newer, input, 'invalid_value');
  expect(accepted(old, input)).toEqual(input);
});

test('documented synthetic definition and answers validate through the public shared export', () => {
  const read = (name: string): unknown => JSON.parse(readFileSync(new URL('../../docs/examples/' + name, import.meta.url), 'utf8'));
  const input = read('workshop-answers.json');
  expect(accepted(read('workshop-definition.json'), input)).toEqual(input);
});
