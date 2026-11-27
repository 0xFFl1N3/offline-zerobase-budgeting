/**
 * Spread on every input. None of the app's fields hold sign-in details, but password managers guess from the
 * field alone and may offer to fill a password into an amount. These attributes tell the browser and the common
 * password managers (LastPass, 1Password, Bitwarden, Dashlane) to leave the field alone.
 */
export const NO_AUTOFILL = {
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
