import { useEffect, useState } from 'react';
import { t } from '../../i18n/i18n.ts';
import { persistenceStatus, requestPersistence, storageUsage, type Persistence } from '../../persistence.ts';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Whether the browser keeps the data for good, with a way to ask again. */
export function StorageCard() {
  const [status, setStatus] = useState<Persistence | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    void persistenceStatus().then(setStatus);
    void storageUsage().then(setUsage);
  }, []);

  if (status === null) return null;
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">{t('storage.title')}</h2>
      <p className={`mt-2 text-sm ${status === 'granted' ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
        {t(status === 'granted' ? 'storage.granted' : status === 'denied' ? 'storage.denied' : 'storage.unsupported')}
      </p>
      {status !== 'granted' && <p className="mt-2 text-sm text-slate-600">{t('storage.advice')}</p>}
      {usage !== null && <p className="mt-2 text-xs text-slate-500">{t('storage.usage', { size: formatSize(usage) })}</p>}
      {status === 'denied' && (
        <button
          type="button"
          onClick={() => void requestPersistence().then(setStatus)}
          className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          {t('storage.askAgain')}
        </button>
      )}
    </div>
  );
}
