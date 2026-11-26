/**
 * Automatic backups to a folder the person picks once (Chrome and Edge on computers, through the
 * File System Access API). The folder handle and the date of the last automatic backup are kept in a small
 * database of their own: they belong to this device, not to the budget, so they are not in backups.
 */

/** The parts of the File System Access API used here (not all TypeScript versions include them). */
export interface FolderHandle {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;
  removeEntry(name: string): Promise<void>;
  values(): AsyncIterable<{ kind: string; name: string }>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
}

type PickerWindow = { showDirectoryPicker?: (options?: { id?: string; mode?: 'readwrite' }) => Promise<FolderHandle> };

/** How many automatic backup files to keep in the folder; older ones are removed. */
export const KEEP_BACKUPS = 10;
/** Days between automatic backups. */
export const BACKUP_EVERY_DAYS = 1;

const FILE = /^budget-backup-(\d{4}-\d{2}-\d{2})\.json$/;
export const backupFileName = (date: string) => `budget-backup-${date}.json`;

export const autoBackupSupported = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';

/** True when the last automatic backup is at least `days` old (or there was none). Dates are 'YYYY-MM-DD'. */
export function isBackupDue(lastDate: string | null, today: string, days = BACKUP_EVERY_DAYS): boolean {
  if (!lastDate) return true;
  return (Date.parse(today) - Date.parse(lastDate)) / 86_400_000 >= days;
}

/** Backup files beyond the newest `keep`, oldest first. Other files in the folder are never touched. */
export function backupsToRemove(names: string[], keep = KEEP_BACKUPS): string[] {
  const backups = names.filter((n) => FILE.test(n)).sort();
  return backups.slice(0, Math.max(0, backups.length - keep));
}

/** Writes today's backup (replacing one written earlier today) and removes old ones. */
export async function writeBackup(folder: FolderHandle, json: string, date: string): Promise<void> {
  const file = await folder.getFileHandle(backupFileName(date), { create: true });
  const writable = await file.createWritable();
  await writable.write(json);
  await writable.close();
  const names: string[] = [];
  for await (const entry of folder.values()) if (entry.kind === 'file') names.push(entry.name);
  for (const name of backupsToRemove(names)) await folder.removeEntry(name);
}

/** 'granted', or 'prompt' when the browser wants the person to allow access again (it asks on a click only). */
export async function folderPermission(folder: FolderHandle, ask: boolean): Promise<PermissionState> {
  const options = { mode: 'readwrite' as const };
  if (!folder.queryPermission) return 'granted';
  const state = await folder.queryPermission(options);
  if (state === 'granted' || !ask || !folder.requestPermission) return state;
  return folder.requestPermission(options);
}

export async function pickFolder(): Promise<FolderHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('Folder access is not supported.');
  return picker({ id: 'budget-backups', mode: 'readwrite' });
}

// --- the device's own small database ---------------------------------------------------------------

const DB = 'budget-device';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function kv<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export interface AutoBackupSettings {
  folder: FolderHandle | null;
  /** 'YYYY-MM-DD' of the last automatic backup. */
  lastDate: string | null;
}

export async function loadAutoBackup(): Promise<AutoBackupSettings> {
  if (typeof indexedDB === 'undefined') return { folder: null, lastDate: null };
  const folder = ((await kv('readonly', (s) => s.get('backupFolder'))) as FolderHandle | undefined) ?? null;
  const lastDate = ((await kv('readonly', (s) => s.get('lastAutoBackup'))) as string | undefined) ?? null;
  return { folder, lastDate };
}

export async function saveFolder(folder: FolderHandle | null) {
  if (folder) await kv('readwrite', (s) => s.put(folder, 'backupFolder'));
  else await kv('readwrite', (s) => s.delete('backupFolder'));
  if (!folder) await kv('readwrite', (s) => s.delete('lastAutoBackup'));
}

export const saveLastDate = (date: string) => kv('readwrite', (s) => s.put(date, 'lastAutoBackup'));
