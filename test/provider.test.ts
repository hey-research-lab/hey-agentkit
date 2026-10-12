import { readFileSync } from 'node:fs';

import { ACTION_DECORATOR_KEY, AgentKit, type ActionMetadata } from '@coinbase/agentkit';
import { getLangChainTools } from '@coinbase/agentkit-langchain';
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACTION_DESCRIPTIONS,
  HeyResearchActionProvider,
  VERSION,
  heyResearchActionProvider,
} from '../src/index.js';
import { TripwireWallet, actions, fixtureFetch, invoke, type Call } from './helpers.js';

const NAMES = [
  'research_project',
  'find_projects',
  'lookup_token',
  'what_changed',
  'project_timeline',
  'chain_overview',
];

const EVERY_ACTION: [string, Record<string, unknown>, string][] = [
  ['research_project', { project: 'musepass-musepass' }, 'live/research'],
  ['find_projects', { query: 'musepass' }, 'live/search'],
  ['lookup_token', { address: '0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7' }, 'live/token'],
  ['what_changed', { days: 7, limit: 3 }, 'synthetic/what-changed'],
  ['project_timeline', { project: 'musepass-musepass' }, 'synthetic/timeline'],
  ['chain_overview', { days: 3 }, 'live/pulse'],
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the AgentKit action provider', () => {
  it('registers six actions through @CreateAction, prefixed with the class name', () => {
    const provider = heyResearchActionProvider();
    expect(provider).toBeInstanceOf(HeyResearchActionProvider);
    expect(provider.name).toBe('hey_research');
    const registered = provider.getActions(new TripwireWallet()).map((a) => a.name);
    expect(registered).toEqual(NAMES.map((n) => `HeyResearchActionProvider_${n}`));
  });

  it('describes every action concretely: Robinhood Chain, evidence, and what it is not', () => {
    for (const name of NAMES) {
      const description = ACTION_DESCRIPTIONS[name as keyof typeof ACTION_DESCRIPTIONS];
      expect(description).toContain('Robinhood Chain');
      expect(description).toContain('HEY Research Lab');
      expect(description).toContain('not price advice, not a safety verdict');
      expect(description).toContain('nothing signed');
    }
    expect(ACTION_DESCRIPTIONS.research_project).toMatch(
      /still building.*what did it ship.*last meaningful ship/,
    );
    expect(ACTION_DESCRIPTIONS.find_projects).toMatch(/ticker.*contract address/);
  });

  it('supports every network, because it only reads HEY over HTTPS', () => {
    const provider = heyResearchActionProvider();
    expect(provider.supportsNetwork({ protocolFamily: 'evm', chainId: '8453' })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: 'evm', chainId: '4663' })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: 'svm', networkId: 'solana-mainnet' })).toBe(
      true,
    );
    expect(provider.supportsNetwork({ protocolFamily: 'unknown' })).toBe(true);
  });

  it('declares no action that takes the wallet provider', () => {
    const metadata = Reflect.getMetadata(ACTION_DECORATOR_KEY, HeyResearchActionProvider) as Map<
      string,
      ActionMetadata
    >;
    expect([...metadata.values()].map((m) => m.walletProvider)).toEqual(NAMES.map(() => false));
  });

  it('runs every action without touching the wallet, and only GETs heyresearch.xyz', async () => {
    const wallet = new TripwireWallet();
    for (const [name, args, fixture] of EVERY_ACTION) {
      const calls: Call[] = [];
      const action = actions({ fetchImpl: fixtureFetch(fixture, calls) }, wallet)[name]!;
      const text = await action.invoke(action.schema.parse(args));
      expect(text).not.toMatch(/^Error/);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url.origin).toBe('https://heyresearch.xyz');
      expect(calls[0]!.init?.method ?? 'GET').toBe('GET');
      expect(calls[0]!.init?.body ?? null).toBeNull();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wallet.touched).toEqual([]);
  });

  it('names itself to HEY and sends no key unless one is supplied', async () => {
    const calls: Call[] = [];
    await invoke('chain_overview', { days: 3 }, fixtureFetch('live/pulse', calls));
    const headers = new Headers(calls[0]!.init?.headers);
    expect(headers.get('x-hey-integration')).toBe(`hey-agentkit/${VERSION}`);
    expect(headers.get('user-agent')).toMatch(new RegExp(`^hey-agentkit/${VERSION}`));
    expect(headers.get('authorization')).toBeNull();
  });

  it('sends a key given in the config, and HEY_API_KEY to heyresearch.xyz only', async () => {
    const given: Call[] = [];
    await invoke('chain_overview', { days: 3 }, fixtureFetch('live/pulse', given), {
      apiKey: 'test-key-from-config',
    });
    expect(new Headers(given[0]!.init?.headers).get('authorization')).toBe(
      'Bearer test-key-from-config',
    );

    vi.stubEnv('HEY_API_KEY', 'test-key-from-env');
    const fromEnv: Call[] = [];
    await invoke('chain_overview', { days: 3 }, fixtureFetch('live/pulse', fromEnv));
    expect(new Headers(fromEnv[0]!.init?.headers).get('authorization')).toBe(
      'Bearer test-key-from-env',
    );

    const mock: Call[] = [];
    await invoke('chain_overview', { days: 3 }, fixtureFetch('live/pulse', mock), {
      baseUrl: 'http://localhost:3100',
    });
    expect(mock[0]!.url.origin).toBe('http://localhost:3100');
    expect(new Headers(mock[0]!.init?.headers).get('authorization')).toBeNull();
  });

  it('refuses a base URL that is not https (or local http), or not an origin', () => {
    expect(() => heyResearchActionProvider({ baseUrl: 'http://example.com' })).toThrow(/https:/);
    expect(() => heyResearchActionProvider({ baseUrl: 'https://example.com/api' })).toThrow(
      /origin only/,
    );
    expect(() => heyResearchActionProvider({ baseUrl: 'https://u:p@example.com' })).toThrow(
      /credentials/,
    );
    expect(() => heyResearchActionProvider({ baseUrl: 'not a url' })).toThrow(/absolute URL/);
  });

  it('keeps its version in step with package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(VERSION).toBe(pkg.version);
  });
});

describe('AgentKit and its framework extensions', () => {
  async function agentKit(calls: Call[] = []) {
    return AgentKit.from({
      walletProvider: new TripwireWallet(),
      actionProviders: [
        heyResearchActionProvider({
          fetchImpl: fixtureFetch(['live/research', 'live/pulse'], calls),
        }),
      ],
    });
  }

  it('AgentKit exposes the six actions on any wallet network', async () => {
    const kit = await agentKit();
    expect(kit.getActions().map((a) => a.name)).toEqual(
      NAMES.map((n) => `HeyResearchActionProvider_${n}`),
    );
  });

  it('getLangChainTools turns them into LangChain tools that answer from HEY', async () => {
    const tools = await getLangChainTools(await agentKit());
    const research = tools.find((t) => t.name === 'HeyResearchActionProvider_research_project');
    expect(research).toBeDefined();
    const text = (await research!.invoke({ project: 'musepass-musepass' })) as string;
    expect(text).toMatch(/^HEY research: /);
    expect(text).toContain('https://heyresearch.xyz/project/musepass-musepass');
  });

  it('getVercelAITools turns them into Vercel AI SDK tools that answer from HEY', async () => {
    const tools = getVercelAITools(await agentKit());
    const chain = tools.HeyResearchActionProvider_chain_overview;
    expect(chain?.description).toBe(ACTION_DESCRIPTIONS.chain_overview);
    const text = (await chain!.execute!(
      { days: 3 },
      { toolCallId: 'call-1', messages: [] },
    )) as string;
    expect(text).toMatch(/^HEY on Robinhood Chain \(4663\)/);
  });
});
