import { createStore } from 'zustand/vanilla';
import { definitionIdSchema, fieldDefinitionSchema, formDefinitionLimits, formDefinitionSchema } from '@visual-form-builder/form-schema';
import type { FieldDefinition, FormDefinition } from '@visual-form-builder/form-schema';

type FieldType = FieldDefinition['type'];
type ChoiceField = Extract<FieldDefinition, { type: 'dropdown' | 'radio' | 'multipleChoice' }>;
export const fieldNames: Record<FieldType, string> = {
  shortText: 'Short text', longText: 'Long text', email: 'Email', number: 'Number', dropdown: 'Dropdown',
  radio: 'Single choice', multipleChoice: 'Multiple choice', checkbox: 'Checkbox', date: 'Date', rating: 'Rating',
  heading: 'Heading', description: 'Description',
};
function isChoice(field: FieldDefinition): field is ChoiceField {
  return field.type === 'dropdown' || field.type === 'radio' || field.type === 'multipleChoice';
}
function existingIds(definition: FormDefinition) {
  return new Set(definition.fields.flatMap(field => [field.id, ...(isChoice(field) ? field.options.map(option => option.id) : [])]));
}
function uniqueId(used: Set<string>, generate: () => string): string {
  for (let i = 0; i < 16; i++) {
    const parsed = definitionIdSchema.safeParse(generate());
    if (parsed.success && !used.has(parsed.data)) { used.add(parsed.data); return parsed.data; }
  }
  throw new Error('Could not create an identifier.');
}
function newField(type: FieldType, used: Set<string>, generate: () => string): FieldDefinition {
  const id = uniqueId(used, generate);
  const field: Record<string, unknown> = { id, type, label: fieldNames[type], helpText: '', stepId: null, required: false, constraints: {} };
  if (type === 'dropdown' || type === 'radio' || type === 'multipleChoice') {
    field.options = [{ id: uniqueId(used, generate), label: 'Option 1' }, { id: uniqueId(used, generate), label: 'Option 2' }];
    if (type === 'multipleChoice') field.constraints = { minChoices: 0, maxChoices: 2 };
  }
  return fieldDefinitionSchema.parse(field);
}
export interface EditorState {
  definition: FormDefinition;
  selectedId: string | null;
  dirty: boolean;
  message: string;
  select(id: string): void;
  add(type: FieldType): void;
  label(id: string, value: string): void;
  help(id: string, value: string): void;
  required(id: string, value: boolean): void;
  optionLabel(id: string, optionId: string, value: string): void;
  addOption(id: string): void;
  removeOption(id: string, optionId: string): void;
}

// One store per mounted draft, not a global cache or browser persistence.
export function createEditorStore(initial: unknown, generate: () => string = () => crypto.randomUUID()) {
  const definition = formDefinitionSchema.parse(initial);
  return createStore<EditorState>()((set) => {
    const update = (id: string, change: (field: FieldDefinition) => FieldDefinition) => set(state => {
      const index = state.definition.fields.findIndex(field => field.id === id);
      if (index < 0) return state;
      const current = state.definition.fields[index]!;
      const next = change(current);
      if (next === current) return state;
      const fields = state.definition.fields.map((field, position) => position === index ? next : field);
      return { definition: { ...state.definition, fields }, dirty: true, message: '' };
    });
    return {
      definition, selectedId: null, dirty: false, message: '',
      select: id => set(state => state.definition.fields.some(field => field.id === id) ? { selectedId: id, message: '' } : state),
      add: type => set(state => {
        if (state.definition.fields.length >= formDefinitionLimits.fields) return { message: 'This form has reached the 50 field limit.' };
        try {
          const field = newField(type, existingIds(state.definition), generate);
          return { definition: { ...state.definition, fields: [...state.definition.fields, field] }, selectedId: field.id, dirty: true, message: '' };
        } catch { return { message: 'A new field could not be created. Please try again.' }; }
      }),
      label: (id, value) => update(id, field => {
        const max = field.type === 'description' ? formDefinitionLimits.description : formDefinitionLimits.label;
        return value.length <= max && value !== field.label ? { ...field, label: value } : field;
      }),
      help: (id, value) => update(id, field => value.length <= formDefinitionLimits.helpText && value !== field.helpText ? { ...field, helpText: value } : field),
      required: (id, value) => update(id, field => field.type === 'heading' || field.type === 'description' || field.required === value ? field : { ...field, required: value }),
      optionLabel: (id, optionId, value) => update(id, field => {
        if (!isChoice(field) || value.length > formDefinitionLimits.label || !field.options.some(option => option.id === optionId && option.label !== value)) return field;
        return { ...field, options: field.options.map(option => option.id === optionId ? { ...option, label: value } : option) };
      }),
      addOption: id => set(state => {
        const field = state.definition.fields.find(item => item.id === id);
        if (!field || !isChoice(field)) return state;
        if (field.options.length >= formDefinitionLimits.options) return { message: 'This question has reached the 100 option limit.' };
        try {
          const option = { id: uniqueId(existingIds(state.definition), generate), label: 'Option ' + (field.options.length + 1) };
          const options = [...field.options, option];
          const next = field.type === 'multipleChoice' && field.constraints.maxChoices === field.options.length ?
            { ...field, options, constraints: { ...field.constraints, maxChoices: options.length } } : { ...field, options };
          return { definition: { ...state.definition, fields: state.definition.fields.map(item => item.id === id ? next : item) }, dirty: true, message: '' };
        } catch { return { message: 'A new option could not be created. Please try again.' }; }
      }),
      removeOption: (id, optionId) => update(id, field => {
        if (!isChoice(field) || field.options.length <= 1 || !field.options.some(option => option.id === optionId)) return field;
        const options = field.options.filter(option => option.id !== optionId);
        if (field.type !== 'multipleChoice') return { ...field, options };
        const maxChoices = Math.min(field.constraints.maxChoices, options.length);
        return { ...field, options, constraints: { minChoices: Math.min(field.constraints.minChoices, maxChoices), maxChoices } };
      }),
    };
  });
}
export type EditorStore = ReturnType<typeof createEditorStore>;
