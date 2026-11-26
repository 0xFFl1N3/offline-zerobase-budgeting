import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import changelogText from '../../../CHANGELOG.md?raw';
import { t } from '../../i18n/i18n.ts';
import { APP_VERSION } from '../../version.ts';
import { compareVersions, markSeen, parseChangelog, seenVersion } from './changelog.ts';

/** `code` spans become <code>, the rest stays text. */
function inline(text: string): ReactNode {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? (
      <code key={i} className="rounded bg-slate-100 px-1 text-[0.85em]">{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** The version number, as a button that opens the changelog. Shows a dot until the changelog of a new version is opened. */
export function VersionButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // On a first visit there is nothing new to point at: remember the current version quietly.
  const [lastSeen, setLastSeen] = useState(() => {
    const seen = seenVersion();
    if (seen === null) markSeen(APP_VERSION);
    return seen ?? APP_VERSION;
  });
  const isNew = compareVersions(APP_VERSION, lastSeen) > 0;

  const close = () => {
    setOpen(false);
    markSeen(APP_VERSION);
    setLastSeen(APP_VERSION);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('changelog.open')}
        aria-label={`${t('app.version', { version: APP_VERSION })}. ${t('changelog.open')}${isNew ? ` (${t('changelog.new')})` : ''}`}
        className={`inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:underline ${className}`}
      >
        v{APP_VERSION}
        {isNew && (
          <span className="rounded-full bg-sky-600 px-1.5 py-px text-[10px] font-semibold text-white no-underline">{t('changelog.new')}</span>
        )}
      </button>
      {open && <ChangelogDialog since={lastSeen} onClose={close} />}
    </>
  );
}

/** The changelog over a blurred page. Versions newer than `since` are marked as new. */
function ChangelogDialog({ since, onClose }: { since: string; onClose: () => void }) {
  const entries = useMemo(() => parseChangelog(changelogText), []);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    // Caught first and stopped, so Esc closes only this and not the accounts drawer it may have been opened from.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
      <button type="button" aria-label={t('changelog.close')} onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/30 backdrop-blur-sm" />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="changelog-title" className="text-base font-semibold">{t('changelog.title')}</h2>
          <button ref={closeButton} type="button" onClick={onClose} aria-label={t('changelog.close')} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm">
          {entries.map((entry) => {
            const isNew = compareVersions(entry.version, since) > 0;
            return (
              <section key={entry.version} className="mb-5 last:mb-0">
                <h3 className="flex flex-wrap items-baseline gap-2 font-semibold">
                  {entry.version}
                  {entry.version === APP_VERSION && <span className="text-xs font-normal text-slate-500">{t('changelog.current')}</span>}
                  {isNew && <span className="rounded-full bg-sky-600 px-1.5 py-px text-[10px] font-semibold text-white">{t('changelog.new')}</span>}
                  {entry.date && <span className="ml-auto text-xs font-normal text-slate-500 tabular-nums">{entry.date}</span>}
                </h3>
                {entry.sections.map((section, i) => (
                  <div key={i} className="mt-1.5">
                    {section.title && <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">{section.title}</h4>}
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                      {section.items.map((item, j) => (
                        <li key={j}>{inline(item)}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
