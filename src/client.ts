/**
 * The one HEY client a provider reads through: the published SDK, pointed at
 * heyresearch.xyz, naming this integration. No key is embedded; one is sent
 * only when the host supplies it.
 */
import { DEFAULT_BASE_URL, HeyClient, type FetchLike } from '@hey-research-lab/sdk';

import { INTEGRATION } from './version.js';

export type HeyResearchConfig = {
  /**
   * An API key from heyresearch.xyz/account. Optional: every action works
   * without one; a key lifts the anonymous rate limit and nothing else.
   * Defaults to the `HEY_API_KEY` environment variable.
   */
  apiKey?: string;
  /**
   * HEY's origin. Defaults to `https://heyresearch.xyz`; set it only to point
   * at a local HEY or a test mock (`https:` or `http://localhost`). It is not
   * a network switch: HEY is Robinhood Chain only.
   */
  baseUrl?: string;
  /** The `fetch` to use; the global one by default. Tests pass their own. */
  fetchImpl?: FetchLike;
  /** Milliseconds before a request is abandoned; the SDK's 15 000 by default. */
  timeoutMs?: number;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** An origin HEY may be read from: `https:`, or plain `http:` on this machine only. No credentials, path or query. */
export function checkBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('baseUrl must be an absolute URL such as https://heyresearch.xyz.');
  }
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    throw new Error('baseUrl must use https: (plain http: is allowed for localhost only).');
  }
  if (url.username || url.password) throw new Error('baseUrl must not carry credentials.');
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error('baseUrl must be an origin only, with no path, query or fragment.');
  }
  return url.origin;
}

function envKey(): string | undefined {
  const value = typeof process !== 'undefined' ? process.env?.HEY_API_KEY : undefined;
  return value && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * The client for one provider. A key passed in `config` goes to the origin
 * passed beside it; a key from the environment goes to heyresearch.xyz only,
 * so pointing at a mock never sends the host's real key there.
 */
export function createClient(config: HeyResearchConfig = {}): HeyClient {
  const baseUrl = config.baseUrl ? checkBaseUrl(config.baseUrl) : DEFAULT_BASE_URL;
  const apiKey =
    config.apiKey && config.apiKey.trim() !== ''
      ? config.apiKey.trim()
      : baseUrl === DEFAULT_BASE_URL
        ? envKey()
        : undefined;
  return new HeyClient({
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
    ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    ...(config.timeoutMs ? { timeoutMs: config.timeoutMs } : {}),
    userAgent: INTEGRATION,
    integration: INTEGRATION,
  });
}
