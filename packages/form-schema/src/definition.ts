import { z } from 'zod';
import { draftTitleSchema } from './initial-draft.js';
import { boundedJson, boundedJsonSchema, boundedJsonTextSchema } from './json-budget.js';
import { formDefinitionLimits as limits } from './limits.js';

export const fieldTypes = Object.freeze(['shortText', 'longText', 'email', 'number', 'dropdown', 'radio',
  'multipleChoice', 'checkbox', 'date', 'rating', 'heading', 'description'] as const);
export const fieldTypeSchema = z.enum(fieldTypes);
export const definitionIdSchema = z.uuid({ version: 'v4' }).toLowerCase();
const label = (max: number) => z.string().max(max).refine(value => value.trim().length > 0, 'Text must not be blank.');
const option = z.strictObject({ id: definitionIdSchema, label: label(limits.label) });
const options = z.array(option).min(1).max(limits.options);
const empty = z.strictObject({});
const common = { id: definitionIdSchema, label: label(limits.label), helpText: z.string().max(limits.helpText), stepId: z.null() };
const input = { ...common, required: z.boolean() };
function textConstraints(max: number) {
  return z.strictObject({ minLength: z.int().min(0).max(max).default(0), maxLength: z.int().min(1).max(max).default(max) })
    .refine(value => value.minLength <= value.maxLength, 'Minimum length exceeds maximum length.');
}
const magnitude = z.number().min(-limits.numberMagnitude).max(limits.numberMagnitude);
const numberConstraints = z.strictObject({ min: magnitude.optional(), max: magnitude.optional() })
  .refine(value => value.min === undefined || value.max === undefined || value.min <= value.max, 'Minimum exceeds maximum.');
function realDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}
const date = z.string().refine(realDate, 'Expected a real YYYY-MM-DD calendar date.');
const dateConstraints = z.strictObject({ min: date.optional(), max: date.optional() })
  .refine(value => value.min === undefined || value.max === undefined || value.min <= value.max, 'Minimum date exceeds maximum date.');
const fieldShape = z.discriminatedUnion('type', [
  z.strictObject({ ...input, type: z.literal('shortText'), constraints: textConstraints(2000) }),
  z.strictObject({ ...input, type: z.literal('longText'), constraints: textConstraints(10000) }),
  z.strictObject({ ...input, type: z.literal('email'), constraints: z.strictObject({ maxLength: z.int().min(1).max(254).default(254) }) }),
  z.strictObject({ ...input, type: z.literal('number'), constraints: numberConstraints }),
  z.strictObject({ ...input, type: z.literal('dropdown'), options, constraints: empty }),
  z.strictObject({ ...input, type: z.literal('radio'), options, constraints: empty }),
  z.strictObject({ ...input, type: z.literal('multipleChoice'), options, constraints: z.strictObject({
    minChoices: z.int().min(0).max(limits.options).default(0), maxChoices: z.int().min(1).max(limits.options),
  }) }),
  z.strictObject({ ...input, type: z.literal('checkbox'), constraints: empty }),
  z.strictObject({ ...input, type: z.literal('date'), constraints: dateConstraints }),
  z.strictObject({ ...input, type: z.literal('rating'), constraints: z.strictObject({
    min: z.int().min(1).max(10).default(1), max: z.int().min(1).max(10).default(5),
  }).refine(value => value.min < value.max, 'Rating requires at least two ordered levels.') }),
  z.strictObject({ ...common, type: z.literal('heading'), required: z.literal(false), constraints: empty }),
  z.strictObject({ ...common, label: label(limits.description), type: z.literal('description'), required: z.literal(false), constraints: empty }),
]).superRefine((field, context) => {
  const ids = new Set([field.id]);
  if ('options' in field) field.options.forEach((option, index) => {
    if (ids.has(option.id)) context.addIssue({ code: 'custom', path: ['options', index, 'id'], message: 'Definition IDs must be unique.' });
    ids.add(option.id);
  });
  if (field.type === 'multipleChoice') {
    if (field.constraints.minChoices > field.constraints.maxChoices || field.constraints.maxChoices > field.options.length) {
      context.addIssue({ code: 'custom', path: ['constraints'], message: 'Choice bounds must be ordered and fit the options.' });
    }
  }
});
export const fieldDefinitionSchema = boundedJsonSchema.pipe(fieldShape).refine(boundedJson, 'Canonical field exceeds the JSON budget.');
const formShape = z.strictObject({
  schemaFormatVersion: z.literal(1), title: draftTitleSchema,
  description: z.string().max(limits.description), fields: z.array(fieldShape).max(limits.fields),
  steps: z.tuple([]), visibilityRules: z.tuple([]), theme: z.strictObject({ preset: z.literal('neutral') }),
}).superRefine((form, context) => {
  const seen = new Set<string>();
  form.fields.forEach((field, index) => {
    const ids = [field.id, ...('options' in field ? field.options.map(option => option.id) : [])];
    for (const id of new Set(ids)) {
      if (seen.has(id)) context.addIssue({ code: 'custom', path: ['fields', index, 'id'], message: 'Definition IDs must be unique across the form.' });
      seen.add(id);
    }
  });
});
export const formDefinitionSchema = boundedJsonSchema.pipe(formShape).refine(boundedJson, 'Canonical form exceeds the JSON budget.');
export const formDefinitionJsonSchema = boundedJsonTextSchema.pipe(formDefinitionSchema);
export type FieldDefinition = z.output<typeof fieldDefinitionSchema>;
export type FormDefinition = z.output<typeof formDefinitionSchema>;
