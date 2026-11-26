import { useCallback, useEffect, useState } from 'react';
import { createBackup, serializeBackup } from '../../db/backup.ts';
import { formatDate, toISODate } from '../../engine/months.ts';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import {
  autoBackupSupported,
  folderPermission,
  isBackupDue,
  loadAutoBackup,
  pickFolder,
  saveFolder,
  saveLastDate,
  writeBackup,
  type FolderHandle,
} from './autoBackup.ts';

/** How often the open app checks whether a backup is due. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/** Writes today's backup into the folder and remembers it. Returns false if it could not. */
async function backUpTo(folder: FolderHandle): Promise<boolean> {
  const { state, currency, markBackedUp } = useBudgetStore.getState();
  if (state.accounts.length === 0) return false;
  const today = toISODate();
  try {
    await writeBackup(folder, serializeBackup(createBackup(state, currency)), today);
  } catch {
    return false;
  }
  await saveLastDate(today);
  await markBackedUp();
  return true;
}

/** Runs in the background while the app is open: writes a backup when one is due and the folder is still allowed. */
export function useAutoBackup(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !autoBackupSupported()) return;
    let stopped = false;
    const check = async () => {
      try {
        const { folder, lastDate } = await loadAutoBackup();
        if (stopped || !folder || !isBackupDue(lastDate, toISODate())) return;
        // Without a click the browser cannot ask again, so only write when access is still granted.
        if ((await folderPermission(folder, false)) !== 'granted') return;
        await backUpTo(folder);
      } catch {
        // Nothing to do: Settings shows the state.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [enabled]);
}

type Status = 'loading' | 'unsupported' | 'off' | 'needsAccess' | 'on';

/** Settings card: choose the folder, see when the last automatic backup ran, allow access again. */
export function AutoBackupCard() {
  const lastBackupAt = useBudgetStore((s) => s.lastBackupAt);
  const [status, setStatus] = useState<Status>('loading');
  const [folder, setFolder] = useState<FolderHandle | null>(null);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!autoBackupSupported()) return setStatus('unsupported');
    const saved = await loadAutoBackup();
    setFolder(saved.folder);
    setLastDate(saved.lastDate);
    if (!saved.folder) return setStatus('off');
    setStatus((await folderPermission(saved.folder, false)) === 'granted' ? 'on' : 'needsAccess');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, lastBackupAt]);

  const backUpNow = async (target: FolderHandle) => {
    setError(null);
    if (!(await backUpTo(target))) setError(t('autoBackup.failed'));
    await refresh();
  };

  const choose = async () => {
    setError(null);
    let picked: FolderHandle;
    try {
      picked = await pickFolder();
    } catch {
      return; // cancelled
    }
    await saveFolder(picked);
    await backUpNow(picked);
  };

  const allowAgain = async () => {
    if (folder && (await folderPermission(folder, true)) === 'granted') await backUpNow(folder);
    else await refresh();
  };

  const turnOff = async () => {
    await saveFolder(null);
    await refresh();
  };

  if (status === 'loading') return null;
  const button = 'rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50';
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{t('autoBackup.title')}</h2>
      <p className="mt-2 text-sm text-slate-600">{t('autoBackup.intro')}</p>

      {status === 'unsupported' && <p className="mt-2 text-sm text-slate-500">{t('autoBackup.unsupported')}</p>}

      {status === 'off' && (
        <button type="button" onClick={() => void choose()} className={`mt-3 ${button}`}>
          {t('autoBackup.choose')}
        </button>
      )}

      {(status === 'on' || status === 'needsAccess') && folder && (
        <>
          <p className="mt-2 text-sm">
            {t('autoBackup.folder', { name: folder.name })}
            {lastDate && <span className="text-slate-500"> · {t('autoBackup.last', { date: formatDate(lastDate) })}</span>}
          </p>
          {status === 'needsAccess' && (
            <p className="mt-2 text-sm text-amber-700" role="status">
              {t('autoBackup.needsAccess')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {status === 'needsAccess' ? (
              <button type="button" onClick={() => void allowAgain()} className={button}>
                {t('autoBackup.allow')}
              </button>
            ) : (
              <button type="button" onClick={() => void backUpNow(folder)} className={button}>
                {t('autoBackup.now')}
              </button>
            )}
            <button type="button" onClick={() => void choose()} className={button}>
              {t('autoBackup.change')}
            </button>
            <button type="button" onClick={() => void turnOff()} className={button}>
              {t('autoBackup.off')}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
