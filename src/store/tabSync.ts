/**
 * Keeps the app's open tabs in step. Each tab holds the budget in memory; without this, a tab would not see
 * changes made in another one, and whole-budget writes (Undo, importing a backup) could wipe them.
 *
 * After any change to the budget, a tab tells the others ("changed"); they read the budget from the database
 * again. That also ends their Undo, whose copy from before the delete is now out of date. A tab coming back
 * into view reloads too if a change was announced while it might have missed it.
 */
import type { StoreApi } from 'zustand';
import type { BudgetStore } from './budgetStore.ts';

/** The part of BroadcastChannel used here, so tests can pass a stand-in. */
export interface Channel {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

const CHANNEL = 'budget-changes';
/** When the budget last changed in any tab (ms), for tabs that were in the background. */
export const CHANGED_KEY = 'budget-changed-at';

export interface TabSyncOptions {
  channel?: Channel | null;
  /** Read and written to notice changes missed while hidden. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

function openChannel(): Channel | null {
  if (typeof BroadcastChannel !== 'function') return null;
  const channel = new BroadcastChannel(CHANNEL);
  // Node (tests) has BroadcastChannel too; there it must not keep the process running.
  (channel as unknown as { unref?: () => void }).unref?.();
  return channel as unknown as Channel;
}

export function connectTabs(store: StoreApi<BudgetStore>, options: TabSyncOptions = {}) {
  const channel = options.channel !== undefined ? options.channel : openChannel();
  const storage = options.storage !== undefined ? options.storage : typeof localStorage !== 'undefined' ? localStorage : null;
  let reloading = false;
  let seen = Number(storage?.getItem(CHANGED_KEY) ?? 0);

  const reload = async () => {
    reloading = true;
    try {
      await store.getState().load();
    } catch {
      // Shown by the store's error bar.
    } finally {
      reloading = false;
      seen = Number(storage?.getItem(CHANGED_KEY) ?? seen);
    }
  };

  store.subscribe((now, prev) => {
    if (reloading || !now.ready || !prev.ready) return;
    if (now.state === prev.state && now.currency === prev.currency && now.lastBackupAt === prev.lastBackupAt) return;
    seen = Date.now();
    try {
      storage?.setItem(CHANGED_KEY, String(seen));
    } catch {
      // Storage blocked: the message below still reaches open tabs.
    }
    channel?.postMessage('changed');
  });

  if (channel) channel.onmessage = () => void reload();

  /** For a tab coming back into view: reload if some tab changed the budget since this one last looked. */
  const catchUp = () => {
    const latest = Number(storage?.getItem(CHANGED_KEY) ?? 0);
    if (latest > seen && store.getState().ready) void reload();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') catchUp();
    });
  }
  return { catchUp };
}
