import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WalletProvider, type Action, type Network } from '@coinbase/agentkit';
import type { FetchLike } from '@hey-research-lab/sdk';

import { heyResearchActionProvider, type HeyResearchConfig } from '../src/index.js';

export type Fixture = {
  request: { path: string; params: Record<string, string | number> };
  response: { status: number; headers: Record<string, string>; body: unknown };
};

const FIXTURES = join(import.meta.dirname, 'fixtures');

/** `live/<name>` was recorded once from HEY's public API; `synthetic/<name>` is hand-written. */
export function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8')) as Fixture;
}

export type Call = { url: URL; init: RequestInit | undefined };

function respond(fixture: Fixture): Response {
  const body =
    typeof fixture.response.body === 'string'
      ? fixture.response.body
      : JSON.stringify(fixture.response.body);
  return new Response(body, { status: fixture.response.status, headers: fixture.response.headers });
}

/**
 * A fetch that answers from saved fixtures and fails the test on any other request: the path and
 * every query parameter must match what one of the fixtures recorded.
 */
export function fixtureFetch(names: string | string[], calls: Call[] = []): FetchLike {
  const fixtures = (Array.isArray(names) ? names : [names]).map(loadFixture);
  return async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    const actual = new URL(url);
    actual.searchParams.sort();
    for (const fixture of fixtures) {
      const expected = new URL(fixture.request.path, url.origin);
      for (const [k, v] of Object.entries(fixture.request.params)) {
        expected.searchParams.set(k, String(v));
      }
      expected.searchParams.sort();
      if (actual.pathname === expected.pathname && actual.search === expected.search) {
        return respond(fixture);
      }
    }
    throw new Error(`Unexpected request ${url.pathname}${url.search}; no fixture recorded it`);
  };
}

/** A fetch that gives one fixture's answer to whatever is asked (for refusals and failures). */
export function answerAnything(name: string, calls: Call[] = []): FetchLike {
  const fixture = loadFixture(name);
  return async (input, init) => {
    calls.push({ url: new URL(input), init });
    return respond(fixture);
  };
}

/** A wallet whose every money-moving or signing method fails the test if it is ever called. */
export class TripwireWallet extends WalletProvider {
  readonly touched: string[] = [];

  constructor(
    private readonly network: Network = {
      protocolFamily: 'evm',
      networkId: 'base-mainnet',
      chainId: '8453',
    },
  ) {
    super();
  }
  getAddress(): string {
    return '0x0000000000000000000000000000000000000001';
  }
  getNetwork(): Network {
    return this.network;
  }
  getName(): string {
    return 'tripwire_wallet';
  }
  async getBalance(): Promise<bigint> {
    this.touched.push('getBalance');
    throw new Error('getBalance must never be called by a HEY action');
  }
  async nativeTransfer(): Promise<string> {
    this.touched.push('nativeTransfer');
    throw new Error('nativeTransfer must never be called by a HEY action');
  }
}

/** The provider's actions keyed by their short name (`research_project`), as AgentKit binds them. */
export function actions(
  config: HeyResearchConfig,
  wallet: WalletProvider = new TripwireWallet(),
): Record<string, Action> {
  const out: Record<string, Action> = {};
  for (const action of heyResearchActionProvider(config).getActions(wallet)) {
    out[action.name.replace(/^HeyResearchActionProvider_/, '')] = action;
  }
  return out;
}

/** Invoke one action over fixtures; returns its text and the requests it made. */
export async function invoke(
  name: string,
  args: Record<string, unknown>,
  fetchImpl: FetchLike,
  config: Omit<HeyResearchConfig, 'fetchImpl'> = {},
): Promise<string> {
  const action = actions({ ...config, fetchImpl })[name];
  if (!action) throw new Error(`no action ${name}`);
  return action.invoke(action.schema.parse(args));
}

/** Words HEY's plugins never write in their own voice (ecosystem conventions, forbidden output words). */
export const FORBIDDEN =
  /\b(rug|rugs|rugged|scam|scams|safe|unsafe|bullish|bearish|buy|buying|sell|selling|100x|alpha|undervalued|guaranteed|smart money|whale|whales|dev wallet|users|partnership|audited|official Robinhood)\b/i;

/** The plugin's own words: everything but a source's words quoted «…». */
export function ownWords(text: string): string {
  return text.replace(/«[^»]*»/g, '«»');
}
