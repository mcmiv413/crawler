export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

interface ContentRegistry<K extends string = string> {
  has(value: K): boolean;
}

interface ContentRefMessages<K extends string> {
  readonly invalidType?: (value: unknown, label: string) => string;
  readonly missing?: (value: K, label: string) => string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 1;
}

export function isPosition(value: unknown): value is { readonly x: number; readonly y: number } {
  return isRecord(value) && isFiniteNumber(value['x']) && isFiniteNumber(value['y']);
}

export function validateNumberInRange<TError extends ValidationIssue>(
  field: string,
  value: unknown,
  min: number,
  max: number,
  message: (field: string, value: unknown, min: number, max: number) => string,
): TError[] {
  return isFiniteNumber(value) && value >= min && value <= max
    ? []
    : [{ field, message: message(field, value, min, max) } as TError];
}

export function validateContentRef<K extends string, TError extends ValidationIssue>(
  field: string,
  value: unknown,
  registry: ContentRegistry<K>,
  label: string,
  messages: ContentRefMessages<K> | ((value: unknown, label: string) => string),
): TError[] {
  if (typeof messages === 'function') {
    return typeof value === 'string' && registry.has(value as K)
      ? []
      : [{ field, message: messages(value, label) } as TError];
  }

  if (typeof value !== 'string') {
    return [{
      field,
      message: messages.invalidType?.(value, label) ?? `${field} must be a string reference in ${label}`,
    } as TError];
  }

  return registry.has(value as K)
    ? []
    : [{
        field,
        message: messages.missing?.(value as K, label) ?? `${field} must exist in ${label}`,
      } as TError];
}
