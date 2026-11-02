/**
 * Reading a research_project answer back in code.
 *
 * The actions return text, because a model reads it. Code that must decide something before a
 * model does (a host's own check before a trade, a bridge or a payment) should not ask the model
 * to read the status for it: text from a tool can be steered. `readResearchAnswer` reads the few
 * fields such a check needs straight from the answer this package rendered, and the tests hold it
 * to the renderer, so a change in one fails the other.
 */
import { ATTRIBUTION } from './text.js';

/** HEY's activity statuses, verbatim. A value HEY adds later reads as itself, never as one of these. */
export const ACTIVITY_STATUSES = [
  'SHIPPING',
  'ACTIVE',
  'RESUMED',
  'QUIET',
  'DORMANT',
  'UNKNOWN',
] as const;

export type ResearchAnswerRead =
  | {
      ok: true;
      /** The project's HEY slug, or `null` when the answer named none. */
      slug: string | null;
      /** HEY's activity status, verbatim, or `null` when the answer carried none (HEY sent no research data). */
      activityStatus: string | null;
      /** The last meaningful ship (ISO time), or `null` when HEY's record holds none. */
      lastMeaningfulShipAt: string | null;
      /** The heyresearch.xyz page the answer cites. */
      link: string | null;
    }
  | {
      ok: false;
      /** HEY's code (`not_found`, `ambiguous`, `rate_limited`, …) or this package's (`invalid_address`, …). */
      code: string;
      /** The answer's first line, as rendered. */
      message: string;
      /** The candidates' slugs when HEY found several projects and picked none. */
      candidates: string[];
      link: string | null;
    };

const HEADER = /^HEY research: .* — ([a-z0-9][a-z0-9-]*) on Robinhood Chain \(4663\)$/;
const HEADER_NO_DATA = /^HEY research on Robinhood Chain \(4663\)$/;
const PROJECT_LINK = /^https:\/\/heyresearch\.xyz\/project\/([a-z0-9][a-z0-9-]*)$/;
const ERROR = /^Error \(([^,)]+)[^)]*\)/;
const STATUS = /^- Activity status: ([A-Z_]+) /;
const LAST_SHIP = /^- Last meaningful ship: (\d{4}-\d{2}-\d{2}T[0-9:.]+Z)$/;
const CANDIDATE = /^- .* · slug ([a-z0-9][a-z0-9-]*)/;

/** The fields a host's own check needs, read from a research_project answer. */
export function readResearchAnswer(text: string): ResearchAnswerRead {
  const rows = text.split('\n');
  const last = rows.at(-1) ?? '';
  const link = last.startsWith(`${ATTRIBUTION} · `)
    ? last.slice(ATTRIBUTION.length + 3).trim() || null
    : null;
  const first = rows[0] ?? '';

  const error = ERROR.exec(first);
  if (error) {
    const candidates = rows
      .slice(1)
      .map((row) => CANDIDATE.exec(row)?.[1])
      .filter((slug): slug is string => slug !== undefined);
    return { ok: false, code: error[1]!.trim(), message: first, candidates, link };
  }

  const header = HEADER.exec(first);
  const noData = HEADER_NO_DATA.test(first);
  if (!header && !noData) {
    return {
      ok: false,
      code: 'unreadable_answer',
      message: 'This is not a research_project answer from this package.',
      candidates: [],
      link,
    };
  }
  let activityStatus: string | null = null;
  let lastMeaningfulShipAt: string | null = null;
  for (const row of rows) {
    activityStatus ??= STATUS.exec(row)?.[1] ?? null;
    lastMeaningfulShipAt ??= LAST_SHIP.exec(row)?.[1] ?? null;
  }
  const slug = header?.[1] ?? (link ? (PROJECT_LINK.exec(link)?.[1] ?? null) : null);
  return { ok: true, slug, activityStatus, lastMeaningfulShipAt, link };
}
