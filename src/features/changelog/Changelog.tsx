import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog.tsx';
import releasesText from '../../../RELEASES.md?raw';
import { formatDate } from '../../engine/months.ts';
import { t } from '../../i18n/i18n.ts';
import { APP_VERSION } from '../../version.ts';
import { loadSeen, minorOf, parseReleases, saveSeen, unseenReleases, type Release } from './releases.ts';

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

/** The version number, as a button that opens the release notes. Shows "New" while some notes haven't been seen. */
export function VersionButton({ className = '' }: { className?: string }) {
  const releases = useMemo(() => parseReleases(releasesText), []);
  const [open, setOpen] = useState(false);
  // On a first visit there is nothing new to point at: remember the notes as they are, quietly.
  const [seen, setSeen] = useState(() => loadSeen() ?? saveSeen(releases));
  const unseen = useMemo(() => unseenReleases(releases, seen), [releases, seen]);
  const isNew = unseen.size > 0;
  // Remembered when closing, so the tags inside stay visible while the notes are open.
  const close = useCallback(() => {
    setOpen(false);
    setSeen(saveSeen(releases));
  }, [releases]);

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
      {open && <ReleasesDialog releases={releases} unseen={unseen} onClose={close} />}
    </>
  );
}

/** The release notes over a blurred page, newest first; releases with new or changed notes are marked. */
function ReleasesDialog({ releases, unseen, onClose }: { releases: Release[]; unseen: Set<string>; onClose: () => void }) {
  const current = minorOf(APP_VERSION);
  return (
    <Dialog title={t('changelog.title')} onClose={onClose}>
      {releases.map((release) => (
        <section key={release.version} className="mb-5 last:mb-0">
          <h3 className="flex flex-wrap items-baseline gap-2 font-semibold">
            <span>{release.title ? `${release.version} – ${release.title}` : release.version}</span>
            {release.version === current && <span className="text-xs font-normal text-slate-500">{t('changelog.current')}</span>}
            {unseen.has(release.version) && <span className="rounded-full bg-sky-600 px-1.5 py-px text-[10px] font-semibold text-white">{t('changelog.new')}</span>}
            {release.date && <span className="ml-auto text-xs font-normal text-slate-500 tabular-nums">{formatDate(release.date)}</span>}
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-700">
            {release.items.map((item, i) => (
              <li key={i}>{inline(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}
