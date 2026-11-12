import { expect, test } from 'vitest';
import { createInitialDraft, fieldTypes, formDefinitionLimits, formDefinitionSchema } from '@visual-form-builder/form-schema';
import { createEditorStore } from '../../apps/web/src/features/editor/store.ts';

function generator() {
  let value = 0;
  return () => 'aaaaaaaa-bbbb-4ccc-8ddd-' + (++value).toString(16).padStart(12, '0');
}
const initial = () => createInitialDraft('Synthetic form');

test('palette adds every allowed field with valid defaults, distinct IDs and immutable updates', () => {
  const original = initial(); const before = JSON.stringify(original);
  const store = createEditorStore(original, generator());
  const previous = store.getState().definition;
  for (const type of fieldTypes) store.getState().add(type);
  const state = store.getState();
  expect(state.definition.fields.map(field => field.type)).toEqual([...fieldTypes]);
  expect(formDefinitionSchema.safeParse(state.definition).success).toBe(true);
  expect(previous.fields).toEqual([]);
  expect(JSON.stringify(original)).toBe(before);
  expect(state.dirty).toBe(true);
  expect(state.selectedId).toBe(state.definition.fields.at(-1)?.id);
  const ids = state.definition.fields.flatMap(field => [field.id, ...('options' in field ? field.options.map(option => option.id) : [])]);
  expect(new Set(ids).size).toBe(ids.length);
});

test('field and option editing preserves identifiers and prior state without mutating other fields', () => {
  const store = createEditorStore(initial(), generator());
  store.getState().add('shortText'); store.getState().add('multipleChoice');
  const before = store.getState().definition;
  const field = before.fields[1];
  if (!field || field.type !== 'multipleChoice') throw new Error('Expected choice field.');
  const first = field.options[0]!; const second = field.options[1]!;
  store.getState().label(field.id, 'Choose sessions');
  store.getState().help(field.id, 'Pick any that apply');
  store.getState().required(field.id, true);
  store.getState().optionLabel(field.id, first.id, 'Morning');
  store.getState().addOption(field.id);
  const after = store.getState().definition;
  const choice = after.fields[1];
  if (!choice || choice.type !== 'multipleChoice') throw new Error('Expected choice field.');
  expect(after).not.toBe(before); expect(after.fields).not.toBe(before.fields);
  expect(after.fields[0]).toBe(before.fields[0]);
  expect(field.label).toBe('Multiple choice'); expect(field.options[0]?.label).toBe('Option 1');
  expect(choice.label).toBe('Choose sessions'); expect(choice.helpText).toBe('Pick any that apply');
  expect(choice.required).toBe(true); expect(choice.id).toBe(field.id);
  expect(choice.options.map(option => option.id).slice(0, 2)).toEqual([first.id, second.id]);
  expect(choice.options[0]?.label).toBe('Morning'); expect(choice.constraints.maxChoices).toBe(3);
  expect(formDefinitionSchema.safeParse(after).success).toBe(true);
  store.getState().removeOption(field.id, first.id);
  const reduced = store.getState().definition.fields[1];
  if (!reduced || reduced.type !== 'multipleChoice') throw new Error('Expected choice field.');
  expect(reduced.options.map(option => option.id)).toEqual([second.id, choice.options[2]?.id]);
  expect(reduced.constraints.maxChoices).toBe(2);
  expect(formDefinitionSchema.safeParse(store.getState().definition).success).toBe(true);
});

test('transient blank labels can be corrected, and length constraints remain bounded', () => {
  const store = createEditorStore(initial(), generator()); store.getState().add('dropdown');
  const field = store.getState().definition.fields[0];
  if (!field || field.type !== 'dropdown') throw new Error('Expected dropdown.');
  const option = field.options[0]!;
  store.getState().label(field.id, ''); store.getState().optionLabel(field.id, option.id, '');
  expect(formDefinitionSchema.safeParse(store.getState().definition).success).toBe(false);
  store.getState().label(field.id, 'Session'); store.getState().optionLabel(field.id, option.id, 'First session');
  expect(formDefinitionSchema.safeParse(store.getState().definition).success).toBe(true);
  const valid = store.getState().definition;
  store.getState().label(field.id, 'x'.repeat(formDefinitionLimits.label + 1));
  store.getState().optionLabel(field.id, option.id, 'x'.repeat(formDefinitionLimits.label + 1));
  store.getState().help(field.id, 'x'.repeat(formDefinitionLimits.helpText + 1));
  expect(store.getState().definition).toBe(valid);
});

test('choice and field limits protect state, including the final remaining option', () => {
  const store = createEditorStore(initial(), generator()); store.getState().add('dropdown');
  const field = store.getState().definition.fields[0];
  if (!field || field.type !== 'dropdown') throw new Error('Expected dropdown.');
  store.getState().removeOption(field.id, field.options[1]!.id);
  store.getState().removeOption(field.id, field.options[0]!.id);
  const one = store.getState().definition.fields[0];
  if (!one || one.type !== 'dropdown') throw new Error('Expected dropdown.');
  expect(one.options).toHaveLength(1);
  for (let i = 1; i < formDefinitionLimits.options; i++) store.getState().addOption(field.id);
  const full = store.getState().definition;
  store.getState().addOption(field.id);
  expect(store.getState().definition).toBe(full);
  expect(store.getState().message).toContain('100 option');
  for (let i = 1; i < formDefinitionLimits.fields; i++) store.getState().add('shortText');
  const fullForm = store.getState().definition;
  store.getState().add('shortText');
  expect(store.getState().definition).toBe(fullForm);
  expect(store.getState().message).toContain('50 field');
});

test('identifier collisions fail safely and draft stores are independent', () => {
  const repeated = () => 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
  const first = createEditorStore(initial(), repeated), second = createEditorStore(initial(), generator());
  first.getState().add('shortText'); const one = first.getState().definition;
  first.getState().add('shortText');
  expect(first.getState().definition).toBe(one);
  expect(first.getState().message).toContain('could not be created');
  expect(second.getState().definition.fields).toEqual([]); expect(second.getState().dirty).toBe(false);
  first.getState().select('unknown'); expect(first.getState().selectedId).toBe(one.fields[0]?.id);
  second.getState().add('heading'); const layout = second.getState().definition.fields[0]!;
  second.getState().required(layout.id, true);
  expect(second.getState().definition.fields[0]?.required).toBe(false);
});
