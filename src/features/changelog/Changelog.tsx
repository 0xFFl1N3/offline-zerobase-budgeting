import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog.tsx';
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
  return (
    <Dialog title={t('changelog.title')} onClose={onClose}>
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
    </Dialog>
  );
}
