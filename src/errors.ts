/**
 * Failures, as one clear sentence an agent can act on.
 *
 * An AgentKit action answers with text, so a failure is returned as text too —
 * `Error (<code>): <what happened>` — rather than thrown into the agent loop.
 * HEY's own error code, its sentence, the retry delay and the request id are
 * passed through unchanged; nothing is retried on the caller's behalf.
 */
import { HeyApiError } from '@hey-research-lab/sdk';

import { UnsupportedChainError } from './chain.js';
import { heyWords } from './text.js';

/** An input this package refuses before any request is made. */
export class InputError extends Error {
  constructor(
    readonly code: 'invalid_project_slug' | 'invalid_address' | 'invalid_query',
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const HINTS: Partial<Record<string, string>> = {
  rate_limited:
    'HEY limits anonymous reads; wait, or set HEY_API_KEY (a key from heyresearch.xyz/account lifts the anonymous limit).',
  quota: "The API key's allowance is used; wait for it to reset.",
  unauthorized:
    'The API key was refused; check HEY_API_KEY, or leave it unset to read anonymously.',
  forbidden: 'HEY refused this read for this key.',
  not_found:
    'HEY has no published record for this; try find_projects with a name, ticker or contract address.',
  network: 'HEY could not be reached.',
  timeout: 'HEY did not answer in time.',
  unavailable: 'HEY is temporarily unavailable; see https://heyresearch.xyz/status.',
};

/** The message for any failure while reading HEY. */
export function describeError(error: unknown): string {
  if (error instanceof UnsupportedChainError) {
    return `Error (${error.code}): ${error.message}`;
  }
  if (error instanceof InputError) {
    return `Error (${error.code}): ${error.message}`;
  }
  if (error instanceof HeyApiError) {
    const body = isRecord(error.body) ? error.body : {};
    const apiCode = typeof body.error === 'string' ? body.error : undefined;
    const code = apiCode ?? error.code;
    const parts = [
      `Error (${heyWords(code)}${error.status ? `, HTTP ${error.status}` : ''}): HEY's API answered: ${heyWords(error.message)}`,
    ];
    if (error.retryAfterSeconds !== undefined)
      parts.push(`Retry after ${error.retryAfterSeconds} s.`);
    const requestId = typeof body.requestId === 'string' ? body.requestId : undefined;
    if (requestId) parts.push(`Request id: ${heyWords(requestId)}.`);
    const hint = HINTS[error.code];
    if (hint) parts.push(hint);
    return parts.join(' ');
  }
  const message = error instanceof Error ? error.message : String(error);
  return `Error (request_failed): reading HEY failed: ${heyWords(message)}`;
}
