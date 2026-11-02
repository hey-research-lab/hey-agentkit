import { describe, expect, it } from 'vitest';

import { checkWithHey, decide } from '../examples/base-agent/src/hey-check.js';
import { actions, answerAnything, fixtureFetch, invoke } from './helpers.js';

const HEY_TOKEN = '0xb33eb16782776b4d738c0fd643577cb0284db610';

/** A rendered research answer with its activity status replaced, for the statuses no fixture holds. */
async function answerWithStatus(status: string): Promise<string> {
  const text = await invoke(
    'research_project',
    { address: HEY_TOKEN },
    fixtureFetch('live/research-by-address'),
  );
  return text.replace('- Activity status: SHIPPING (', `- Activity status: ${status} (`);
}

describe('the Base example’s check (examples/base-agent)', () => {
  it('asks HEY by contract address through AgentKit’s action and proceeds on SHIPPING', async () => {
    const check = await checkWithHey(
      Object.values(actions({ fetchImpl: fixtureFetch('live/research-by-address') })),
      HEY_TOKEN,
      'bridge',
    );
    expect(check.decision).toBe('proceed');
    expect(check.activityStatus).toBe('SHIPPING');
    expect(check.slug).toBe('hey-research-lab');
    expect(check.link).toBe('https://heyresearch.xyz/project/hey-research-lab');
    expect(check.reason).toContain('not a view on the token');
  });

  it('proceeds on ACTIVE and RESUMED, warns on QUIET, refuses DORMANT and UNKNOWN', async () => {
    expect(decide(await answerWithStatus('ACTIVE'), 'trade').decision).toBe('proceed');
    expect(decide(await answerWithStatus('RESUMED'), 'trade').decision).toBe('proceed');
    const quiet = decide(await answerWithStatus('QUIET'), 'fund');
    expect(quiet.decision).toBe('warn');
    expect(quiet.reason).toContain('before you fund it');
    expect(decide(await answerWithStatus('DORMANT'), 'trade').decision).toBe('refuse');
    expect(decide(await answerWithStatus('UNKNOWN'), 'trade').decision).toBe('refuse');
    expect(decide(await answerWithStatus('SOMETHING_NEW'), 'trade').decision).toBe('refuse');
  });

  it('refuses when HEY holds no published project, finds several, or cannot answer', async () => {
    const none = await invoke(
      'research_project',
      { address: '0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7' },
      fixtureFetch('live/research-address-not-published'),
    );
    const notPublished = decide(none, 'trade');
    expect(notPublished.decision).toBe('refuse');
    expect(notPublished.reason).toContain("statement about HEY's index, not about the token");

    const several = await invoke(
      'research_project',
      { q: 'inu' },
      fixtureFetch('live/research-ambiguous'),
    );
    expect(decide(several, 'trade')).toMatchObject({ decision: 'refuse' });

    const down = await invoke(
      'research_project',
      { address: HEY_TOKEN },
      answerAnything('synthetic/internal-error'),
    );
    expect(decide(down, 'trade').decision).toBe('refuse');
  });

  it('tells the host to add HEY’s provider when it is missing', async () => {
    await expect(checkWithHey([], HEY_TOKEN, 'trade')).rejects.toThrow(/heyResearchActionProvider/);
  });
});
