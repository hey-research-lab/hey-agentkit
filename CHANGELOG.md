# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## 0.2.1 — unreleased (not yet on npm)

- Security: the runtime `zod` moves from `^3.24.1` to `^4.6.7` (GHSA-mrhx-c7xc-m3w5, memory exhaustion
  on large arrays, fixed only in 4.6.6). The action schemas import `zod/v3`, the zod 3 API zod 4 still
  ships, because AgentKit 0.10.4 and its LangChain and Vercel AI extensions read zod 3 schemas; the
  schemas, the actions and every answer are unchanged.
- Still two zod majors in an install: `@coinbase/agentkit` itself depends on zod `^3.23.8`, and
  `@hey-research-lab/agent-contract` stays `^0.2.0` (zod 3) until this package's recorded fixtures are
  re-recorded against agent-contract 0.3.0, which requires the `citation` field HEY's answers now carry.
- Development: vitest 4.1.12.

## 0.2.0 — 2026-11-02

- `research_project` takes exactly one of `project` (slug), `address` (a token or contract) or
  `q` (a name or `$TICKER`), through HEY's project search. One exact match answers and says how it
  was found ("Found by contract" / "Found by name"); several come back as `ambiguous` with their
  candidates (slug, contract, link) and HEY picks none; a contract HEY holds no published project
  for comes back as `not_published`, worded as a statement about HEY's index.
- `readResearchAnswer(text)`: reads a `research_project` answer back in code (slug, activity
  status, last meaningful ship, link; or the refusal's code and candidates), so a host can decide
  before a model does. `ACTIVITY_STATUSES` lists HEY's statuses.
- `guardAgentKitAnalytics()` and `isAgentKitAnalyticsFailure()`: an opt-in guard for an AgentKit
  0.10.x issue (coinbase/agentkit#1531). AgentKit starts an analytics request on every action and
  wallet set-up without awaiting it; when it fails (on 2026-11-02 it answers 400 to every action
  event) Node ends the process. The guard ignores exactly that rejection and leaves every other
  one to Node's default or the host's own listener.
- `chain_overview` cites `https://heyresearch.xyz/` (HEY folded `/pulse` into its homepage).
- `@hey-research-lab/sdk` ^0.3.2 (was ^0.2.0). `@hey-research-lab/agent-contract` stays ^0.2.0:
  0.3.0 moves to zod 4. `@coinbase/agentkit` stays 0.10.4, still the newest release on npm; the
  peer range is unchanged.
- `examples/base-agent`: an AgentKit agent on Base that checks a Robinhood Chain project with HEY
  before it trades, bridges to or funds its token, and proceeds, warns or refuses in code.
- README: "For agents on Base", HEY's ERC-8004 registration on Base (agentId 1148006), and the
  two AgentKit 0.10.4 issues (the analytics rejection; a fresh install resolving `@x402/svm`
  2.29.0, pinned to 2.28.0 in the example).

## 0.1.0 — 2026-10-13

First release.

- `HeyResearchActionProvider`, a Coinbase AgentKit `ActionProvider` (built and tested against
  `@coinbase/agentkit` 0.10.4, peer range `>=0.10 <0.11`), and the factory
  `heyResearchActionProvider({ apiKey?, baseUrl? })`. `supportsNetwork` is `true` for any network:
  the provider only reads HEY's public API and never takes the wallet.
- Six read-only actions registered with `@CreateAction` and zod schemas, each one read through
  `@hey-research-lab/sdk` ^0.2.0: `research_project`, `find_projects`, `lookup_token`,
  `what_changed`, `project_timeline`, `chain_overview`.
- Answers in plain text: HEY's answer first, state values verbatim, unknown as unknown with its
  reason, a source's words quoted «…», evidence ids with receipt URLs, the as-of time, and the line
  "Source: HEY Research Lab — heyresearch.xyz" with HEY's link. No market figure is printed.
- Agent answers are checked against `@hey-research-lab/agent-contract` ^0.2.0 before rendering;
  an answer about another chain is refused with `unsupported_chain`.
- Robinhood Chain (4663) only: any other `chainId` is refused with `unsupported_chain` before a
  request. HEY's API errors come back as one sentence with HEY's code, message, retry delay and
  request id.
- Optional `HEY_API_KEY`; a key from the environment is sent to `https://heyresearch.xyz` only.
- Tested offline over saved fixtures, including AgentKit's `getLangChainTools` and
  `getVercelAITools` extensions.
