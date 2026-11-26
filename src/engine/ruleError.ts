/**
 * A change that the budget's rules do not allow (e.g. deleting an account that has transactions).
 * Everything else that goes wrong (storage, bugs) is a different kind of error; see src/i18n/errors.ts.
 * Messages stay in English; errorText translates them for display.
 */
export class RuleError extends Error {
  override name = 'RuleError';
}
