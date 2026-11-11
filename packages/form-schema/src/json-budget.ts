import { z } from 'zod';
import { formDefinitionLimits as limits } from './limits.js';

// Pure ES2022: shared by browser and server, without Buffer/TextEncoder or hooks.
function utf8Bytes(value: string) {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (bytes > limits.bytes) break;
  }
  return bytes;
}
export function withinJsonBudget(value: unknown, maxBytes: number): boolean {
  let bytes = 0, nodes = 0;
  const ancestors = new WeakSet<object>();
  const spend = (amount: number) => (bytes += amount) <= maxBytes;
  function string(value: string) {
    // Escaping/UTF-8 cannot use fewer bytes than UTF-16 code units.
    return value.length <= maxBytes - bytes && spend(utf8Bytes(JSON.stringify(value)));
  }
  function walk(value: unknown, depth: number): boolean {
    if (++nodes > limits.nodes || depth > limits.depth) return false;
    if (value === null) return spend(4);
    if (typeof value === 'string') return string(value);
    if (typeof value === 'boolean') return spend(value ? 4 : 5);
    if (typeof value === 'number') return Number.isFinite(value) && spend(String(value).length);
    if (typeof value !== 'object' || ancestors.has(value)) return false;
    const array = Array.isArray(value), prototype: unknown = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
    const length: unknown = array ? Object.getOwnPropertyDescriptor(value, 'length')?.value : 0;
    // Every supported definition array is bounded by the field/option limits.
    if (array && (typeof length !== 'number' || length > Math.max(limits.fields, limits.options))) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length > limits.nodes || (array && keys.length !== Number(length) + 1)) return false;
    if (!spend(2)) return false;
    ancestors.add(value);
    let count = 0;
    try {
      for (const key of keys) {
        if (array && key === 'length') continue;
        if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) return false;
        if (array && key !== String(count)) return false; // Dense, ordinary arrays only.
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
        if ((count++ > 0 && !spend(1)) || (!array && (!string(key) || !spend(1)))) return false;
        if (!walk(descriptor.value, depth + 1)) return false;
      }
      return true;
    } finally { ancestors.delete(value); }
  }
  try { return walk(value, 0); } catch { return false; }
}
export const boundedJson = (value: unknown): boolean => withinJsonBudget(value, limits.bytes);
export const boundedJsonSchema = z.custom<unknown>(boundedJson, 'Expected bounded plain JSON data.');
export const boundedJsonTextSchema = z.string().refine(value =>
  value.length <= limits.bytes && utf8Bytes(value) <= limits.bytes, 'JSON exceeds the byte limit.').transform((value, context): unknown => {
    try { return JSON.parse(value) as unknown; }
    catch { context.addIssue({ code: 'custom', message: 'Expected valid JSON text.' }); return z.NEVER; }
  });
