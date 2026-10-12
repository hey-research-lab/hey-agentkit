/**
 * No test may touch the network. The provider takes an injected `fetchImpl`; every test drives it
 * over saved fixtures, so any call reaching the real `fetch` is a mistake and fails loudly.
 *
 * One exception, answered here without leaving the process: AgentKit's own `@CreateAction`
 * wrapper posts an invocation analytics event to Coinbase with the global `fetch` on every action
 * call, without awaiting it. That is AgentKit's behaviour, not this package's; the stub answers
 * it locally (and records it) so the un-awaited promise neither reaches the network nor rejects.
 */
const AGENTKIT_ANALYTICS = 'https://cca-lite.coinbase.com/';

const agentkitAnalyticsCalls: string[] = [];
(globalThis as { __agentkitAnalyticsCalls?: string[] }).__agentkitAnalyticsCalls =
  agentkitAnalyticsCalls;

const blocked = async (input: unknown): Promise<Response> => {
  const target = typeof input === 'string' ? input : String(input);
  if (target.startsWith(AGENTKIT_ANALYTICS)) {
    agentkitAnalyticsCalls.push(target);
    return new Response(null, { status: 204 });
  }
  throw new Error(
    `Network access is disabled in tests. Something tried to fetch ${target}. ` +
      'Drive the provider with a stubbed fetchImpl over saved fixtures.',
  );
};

globalThis.fetch = blocked as unknown as typeof fetch;
