import { afterEach, describe, expect, it } from 'vitest';

import {
  ATTRIBUTION,
  guardAgentKitAnalytics,
  isAgentKitAnalyticsFailure,
  readResearchAnswer,
} from '../src/index.js';
import { answerAnything, fixtureFetch, invoke, type Call } from './helpers.js';

const SOURCE = `${ATTRIBUTION} · `;
const HEY_TOKEN = '0xb33eb16782776b4d738c0fd643577cb0284db610';

describe('research_project by contract address or name', () => {
  it('asks HEY by address and says how it found the project', async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'research_project',
      { address: HEY_TOKEN.toUpperCase().replace('0X', '0x') },
      fixtureFetch('live/research-by-address', calls),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.searchParams.get('address')).toBe(HEY_TOKEN);
    expect(calls[0]!.url.searchParams.has('project')).toBe(false);
    const rows = text.split('\n');
    expect(rows[0]).toMatch(/— hey-research-lab on Robinhood Chain \(4663\)$/);
    expect(rows[2]).toBe(
      `Found by contract: ${HEY_TOKEN} is tied to this project on HEY's record.`,
    );
    expect(text).toContain('- Activity status: SHIPPING (measured: yes)');
    expect(rows.at(-1)).toBe(`${SOURCE}https://heyresearch.xyz/project/hey-research-lab`);
  });

  it('lists the candidates when a name matches several projects, and picks none', async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'research_project',
      { q: 'inu' },
      fixtureFetch('live/research-ambiguous', calls),
    );
    expect(calls[0]!.url.searchParams.get('q')).toBe('inu');
    const rows = text.split('\n');
    expect(rows[0]).toMatch(/^Error \(ambiguous\): HEY could not answer — More than one published/);
    expect(rows[1]).toMatch(/^Candidates \(3; HEY picks none/);
    expect(text).toContain(
      '· slug inu · contract 0x63ee32ac3077d1fbd8a77ebba2a6ed4b8e9c1e18 → https://heyresearch.xyz/project/inu',
    );
  });

  it('says an address HEY holds no published project for is a statement about HEY’s index', async () => {
    const text = await invoke(
      'research_project',
      { address: '0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7' },
      fixtureFetch('live/research-address-not-published'),
    );
    expect(text).toMatch(/^Error \(not_published\): HEY could not answer — HEY holds no published/);
    expect(text).toContain('not about the token');
  });

  it('wants exactly one of project, address or q, checked before any request', async () => {
    const calls: Call[] = [];
    const fetchImpl = answerAnything('live/research', calls);
    const none = await invoke('research_project', {}, fetchImpl);
    expect(none).toMatch(/^Error \(invalid_subject\): Give exactly one of project/);
    expect(
      await invoke('research_project', { project: 'hey-research-lab', q: 'HEY' }, fetchImpl),
    ).toMatch(/^Error \(invalid_subject\)/);
    expect(await invoke('research_project', { address: '0x12' }, fetchImpl)).toMatch(
      /^Error \(invalid_address\)/,
    );
    expect(await invoke('research_project', { q: 'x' }, fetchImpl)).toMatch(
      /^Error \(invalid_query\)/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe('readResearchAnswer', () => {
  it('reads the status, last ship, slug and link from a rendered answer', async () => {
    const text = await invoke(
      'research_project',
      { address: HEY_TOKEN },
      fixtureFetch('live/research-by-address'),
    );
    expect(readResearchAnswer(text)).toEqual({
      ok: true,
      slug: 'hey-research-lab',
      activityStatus: 'SHIPPING',
      lastMeaningfulShipAt: '2026-11-01T22:05:01.000Z',
      link: 'https://heyresearch.xyz/project/hey-research-lab',
    });
  });

  it('reads a slug answer the same way', async () => {
    const text = await invoke(
      'research_project',
      { project: 'musepass-musepass' },
      fixtureFetch('live/research'),
    );
    const read = readResearchAnswer(text);
    expect(read).toMatchObject({ ok: true, slug: 'musepass-musepass', activityStatus: 'SHIPPING' });
  });

  it('reads a refusal as its code, with the candidates HEY listed', async () => {
    const text = await invoke(
      'research_project',
      { q: 'inu' },
      fixtureFetch('live/research-ambiguous'),
    );
    const read = readResearchAnswer(text);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.code).toBe('ambiguous');
    expect(read.candidates).toEqual(['inu', 'inu-447b2f', 'inu-833eff']);
  });

  it('reads HEY API failures and input errors as their code', async () => {
    const limited = await invoke(
      'research_project',
      { project: 'hey-research-lab' },
      answerAnything('synthetic/quota'),
    );
    expect(readResearchAnswer(limited)).toMatchObject({ ok: false });
    const bad = await invoke(
      'research_project',
      { address: '0x1' },
      answerAnything('live/research'),
    );
    expect(readResearchAnswer(bad)).toMatchObject({ ok: false, code: 'invalid_address' });
  });

  it('never reads text it did not render as a status', () => {
    expect(readResearchAnswer('- Activity status: SHIPPING (measured: yes)')).toMatchObject({
      ok: false,
      code: 'unreadable_answer',
    });
  });
});

describe('guardAgentKitAnalytics', () => {
  let remove: (() => void) | undefined;
  afterEach(() => remove?.());

  function analyticsFailure(): Error {
    // The frame name is what the guard looks for: AgentKit's own function is called this.
    function sendAnalyticsEvent(): Error {
      return new Error('HTTP error! status: 400');
    }
    return sendAnalyticsEvent();
  }

  it('recognises only the rejection of AgentKit’s analytics request', () => {
    expect(isAgentKitAnalyticsFailure(analyticsFailure())).toBe(true);
    expect(isAgentKitAnalyticsFailure(new Error('HTTP error! status: 400'))).toBe(false);
    expect(isAgentKitAnalyticsFailure('sendAnalyticsEvent')).toBe(false);
  });

  it('ignores that rejection and raises every other one when it listens alone', () => {
    const others = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    try {
      const ignored: Error[] = [];
      remove = guardAgentKitAnalytics({ onIgnored: (e) => ignored.push(e) });
      guardAgentKitAnalytics(); // a second install adds nothing
      const [listener] = process.listeners('unhandledRejection');
      expect(process.listenerCount('unhandledRejection')).toBe(1);
      const promise = Promise.resolve();
      listener!(analyticsFailure(), promise);
      expect(ignored).toHaveLength(1);
      expect(() => listener!(new Error('something else'), promise)).toThrow('something else');
      remove();
      expect(process.listenerCount('unhandledRejection')).toBe(0);
    } finally {
      for (const other of others) process.on('unhandledRejection', other);
    }
  });

  it('leaves other rejections to the host when the host listens too', () => {
    const host = (): void => undefined;
    process.on('unhandledRejection', host);
    try {
      remove = guardAgentKitAnalytics();
      const listener = process.listeners('unhandledRejection').at(-1)!;
      expect(() => listener(new Error('the host decides'), Promise.resolve())).not.toThrow();
    } finally {
      process.off('unhandledRejection', host);
    }
  });
});
