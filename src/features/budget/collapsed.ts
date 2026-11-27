import { useState } from 'react';

const KEY = 'budget-collapsed-groups';

/** Reads the stored group ids; anything unreadable counts as none collapsed. */
export function parseCollapsed(raw: string | null): Set<string> {
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

const read = () => {
  try {
    return parseCollapsed(localStorage.getItem(KEY));
  } catch {
    return new Set<string>();
  }
};

/** Which budget groups are folded away to their heading. A display choice, remembered on this device only. */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = (groupId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(groupId)) next.add(groupId);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        // Storage blocked: the groups just open again next time.
      }
      return next;
    });
  return { isCollapsed: (groupId: string) => collapsed.has(groupId), toggle };
}
