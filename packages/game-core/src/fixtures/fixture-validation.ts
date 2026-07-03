import type { ValidationIssue } from '../state/validation-guards.js';

export type FixtureValidationIssue = ValidationIssue;

export interface FixtureValidationResultFor<TError extends FixtureValidationIssue> {
  readonly isValid: boolean;
  readonly errors: readonly TError[];
}

export function formatValidationErrors(errors: readonly FixtureValidationIssue[]): string {
  return errors.map(e => `  [${e.field}] ${e.message}`).join('\n');
}

export class BaseFixtureLoadError<TError extends FixtureValidationIssue> extends Error {
  readonly validationErrors: readonly TError[];

  constructor(name: string, message: string, validationErrors: readonly TError[]) {
    super(message);
    this.name = name;
    this.validationErrors = validationErrors;
  }
}
