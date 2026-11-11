import { z } from 'zod';
import { formDefinitionSchema, type FieldDefinition } from './definition.js';
import { realDate } from './calendar.js';
import { withinJsonBudget } from './json-budget.js';
import { formDefinitionLimits } from './limits.js';

export const answerLimits = Object.freeze({ bytes: 128 * 1024 });
export type AnswerValue = string | number | boolean | string[];
export type CanonicalAnswers = Record<string, AnswerValue>;
export type AnswerIssueCode = 'invalid_definition' | 'invalid_answers' | 'unknown_field' |
  'layout_answer' | 'required' | 'invalid_type' | 'invalid_value' | 'out_of_range';
export type AnswerIssue = { fieldId: string | null; code: AnswerIssueCode };
export type AnswerValidationResult = { success: true; answers: CanonicalAnswers } |
  { success: false; issues: AnswerIssue[] };
const email = z.email();
type InputField = Exclude<FieldDefinition, { type: 'heading' | 'description' }>;
function validateValue(field: InputField, value: unknown): AnswerIssueCode | null {
  switch (field.type) {
    case 'shortText': case 'longText':
      if (typeof value !== 'string') return 'invalid_type';
      return value.length < field.constraints.minLength || value.length > field.constraints.maxLength ? 'out_of_range' : null;
    case 'email':
      if (typeof value !== 'string') return 'invalid_type';
      if (value.length > field.constraints.maxLength) return 'out_of_range';
      return email.safeParse(value).success ? null : 'invalid_value';
    case 'number':
      if (typeof value !== 'number') return 'invalid_type';
      return !Number.isFinite(value) || Math.abs(value) > formDefinitionLimits.numberMagnitude ||
        (field.constraints.min !== undefined && value < field.constraints.min) ||
        (field.constraints.max !== undefined && value > field.constraints.max) ? 'out_of_range' : null;
    case 'dropdown': case 'radio':
      if (typeof value !== 'string') return 'invalid_type';
      return field.options.some(option => option.id === value) ? null : 'invalid_value';
    case 'multipleChoice':
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) return 'invalid_type';
      if (new Set(value).size !== value.length || value.some(item => !field.options.some(option => option.id === item))) return 'invalid_value';
      return value.length < field.constraints.minChoices || value.length > field.constraints.maxChoices ? 'out_of_range' : null;
    case 'checkbox':
      if (typeof value !== 'boolean') return 'invalid_type';
      return field.required && !value ? 'required' : null;
    case 'date':
      if (typeof value !== 'string') return 'invalid_type';
      if (!realDate(value)) return 'invalid_value';
      return (field.constraints.min !== undefined && value < field.constraints.min) ||
        (field.constraints.max !== undefined && value > field.constraints.max) ? 'out_of_range' : null;
    case 'rating':
      if (typeof value !== 'number') return 'invalid_type';
      return !Number.isInteger(value) || value < field.constraints.min || value > field.constraints.max ? 'out_of_range' : null;
    default: {
      const unhandled: never = field;
      return unhandled;
    }
  }
}

// Pure shared validation, not an HTTP endpoint or visibility/admission decision.
// A failure returns codes and schema-owned IDs only, never raw values or labels.
export function validateAnswers(definition: unknown, input: unknown): AnswerValidationResult {
  const parsed = formDefinitionSchema.safeParse(definition);
  if (!parsed.success) return { success: false, issues: [{ fieldId: null, code: 'invalid_definition' }] };
  if (input === null || typeof input !== 'object' || Array.isArray(input) || !withinJsonBudget(input, answerLimits.bytes)) {
    return { success: false, issues: [{ fieldId: null, code: 'invalid_answers' }] };
  }
  const supplied = input as Record<string, unknown>;
  const answers: CanonicalAnswers = {};
  const issues: AnswerIssue[] = [];
  const fields = parsed.data.fields;
  const known = new Set(fields.map(field => field.id));
  if (Object.keys(supplied).some(id => !known.has(id))) issues.push({ fieldId: null, code: 'unknown_field' });
  for (const field of fields) {
    const present = Object.hasOwn(supplied, field.id);
    const value = present ? supplied[field.id] : undefined;
    if (field.type === 'heading' || field.type === 'description') {
      if (present) issues.push({ fieldId: field.id, code: 'layout_answer' });
      continue;
    }
    const empty = !present || value === null || value === '' ||
      ((field.type === 'shortText' || field.type === 'longText') && typeof value === 'string' && value.trim() === '') ||
      (field.type === 'multipleChoice' && Array.isArray(value) && value.length === 0);
    if (empty) {
      if (field.required) issues.push({ fieldId: field.id, code: 'required' });
      continue;
    }
    const code = validateValue(field, value);
    if (code) { issues.push({ fieldId: field.id, code }); continue; }
    // Choices have set semantics: stable definition order gives canonical retries.
    if (field.type === 'multipleChoice') {
      const selected = new Set(value as string[]);
      answers[field.id] = field.options.filter(option => selected.has(option.id)).map(option => option.id);
    } else answers[field.id] = typeof value === 'number' && Object.is(value, -0) ? 0 : value as AnswerValue;
  }
  return issues.length ? { success: false, issues } : { success: true, answers };
}
