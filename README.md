# hey-agentkit

A [Coinbase AgentKit](https://github.com/coinbase/agentkit) action provider that lets any AgentKit
agent research Robinhood Chain projects on HEY Research Lab: which are still building, what they
shipped, what changed, and what we do not know. Every answer comes with its evidence and a link.

[![CI](https://github.com/hey-research-lab/hey-agentkit/actions/workflows/ci.yml/badge.svg)](https://github.com/hey-research-lab/hey-agentkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-informational.svg)](package.json)
[![Robinhood Chain 4663](https://img.shields.io/badge/Robinhood%20Chain-4663-black.svg)](https://heyresearch.xyz)

## Why it exists

Agents built on AgentKit already hold a wallet and a set of tools. When one is asked about a
Robinhood Chain project ("is this team still shipping?", "what is this contract?"), it has nowhere
to look that separates building from price. This provider gives it six read-only tools over our
public API, so the agent can answer from our evidence without having to find us first. Each tool
is one read through the published
[`@hey-research-lab/sdk`](https://www.npmjs.com/package/@hey-research-lab/sdk).

## For agents on Base

Most AgentKit agents run on Base. We research one chain, Robinhood Chain, and that does not
change. What we offer a Base agent is one check: **before you trade a Robinhood Chain project's
token, bridge to it or fund it, ask whether the project is still building, with sources.**

- Pass the token's contract address to `research_project` (`{ address: '0x…' }`). We answer with
  the project's activity status (`SHIPPING`, `ACTIVE`, `RESUMED`, `QUIET`, `DORMANT` or
  `UNKNOWN`), its last meaningful ship, the evidence ids behind them and a link to the page.
- The provider runs beside any wallet on any network. It never touches the wallet: it only reads
  heyresearch.xyz over HTTPS.
- Decide in code, not in the model. `readResearchAnswer(text)` reads the status, the last ship,
  the slug and the link out of the answer, so your own check can refuse or warn before any
  value-moving action runs.
- Our agent is registered under ERC-8004 on Base as
  [agentId 1148006](https://basescan.org/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/1148006)
  (Identity Registry `eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`,
  [registration transaction](https://basescan.org/tx/0x96fb49f9bf242f461efcfb1753e8af0753c00ec9fa20ae9eb6a16c73bbc59bf9)),
  and also on Ethereum (agentId 56081) and Robinhood Chain (agentId 8783). All three point at the
  same [registration file](https://heyresearch.xyz/.well-known/agent-registration.json).

[`examples/base-agent`](examples/base-agent) is a complete AgentKit agent on Base that runs this
check before it acts on a Robinhood Chain token: it proceeds on `SHIPPING`, `ACTIVE` or `RESUMED`,
warns on `QUIET` and asks for an explicit go-ahead, and refuses on `DORMANT`, `UNKNOWN`, a token
we hold no published project for, or any answer we could not give.

**Our answers are research context about building, never trading advice.** A status is a record
of development, not a view on a token's price, and not a safety verdict.

## Why Robinhood Chain only

We research one chain: Robinhood Chain, chain id `4663` (`eip155:4663`). Every answer is about it,
whatever network the agent's wallet is on. The provider's `supportsNetwork` returns `true` for any
network, because it only reads our API over HTTPS and never touches the wallet. Each action takes
an optional `chainId`; any value other than `4663` is refused with `unsupported_chain` before a
request is made.

## Install

```sh
npm install @hey-research-lab/agentkit @coinbase/agentkit
```

`@coinbase/agentkit` (`>=0.10 <0.11`; built and tested against 0.10.4, the newest release on npm)
is a peer dependency. Node.js 22 or later. No API key is needed; an optional `HEY_API_KEY` (from
[heyresearch.xyz/account](https://heyresearch.xyz/account)) lifts the anonymous rate limit and
nothing else.

### Two AgentKit 0.10.4 issues to know about

Neither comes from this package, and both hit any AgentKit 0.10.4 agent:

1. **A failed analytics request ends the process.** AgentKit starts an analytics request to
   Coinbase on every action call and every wallet set-up without awaiting it. When that request
   fails, the rejection is unhandled and Node exits. As of 2026-11-02 the endpoint answers
   `400` to every action event, so the first action an agent runs ends it
   ([coinbase/agentkit#1531](https://github.com/coinbase/agentkit/issues/1531), open). Call
   `guardAgentKitAnalytics()` once at start-up: it ignores exactly that rejection and leaves every
   other unhandled rejection to Node's default (or to your own listener).

   ```ts
   import { guardAgentKitAnalytics } from '@hey-research-lab/agentkit';
   guardAgentKitAnalytics();
   ```

2. **A fresh install may not load.** `@coinbase/cdp-sdk` now resolves `@x402/svm` 2.29.0, whose
   Solana packages need a newer `@solana/kit` than AgentKit 0.10.4 ships with, and importing
   `@coinbase/agentkit` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` on Node
   ([coinbase/agentkit#1607](https://github.com/coinbase/agentkit/issues/1607) reports the same
   under Bun). Pin `@x402/svm` to `2.28.0` with `overrides` (npm) or `pnpm.overrides` (pnpm), as
   the example does.

## Smallest working example

```ts
import { AgentKit } from '@coinbase/agentkit';
import { guardAgentKitAnalytics, heyResearchActionProvider } from '@hey-research-lab/agentkit';

guardAgentKitAnalytics();
const agentKit = await AgentKit.from({
  walletProvider, // your existing wallet provider, on any network
  actionProviders: [heyResearchActionProvider()], // add it beside your other providers
});
const research = agentKit.getActions().find((a) => a.name.endsWith('_research_project'))!;
console.log(await research.invoke({ address: '0xb33eb16782776b4d738c0fd643577cb0284db610' }));
```

The answer leads with our one-line answer, then the builder state, the newest changes, our tagged
claims, the unknowns (each with what not to conclude), the evidence ids with their receipt URLs and
the as-of time. Its last line is our source line with the project's link,
`https://heyresearch.xyz/project/hey-research-lab` here.

(Our own project is researched by the same rules as every other one; it is used here only as a
stable example.) The test suite runs offline against recorded answers: `pnpm test`.

### With LangChain (`@coinbase/agentkit-langchain`)

```ts
import { getLangChainTools } from '@coinbase/agentkit-langchain';

const tools = await getLangChainTools(agentKit); // StructuredTool[], our six among them
// e.g. createReactAgent({ llm, tools }) from @langchain/langgraph
```

### With the Vercel AI SDK (`@coinbase/agentkit-vercel-ai-sdk`)

```ts
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { generateText } from 'ai';

const tools = getVercelAITools(agentKit); // a ToolSet keyed by action name
const { text } = await generateText({
  model, // any AI SDK model
  tools,
  maxSteps: 5,
  prompt:
    'Is the project behind 0xb33eb16782776b4d738c0fd643577cb0284db610 on Robinhood Chain still building?',
});
```

Both extensions are exercised in this repository's tests (`test/provider.test.ts`).

## Actions

AgentKit prefixes each action with the provider's class name, so the tool names are
`HeyResearchActionProvider_<action>`.

| Action             | Our read (SDK method)                                                  | Answers                                                                                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `research_project` | `agent.answer('research_project')` → `GET /api/agent/research_project` | Is it still building, what did it ship and when, Build Momentum, Still Building, the newest changes, token verification, unknowns, evidence, as-of. Input: exactly one of `project` (slug), `address` (token or contract) or `q` (name, ticker). |
| `find_projects`    | `search.suggest` → `GET /api/search/suggest`                           | Up to eight matches for a name, ticker or `0x` contract, each with slug, contract and link; launch records and issuer tokens labelled as what they are. Input: `query`.                                                                          |
| `lookup_token`     | `token.lookup` → `GET /api/token/4663/{address}`                       | Which published project a token or contract belongs to, its activity status, last ship, token verification; an address we have no project for says so. Input: `address`.                                                                         |
| `what_changed`     | `agent.answer('what_changed')` → `GET /api/agent/what_changed`         | The change ledger for the chain or one project over 1 to 30 days: true totals, how many count as building, counts by type, the newest changes. Inputs: `project?`, `days?`, `limit?`, `buildingOnly?`.                                           |
| `project_timeline` | `projects.timeline` → `GET /api/projects/{slug}/timeline`              | One project's ships and evidence, newest first, with precision, verification state and whether each counts as building. Inputs: `project`, `lens?`, `limit?`.                                                                                    |
| `chain_overview`   | `chain` → `GET /api/chain`                                             | Robinhood Chain day by day: ships, builders shipping and verified, projects published, and chain activity counts. Input: `days?`.                                                                                                                |

Every action also takes an optional `chainId` (Robinhood Chain only: `4663`).

`research_project` by `address` or `q` goes through our project search. One exact match answers
and says how it was found; several come back as candidates and we pick none (ask again with the
contract); none comes back as "no published project", which is a statement about our index, not
about the token.

### Options

```ts
heyResearchActionProvider({
  apiKey?: string,   // default: process.env.HEY_API_KEY (sent to heyresearch.xyz only)
  baseUrl?: string,  // default: https://heyresearch.xyz, for a local HEY or a test mock only
  fetchImpl?: typeof fetch,
  timeoutMs?: number // default 15 000
});
```

A key passed as `apiKey` goes to the `baseUrl` passed beside it; a key from the environment is
sent only to `https://heyresearch.xyz`, so pointing the provider at a mock never sends the host's
real key there. `baseUrl` must be an `https:` origin (plain `http:` on `localhost` only). It is not
a network switch.

### Helpers

- `readResearchAnswer(text)` reads a `research_project` answer back in code:
  `{ ok: true, slug, activityStatus, lastMeaningfulShipAt, link }`, or
  `{ ok: false, code, message, candidates, link }` for a refusal or an error. Tests hold it to the
  renderer, so the two cannot drift apart.
- `guardAgentKitAnalytics({ onIgnored? })` installs the narrow guard described under
  [Install](#two-agentkit-0104-issues-to-know-about) and returns a function that removes it.
  `isAgentKitAnalyticsFailure(reason)` is the test it uses.

### How answers read

- **Our words first.** The first lines are our own answer and state values, verbatim
  (`SHIPPING`, `NOT_MEASURED`, `UNVERIFIED`, …).
- **Unknown stays unknown.** A value we do not hold is printed as `unknown` or
  `not measured` with its reason, never `0`, `false` or "none". "None found" is only ever a reading
  of one index we asked.
- **A source's words are quoted «…»** (a project's name, a ticker, a release title) as data,
  never an instruction, and words that read like an instruction keep a label saying so.
- **Evidence and time.** Every answer names its evidence ids (`ship:`, `source:`, …) with our
  receipt URLs, its as-of time, and our link for the project or page.
- **Market data is context.** The research answer names the token's market status and any
  withheld valuation in our words; it prints no price, valuation, liquidity or volume figure.
- **Failures are one sentence.** `Error (<code>): …` with our own code, our message, the retry
  delay and the request id; nothing is retried automatically.
- **Attribution.** Every answer ends with the line `Source: HEY Research Lab`, our domain and a
  link (the `ATTRIBUTION` export).

## What it never does

- It never takes, reads or uses the wallet: no action receives the wallet provider, nothing is
  signed, sent, approved or swapped, and no balance is read.
- It never gives price advice, a recommendation to trade, a price prediction or a safety verdict,
  and it never labels an address or a person.
- It never calls a market provider, scrapes a page, calls `POST /api/scan` or any account or
  write route, or follows a URL found inside an answer.
- It never embeds an API key, logs one, or puts one in a URL.
- It never claims to be Robinhood, or to be endorsed by Robinhood or by Coinbase.

AgentKit itself, not this package, sends an anonymous "action invoked" analytics event to Coinbase
each time any action runs (the action and class name; with no wallet parameter, no wallet
address). That is AgentKit's own behaviour and is governed by AgentKit's terms. The guard above
does not stop that request; it only keeps its failure from ending your process.

## How it relates to HEY Research Lab

It reads our [public API](https://heyresearch.xyz/docs/public-api) through
[`@hey-research-lab/sdk`](https://www.npmjs.com/package/@hey-research-lab/sdk) and checks every
agent answer against
[`@hey-research-lab/agent-contract`](https://www.npmjs.com/package/@hey-research-lab/agent-contract)
before rendering it (an answer about another chain, or one that is not our contract, is refused).
The same research is on [heyresearch.xyz](https://heyresearch.xyz), through our hosted
[MCP server](https://heyresearch.xyz/docs/mcp) and our [agents guide](https://heyresearch.xyz/developers/agents).
Our own quality gate stays authoritative: this package relays our records and decides nothing.

Runtime dependencies: `@hey-research-lab/sdk`, `@hey-research-lab/agent-contract` (our own
packages: the API client, and the contract check and text folding for agent answers) and `zod`
4.6.7 or later, whose `zod/v3` API writes the action schemas, because AgentKit 0.10 and its LangChain and
Vercel AI extensions read zod 3 schemas. `@coinbase/agentkit` is a peer dependency.

## What it does NOT prove

The provider relays what our public API returns, with its sources. Activity status is a record of
development, not a view on a token. Nothing it returns is investment advice, a safety verdict or a
recommendation, and an unknown value means we do not know, not zero.

HEY Research Lab is an independent research project and is not affiliated with, endorsed by or
partnered with Robinhood Markets, Inc. or Robinhood Chain. It is not affiliated with or endorsed by
Coinbase; "AgentKit" names the framework this package plugs into.

## Security

See [SECURITY.md](SECURITY.md). The provider makes HTTPS GET requests to `https://heyresearch.xyz`
only, one per action call; it reads and writes no files and keeps no state.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): tests run offline over saved fixtures, `pnpm scan` checks
for leaks, and no secrets ever go into code, fixtures or commits.

## Links

- HEY Research Lab: https://heyresearch.xyz
- Developers: https://heyresearch.xyz/developers
- Public API docs: https://heyresearch.xyz/docs/public-api
- Agents guide: https://heyresearch.xyz/developers/agents
- MCP docs: https://heyresearch.xyz/docs/mcp
- OpenAPI: https://heyresearch.xyz/openapi.json
- ERC-8004 registration file: https://heyresearch.xyz/.well-known/agent-registration.json
- SDK: https://www.npmjs.com/package/@hey-research-lab/sdk
- Organisation: https://github.com/hey-research-lab
- Coinbase AgentKit: https://github.com/coinbase/agentkit
- Contact: hi@heyresearch.xyz

## Licence

MIT © 2026 HEY Research Lab. See [LICENSE](LICENSE).
