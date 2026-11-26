/** Reading CHANGELOG.md (bundled into the app as text) and remembering which version was last seen. */

export interface ChangelogSection {
  /** "Added", "Changed", "Fixed", … */
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

/** Parses the changelog's "## version – date", "### Section" and "- item" lines. Anything else is skipped. */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const version = /^## +(\S+)(?: +[–-] +(.+))?$/.exec(line);
    if (version) {
      entries.push({ version: version[1]!, date: version[2]?.trim() ?? '', sections: [] });
      continue;
    }
    const entry = entries.at(-1);
    if (!entry) continue;
    const section = /^### +(.+)$/.exec(line);
    if (section) {
      entry.sections.push({ title: section[1]!.trim(), items: [] });
      continue;
    }
    const item = /^[-*] +(.+)$/.exec(line);
    if (item) {
      if (entry.sections.length === 0) entry.sections.push({ title: '', items: [] });
      entry.sections.at(-1)!.items.push(item[1]!.trim());
    } else if (/^ {2,}\S/.test(raw) && entry.sections.at(-1)?.items.length) {
      // A wrapped item continues on an indented line.
      const items = entry.sections.at(-1)!.items;
      items[items.length - 1] += ` ${raw.trim()}`;
    }
  }
  return entries;
}

/** Compares '0.10.2' and '0.9.7' by number: negative when a is older. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const SEEN_KEY = 'budget-seen-version';

/** The version whose changelog was last opened, or null on a first visit. Stored on the device. */
export function seenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markSeen(version: string) {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {
    // Private mode or storage blocked: the hint just shows again next time.
  }
}
