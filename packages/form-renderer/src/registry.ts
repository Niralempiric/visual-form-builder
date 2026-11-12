import { fieldDefinitionSchema, type FieldDefinition } from '@visual-form-builder/form-schema';

type FieldType = FieldDefinition['type'];
type RendererSpec = {
  readonly purpose: 'input' | 'layout';
  readonly control: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'radio-group' |
    'checkbox-group' | 'checkbox' | 'date' | 'rating-group' | 'heading' | 'description';
  readonly valueKind: 'string' | 'number' | 'boolean' | 'string[]' | null;
  readonly optionSource: 'none' | 'field-options' | 'rating-range';
  readonly labelTarget: 'input' | 'legend' | 'element';
};

// These contracts describe controls for the later renderer; they do not render UI.
const registry = {
  shortText: { purpose: 'input', control: 'text', valueKind: 'string', optionSource: 'none', labelTarget: 'input' },
  longText: { purpose: 'input', control: 'textarea', valueKind: 'string', optionSource: 'none', labelTarget: 'input' },
  email: { purpose: 'input', control: 'email', valueKind: 'string', optionSource: 'none', labelTarget: 'input' },
  number: { purpose: 'input', control: 'number', valueKind: 'number', optionSource: 'none', labelTarget: 'input' },
  dropdown: { purpose: 'input', control: 'select', valueKind: 'string', optionSource: 'field-options', labelTarget: 'input' },
  radio: { purpose: 'input', control: 'radio-group', valueKind: 'string', optionSource: 'field-options', labelTarget: 'legend' },
  multipleChoice: { purpose: 'input', control: 'checkbox-group', valueKind: 'string[]', optionSource: 'field-options', labelTarget: 'legend' },
  checkbox: { purpose: 'input', control: 'checkbox', valueKind: 'boolean', optionSource: 'none', labelTarget: 'input' },
  date: { purpose: 'input', control: 'date', valueKind: 'string', optionSource: 'none', labelTarget: 'input' },
  rating: { purpose: 'input', control: 'rating-group', valueKind: 'number', optionSource: 'rating-range', labelTarget: 'legend' },
  heading: { purpose: 'layout', control: 'heading', valueKind: null, optionSource: 'none', labelTarget: 'element' },
  description: { purpose: 'layout', control: 'description', valueKind: null, optionSource: 'none', labelTarget: 'element' },
} as const satisfies Record<FieldType, RendererSpec>;
Object.values(registry).forEach(Object.freeze);
export const fieldRendererRegistry = Object.freeze(registry);

export type RendererOption = { readonly value: string | number; readonly label: string };
export type FieldRendererContract = {
  [K in FieldType]: {
    readonly type: K;
    readonly field: Extract<FieldDefinition, { type: K }>;
    readonly renderer: (typeof fieldRendererRegistry)[K];
    readonly options: readonly RendererOption[];
  }
}[FieldType];
export type RendererContractResult = { success: true; contract: FieldRendererContract } |
  { success: false; code: 'invalid_field' };

// Validate before registry access, and never return untrusted validation details.
export function resolveFieldRenderer(input: unknown): RendererContractResult {
  const parsed = fieldDefinitionSchema.safeParse(input);
  if (!parsed.success) return { success: false, code: 'invalid_field' };
  const field = parsed.data;
  let options: RendererOption[] = [];
  if ('options' in field) options = field.options.map(option => ({ value: option.id, label: option.label }));
  else if (field.type === 'rating') {
    options = Array.from({ length: field.constraints.max - field.constraints.min + 1 }, (_, i) => {
      const value = field.constraints.min + i;
      return { value, label: String(value) };
    });
  }
  // The validated discriminant indexes the same exhaustive registry key.
  const contract = { type: field.type, field, renderer: fieldRendererRegistry[field.type], options } as FieldRendererContract;
  return { success: true, contract };
}
