/**
 * Spread on every input. None of the app's fields hold sign-in details, but password managers guess from the
 * field alone and may offer to fill a password into an amount. These attributes tell the browser and the common
 * password managers (LastPass, 1Password, Bitwarden, Dashlane) to leave the field alone.
 * Newer LastPass versions are reported to ignore their own data-lpignore but to skip fields named like a search,
 * hence the name. No field in the app is sent anywhere, so the shared name has no other effect.
 */
export const NO_AUTOFILL = {
  autoComplete: 'off',
  name: 'app-field-search',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
