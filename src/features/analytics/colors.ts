import type { SpendingReport } from '../../engine/analytics.ts';

/** Validated categorical palette (light surface), in its fixed order. Never cycled: slice 9+ folds into "Other". */
export const SERIES_COLORS = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647'] as const;
/** The same order, tuned for the dark surface (two hues are darker so they stay within the readable lightness band). */
export const DARK_SERIES_COLORS = ['#257de0', '#f47230', '#00b894', '#c98500', '#e0679b', '#008a17', '#6a4ce2', '#ec4647'] as const;
export const OTHER_COLOR = '#94a3b8';

/**
 * Gives every named slice a fixed colour, so a category keeps its colour in all three charts.
 * The first report listed decides the order (the year-to-date report, which contains all the others' slices).
 */
export function buildColorMap(reports: SpendingReport[], dark = false): Map<string, string> {
  const palette = dark ? DARK_SERIES_COLORS : SERIES_COLORS;
  const map = new Map<string, string>();
  for (const report of reports) {
    for (const slice of report.slices) {
      if (slice.isOther || map.has(slice.id)) continue;
      map.set(slice.id, map.size < palette.length ? palette[map.size]! : OTHER_COLOR);
    }
  }
  return map;
}
