/**
 * Asks the browser to keep this site's data permanently. Without it, browsers may clear IndexedDB when disk space
 * runs low, and Safari clears it after seven days without a visit unless the app is installed on the home screen.
 */
export type Persistence = 'granted' | 'denied' | 'unsupported';

/** The parts of navigator.storage used here, so tests can pass a stand-in. */
export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number }>;
}

const storage = (): StorageManagerLike | undefined => (typeof navigator !== 'undefined' ? navigator.storage : undefined);

/** Current status, without asking. */
export async function persistenceStatus(manager = storage()): Promise<Persistence> {
  if (!manager?.persisted) return 'unsupported';
  return (await manager.persisted()) ? 'granted' : 'denied';
}

/** Asks for persistent storage if it is not granted yet. Chrome and Edge decide silently; Firefox asks the person once. */
export async function requestPersistence(manager = storage()): Promise<Persistence> {
  if (!manager?.persisted || !manager.persist) return 'unsupported';
  if (await manager.persisted()) return 'granted';
  try {
    return (await manager.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Bytes this site stores, if the browser says. */
export async function storageUsage(manager = storage()): Promise<number | null> {
  try {
    return (await manager?.estimate?.())?.usage ?? null;
  } catch {
    return null;
  }
}
