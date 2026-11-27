/**
 * The release notes users see (RELEASES.md, bundled as text): one section per minor version, kept up to date
 * while that version is live. CHANGELOG.md is the full technical record and is not shown in the app.
 */

export interface Release {
  /** Minor version, e.g. '0.10'. */
  version: string;
  title: string;
  /** 'YYYY-MM-DD' of the last update, or ''. */
  date: string;
  items: string[];
}

/** Reads "## 0.10 – Title", an optional date line, and "- item" lines (an indented line continues an item). */
export function parseReleases(text: string): Release[] {
  const releases: Release[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^## +(\d+\.\d+)(?: +[–-] +(.+))?$/.exec(line);
    if (heading) {
      releases.push({ version: heading[1]!, title: heading[2]?.trim() ?? '', date: '', items: [] });
      continue;
    }
    const release = releases.at(-1);
    if (!release) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(line) && release.items.length === 0) release.date = line;
    else if (/^[-*] +/.test(line)) release.items.push(line.replace(/^[-*] +/, '').trim());
    else if (/^ {2,}\S/.test(raw) && release.items.length > 0) release.items[release.items.length - 1] += ` ${raw.trim()}`;
  }
  return releases;
}

/** The release a full version belongs to: '0.10.8' → '0.10'. */
export const minorOf = (version: string) => version.split('.').slice(0, 2).join('.');

/** A short fingerprint of a release's text, to notice when its notes change. */
export function fingerprint(release: Release): string {
  const text = [release.title, ...release.items].join('\n');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/** Releases whose notes are new or changed since they were last looked at. */
export function unseenReleases(releases: Release[], seen: Record<string, string>): Set<string> {
  return new Set(releases.filter((r) => seen[r.version] !== fingerprint(r)).map((r) => r.version));
}

export const SEEN_KEY = 'budget-seen-notes';

/** What was last seen (release → fingerprint), or null on a first visit. Stored on the device. */
export function loadSeen(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function saveSeen(releases: Release[]): Record<string, string> {
  const seen = Object.fromEntries(releases.map((r) => [r.version, fingerprint(r)]));
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Private mode or storage blocked: the tag just shows again next time.
  }
  return seen;
}
