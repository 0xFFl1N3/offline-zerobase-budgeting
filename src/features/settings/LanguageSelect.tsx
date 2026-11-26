import { useState } from 'react';
import { LANGUAGES, loadLanguagePreference, setLanguagePreference, useT, type LanguagePreference } from '../../i18n/i18n.ts';

/** Language choice, used on the setup screen and in Settings. It applies at once. */
export function LanguageSelect({ className = '' }: { className?: string }) {
  const t = useT();
  const [choice, setChoice] = useState<LanguagePreference>(loadLanguagePreference);
  return (
    <select
      aria-label={t('settings.language')}
      value={choice}
      onChange={(e) => {
        const next = e.target.value as LanguagePreference;
        setChoice(next);
        setLanguagePreference(next);
      }}
      className={className}
    >
      <option value="system">{t('language.system')}</option>
      {LANGUAGES.map((l) => (
        // Each language is named in itself, so it can be found whatever is showing.
        <option key={l.id} value={l.id} lang={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
