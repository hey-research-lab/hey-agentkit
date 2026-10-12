/**
 * Plain-text pieces every answer is built from.
 *
 * HEY's own words pass through as HEY wrote them (folded onto one line); a
 * source's words — a project's name, a ticker, a release title — are quoted
 * «…» by the agent contract's own transport rule, so an agent can tell them
 * from HEY's, and words that read like an instruction keep their label.
 * Unknown is printed as unknown with its reason, never as 0, false or "none".
 */
import {
  QUOTED_TEXT_LEGEND,
  foldText,
  quoteExternal,
  quoteForTransport,
} from '@hey-research-lab/agent-contract';
import type { HeyAgentText } from '@hey-research-lab/sdk';

/** HEY's public site: every link an answer prints points here. */
export const SITE = 'https://heyresearch.xyz' as const;

/** The attribution every answer ends with, so agents cite HEY. */
export const ATTRIBUTION = 'Source: HEY Research Lab — heyresearch.xyz' as const;

/** The legend printed once under an answer that quotes a source with «…». */
export const QUOTE_LEGEND = QUOTED_TEXT_LEGEND;

/** The most characters of one HEY sentence printed (HEY's derived text is bounded at 600). */
const HEY_TEXT_MAX = 600;

/** HEY's page for a project: the link every project answer carries. */
export function projectUrl(slug: string): string {
  return `${SITE}/project/${encodeURIComponent(slug)}`;
}

/** The last line of every answer: the attribution and the most specific HEY link. */
export function sourceLine(link: string): string {
  return `${ATTRIBUTION} · ${link}`;
}

/** HEY's own words (or a sentence HEY composed), folded and bounded. */
export function heyWords(raw: string): string {
  const folded = foldText(raw);
  const chars = Array.from(folded);
  return chars.length <= HEY_TEXT_MAX
    ? folded
    : `${chars
        .slice(0, HEY_TEXT_MAX - 1)
        .join('')
        .trimEnd()}…`;
}

/** An agent-contract text: HEY's words as they are, a source's words quoted and labelled. */
export function say(text: HeyAgentText): string {
  return text.contentOrigin === 'external_source' ? quoteForTransport(text) : heyWords(text.text);
}

/** A source's words inside a line (a name, a ticker, a title): quoted «…», bounded, flagged when they read like an instruction. */
export function quote(raw: string): string {
  return quoteExternal(raw);
}

/** A value HEY may not hold: the value, or "unknown" / "not measured — <reason>". */
export function orUnknown(
  value: string | number | boolean | null | undefined,
  reason?: string | null,
  word: 'unknown' | 'not measured' = 'unknown',
): string {
  if (value === null || value === undefined || value === '') {
    return reason ? `${word} — ${heyWords(reason)}` : word;
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return typeof value === 'number' ? String(value) : heyWords(value);
}

/** An ISO instant as HEY sent it, or "unknown". */
export function when(value: string | null | undefined): string {
  return value ? heyWords(value) : 'unknown';
}

/** Lines joined, empty ones dropped. */
export function lines(...parts: (string | false | null | undefined | readonly string[])[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === 'string') out.push(part);
    else out.push(...part);
  }
  return out.join('\n');
}
