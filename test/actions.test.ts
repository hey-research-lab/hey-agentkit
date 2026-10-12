import { describe, expect, it } from 'vitest';

import { ATTRIBUTION } from '../src/index.js';
import { fixtureFetch, invoke, type Call } from './helpers.js';

const SOURCE = `${ATTRIBUTION} · `;

describe('research_project', () => {
  it("leads with HEY's answer and keeps its builder state, unknowns, evidence and as-of", async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'research_project',
      { project: 'musepass-musepass' },
      fixtureFetch('live/research', calls),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url.pathname).toBe('/api/agent/research_project');

    const rows = text.split('\n');
    expect(rows[0]).toBe(
      "HEY research: «musepass» (project record's words, quoted as data) — musepass-musepass on Robinhood Chain (4663)",
    );
    expect(rows[1]).toMatch(/^Answer \(DERIVED\): musepass-musepass: activity status SHIPPING/);
    expect(text).toContain('- Activity status: SHIPPING (measured: yes)');
    expect(text).toContain('- Last meaningful ship: 2026-10-02T14:13:07.000Z');
    expect(text).toContain('- Meaningful events in 30 days: 1');
    expect(text).toContain('- Build Momentum (0–100): 23');
    expect(text).toContain('- Still Building: NOT_MEASURED — not_scored');
    expect(text).toContain('Latest meaningful change:');
    expect(text).toContain(
      '[build.code_activity, FACT] Code changes, week of 2026-09-28 – 2026-10-04 — counts as building',
    );
    expect(text).toContain(
      '[research.source_added, FACT] Official source added: docs — context, not building',
    );
    expect(text).toContain('Unknowns (2) — HEY does not know these');
    expect(text).toContain(
      '- NOT_VERIFIED · projectOwner: No owner has proved control of this project’s site, repository or contract to HEY. Do not conclude: HEY has not verified this link.',
    );
    expect(text).toContain(
      '- ship:4ec70ca8-a1c9-46a2-888b-f29a4f824de1 → https://heyresearch.xyz/api/evidence/ship%3A4ec70ca8-a1c9-46a2-888b-f29a4f824de1',
    );
    expect(text).toContain('Token: none recorded for this project on HEY');
    expect(text).toContain(
      'As of: 2026-10-09T04:15:06.692Z · cite: https://heyresearch.xyz/api/agent/research_project?project=musepass-musepass',
    );
    expect(rows.at(-1)).toBe(`${SOURCE}https://heyresearch.xyz/project/musepass-musepass`);
  });
});

describe('find_projects', () => {
  it('lists projects with their slug and link, and launch records as not researched', async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'find_projects',
      { query: 'musepass' },
      fixtureFetch('live/search', calls),
    );
    expect(calls[0]!.url.pathname).toBe('/api/search/suggest');
    expect(calls[0]!.url.searchParams.get('q')).toBe('musepass');
    expect(text).toContain(
      '- Project «musepass» · slug musepass-musepass → https://heyresearch.xyz/project/musepass-musepass',
    );
    expect(text).toContain(
      '- Launch record «MusePass» «MuseUp» · contract 0x89e036fb7aed14022f3009af027a62835f60eba3 · launched via «Unknown» · not a published project: HEY has not researched it',
    );
    expect(text).toContain('Next: research a project with research_project and its slug.');
    expect(text.split('\n').at(-1)).toBe(`${SOURCE}https://heyresearch.xyz/search?q=musepass`);
  });
});

describe('lookup_token', () => {
  it('names the published project, its status words, token verification and link', async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'lookup_token',
      { address: '0X7E7154EB9DD81084625A7A2E9E731CADFDDB9AB7' },
      fixtureFetch('live/token', calls),
    );
    expect(calls[0]!.url.pathname).toBe(
      '/api/token/4663/0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7',
    );
    expect(text).toContain(
      'HEY token lookup: 0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7 on Robinhood Chain (4663)',
    );
    expect(text).toContain('Published project: «Priors Agents» «PRIORS» · slug priors-agents');
    expect(text).toContain(
      'Activity status: SHIPPING — Shipping: Shipped something meaningful in the last 7 days.',
    );
    expect(text).toContain('Meaningful ships in 30 days: 3');
    expect(text).toContain(
      'Token verification: UNVERIFIED (owner_has_not_published_contract) — whether the project itself names this contract',
    );
    expect(text).toContain('Activity applies to this token: yes');
    expect(text).toContain('As of: 2026-10-08T22:47:18.877Z');
    expect(text.split('\n').at(-1)).toBe(`${SOURCE}https://heyresearch.xyz/project/priors-agents`);
  });

  it('says an address HEY has no project for is HEY’s record, not a finding', async () => {
    const text = await invoke(
      'lookup_token',
      { address: '0x0000000000000000000000000000000000000001' },
      fixtureFetch('live/token-unknown'),
    );
    expect(text).toContain(
      "HEY has no published project for this address. That is HEY's record, not a finding",
    );
    expect(text).toContain(
      'https://heyresearch.xyz/scan/0x0000000000000000000000000000000000000001',
    );
  });

  it('says an issuer’s token is never a project', async () => {
    const text = await invoke(
      'lookup_token',
      { address: '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec' },
      fixtureFetch('live/token-issuer'),
    );
    expect(text).toContain(
      'Issuer token: Robinhood stock token: NVIDIA (NVDA) — issued by Robinhood, not a project on HEY. It is never a project on HEY.',
    );
  });
});

describe('what_changed', () => {
  it('gives the true total, the building count, counts by type and the newest changes', async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'what_changed',
      { days: 7, limit: 3 },
      fixtureFetch('synthetic/what-changed', calls),
    );
    expect(calls[0]!.url.pathname).toBe('/api/agent/what_changed');
    expect(text).toContain(
      'What changed on Robinhood Chain (4663) — all of Robinhood Chain, last 7 days',
    );
    expect(text).toContain('Total in the window: 412 (97 count as building) · listed here: 3');
    expect(text).toContain(
      'By type: build.code_activity 61, research.source_added 88, build.release 36',
    );
    expect(text).toContain(
      'detected 2026-10-07T20:05:15.661Z (no source date) [research.source_added, FACT]',
    );
    expect(text).toContain('All changes in the window: https://heyresearch.xyz/api/changes?since=');
    expect(text.split('\n').at(-1)).toBe(`${SOURCE}https://heyresearch.xyz/updates`);
  });

  it('asks for building only and one project when told to', async () => {
    const calls: Call[] = [];
    await invoke(
      'what_changed',
      { project: 'musepass-musepass', buildingOnly: true },
      async (input) => {
        calls.push({ url: new URL(input), init: undefined });
        throw new Error('stop after the request');
      },
    );
    expect(calls[0]!.url.searchParams.get('project')).toBe('musepass-musepass');
    expect(calls[0]!.url.searchParams.get('building')).toBe('only');
  });
});

describe('project_timeline', () => {
  it('lists ships newest first with precision, verification and whether each counts as building', async () => {
    const calls: Call[] = [];
    const text = await invoke(
      'project_timeline',
      { project: 'musepass-musepass' },
      fixtureFetch('synthetic/timeline', calls),
    );
    expect(calls[0]!.url.searchParams.get('lens')).toBe('build');
    expect(calls[0]!.url.searchParams.get('limit')).toBe('10');
    expect(text).toContain('Listed: 3 of 4 (older entries exist)');
    expect(text).toContain(
      '- 2026-10-07T10:00:00.000Z (DATE) [ship] «Builder update: new verify guide» — context, not building · SELF_REPORTED',
    );
    expect(text).toContain(
      '- 2026-10-02T14:13:07.000Z (WEEK) [ship] «Code changes, week of 2026-09-28 – 2026-10-04» — counts as building · PUBLICLY_VERIFIED · code substance SUBSTANTIVE',
    );
    expect(text).not.toContain('123456');
    expect(text.split('\n').at(-1)).toBe(
      `${SOURCE}https://heyresearch.xyz/project/musepass-musepass`,
    );
  });
});

describe('chain_overview', () => {
  it('puts building first and prints chain activity as counts, never volume', async () => {
    const calls: Call[] = [];
    const text = await invoke('chain_overview', { days: 3 }, fixtureFetch('live/pulse', calls));
    expect(calls[0]!.url.pathname).toBe('/api/chain');
    expect(text).toContain(
      '- 2026-10-08: ships 58 · builders shipping 50 · builders verified 12 · projects published 75',
    );
    expect(text).toContain('- 2026-10-09 (today, in progress): ships 0');
    expect(text).toContain('- 2026-10-08 [observed]: transactions 6137956 · transfers 13857769');
    expect(text).not.toMatch(/2665015506|3543477035|volume/i);
    expect(text.split('\n').at(-1)).toBe(`${SOURCE}https://heyresearch.xyz/pulse`);
  });
});
