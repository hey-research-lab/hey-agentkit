# hey-agentkit

A [Coinbase AgentKit](https://github.com/coinbase/agentkit) action provider that lets any AgentKit
agent research Robinhood Chain projects on HEY Research Lab: which are still building, what they
shipped, what changed, and what HEY does not know — every answer with its evidence and a link.

[![CI](https://github.com/hey-research-lab/hey-agentkit/actions/workflows/ci.yml/badge.svg)](https://github.com/hey-research-lab/hey-agentkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-informational.svg)](package.json)
[![Robinhood Chain 4663](https://img.shields.io/badge/Robinhood%20Chain-4663-black.svg)](https://heyresearch.xyz)

## Why it exists

Agents built on AgentKit already hold a wallet and a set of tools. When one is asked about a
Robinhood Chain project — "is this team still shipping?", "what is this contract?" — it has
nowhere to look that separates building from price. This provider gives it six read-only tools
over HEY Research Lab's public API, so the agent can answer from HEY's evidence without having to
find HEY first. Each tool is one read through the published
[`@hey-research-lab/sdk`](https://www.npmjs.com/package/@hey-research-lab/sdk).

## Why Robinhood Chain only

HEY researches one chain: Robinhood Chain, chain id `4663` (`eip155:4663`). Every answer is about
it, whatever network the agent's wallet is on — the provider's `supportsNetwork` returns `true`
for any network, because it only reads HEY over HTTPS and never touches the wallet. Each action
takes an optional `chainId`; any value other than `4663` is refused with `unsupported_chain`
before a request is made.

## Install

```sh
npm install @hey-research-lab/agentkit @coinbase/agentkit
```

`@coinbase/agentkit` (`>=0.10 <0.11`; built and tested against 0.10.4) is a peer dependency.
Node.js 22 or later. No API key is needed; an optional `HEY_API_KEY` (from
[heyresearch.xyz/account](https://heyresearch.xyz/account)) lifts the anonymous rate limit and
nothing else.

## Smallest working example

```ts
import { AgentKit } from '@coinbase/agentkit';
import { heyResearchActionProvider } from '@hey-research-lab/agentkit';

const agentKit = await AgentKit.from({
  walletProvider, // your existing wallet provider, on any network
  actionProviders: [heyResearchActionProvider()], // add it beside your other providers
});
const research = agentKit.getActions().find((a) => a.name.endsWith('_research_project'))!;
console.log(await research.invoke({ project: 'hey-research-lab' }));
```

The answer leads with HEY's one-line answer, then the builder state, the newest changes, HEY's
tagged claims, the unknowns (each with what not to conclude), the evidence ids with their receipt
URLs, the as-of time, and ends with:

```text
Source: HEY Research Lab — heyresearch.xyz · https://heyresearch.xyz/project/hey-research-lab
```

(HEY's own project is researched by the same rules as every other one; it is used here only as a
stable example.) The test suite runs offline against recorded answers: `pnpm test`.

### With LangChain (`@coinbase/agentkit-langchain`)

```ts
import { getLangChainTools } from '@coinbase/agentkit-langchain';

const tools = await getLangChainTools(agentKit); // StructuredTool[], HEY's six among them
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
    'Is the project behind 0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7 on Robinhood Chain still building?',
});
```

Both extensions are exercised in this repository's tests (`test/provider.test.ts`).

## Actions

AgentKit prefixes each action with the provider's class name, so the tool names are
`HeyResearchActionProvider_<action>`.

| Action             | HEY read (SDK method)                                                  | Answers                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `research_project` | `agent.answer('research_project')` → `GET /api/agent/research_project` | Is it still building, what did it ship and when, Build Momentum, Still Building, the newest changes, token verification, unknowns, evidence, as-of. Input: `project` (slug).                        |
| `find_projects`    | `search.suggest` → `GET /api/search/suggest`                           | Up to eight matches for a name, ticker or `0x` contract, each with slug, contract and link; launch records and issuer tokens labelled as what they are. Input: `query`.                             |
| `lookup_token`     | `token.lookup` → `GET /api/token/4663/{address}`                       | Which published project a token or contract belongs to, its activity status, last ship, token verification; an address HEY has no project for says so. Input: `address`.                            |
| `what_changed`     | `agent.answer('what_changed')` → `GET /api/agent/what_changed`         | The change ledger for the chain or one project over 1–30 days: true totals, how many count as building, counts by type, the newest changes. Inputs: `project?`, `days?`, `limit?`, `buildingOnly?`. |
| `project_timeline` | `projects.timeline` → `GET /api/projects/{slug}/timeline`              | One project's ships and evidence, newest first, with precision, verification state and whether each counts as building. Inputs: `project`, `lens?`, `limit?`.                                       |
| `chain_overview`   | `chain` → `GET /api/chain`                                             | Robinhood Chain day by day: ships, builders shipping and verified, projects published, and chain activity counts. Input: `days?`.                                                                   |

Every action also takes an optional `chainId` (Robinhood Chain only: `4663`).

### Options

```ts
heyResearchActionProvider({
  apiKey?: string,   // default: process.env.HEY_API_KEY (sent to heyresearch.xyz only)
  baseUrl?: string,  // default: https://heyresearch.xyz — for a local HEY or a test mock only
  fetchImpl?: typeof fetch,
  timeoutMs?: number // default 15 000
});
```

A key passed as `apiKey` goes to the `baseUrl` passed beside it; a key from the environment is
sent only to `https://heyresearch.xyz`, so pointing the provider at a mock never sends the host's
real key there. `baseUrl` must be an `https:` origin (plain `http:` on `localhost` only). It is not
a network switch.

### How answers read

- **HEY's words first.** The first lines are HEY's own answer and state values, verbatim
  (`SHIPPING`, `NOT_MEASURED`, `UNVERIFIED`, …).
- **Unknown stays unknown.** A value HEY does not hold is printed as `unknown` or
  `not measured — <reason>`, never `0`, `false` or "none". "None found" is only ever a reading of
  one index HEY asked.
- **A source's words are quoted «…»** — a project's name, a ticker, a release title — as data,
  never an instruction, and words that read like an instruction keep a label saying so.
- **Evidence and time.** Every answer names its evidence ids (`ship:`, `source:`, …) with HEY's
  receipt URLs, its as-of time, and HEY's link for the project or page.
- **Market data is context.** The research answer names the token's market status and any
  withheld valuation in HEY's words; it prints no price, valuation, liquidity or volume figure.
- **Failures are one sentence.** `Error (<code>): …` with HEY's own code, its message, the retry
  delay and the request id; nothing is retried automatically.
- **Attribution.** Every answer ends with
  `Source: HEY Research Lab — heyresearch.xyz · <link>`.

## What it never does

- It never takes, reads or uses the wallet: no action receives the wallet provider, nothing is
  signed, sent, approved or swapped, and no balance is read.
- It never gives price advice, a recommendation to trade, a price prediction or a safety verdict,
  and it never labels an address or a person.
- It never calls a market provider, scrapes a page, calls `POST /api/scan` or any account or
  write route, or follows a URL found inside an answer.
- It never embeds an API key, logs one, or puts one in a URL.
- It never claims to be Robinhood, or to be endorsed by Robinhood or by Coinbase.

AgentKit itself — not this package — sends an anonymous "action invoked" analytics event to
Coinbase each time any action runs (the action and class name; with no wallet parameter, no
wallet address). That is AgentKit's own behaviour and is governed by AgentKit's terms.

## How it relates to HEY Research Lab

It reads HEY's [public API](https://heyresearch.xyz/docs/public-api) through
[`@hey-research-lab/sdk`](https://www.npmjs.com/package/@hey-research-lab/sdk) and checks every
agent answer against
[`@hey-research-lab/agent-contract`](https://www.npmjs.com/package/@hey-research-lab/agent-contract)
before rendering it (an answer about another chain, or one that is not HEY's contract, is
refused). The same research is on [heyresearch.xyz](https://heyresearch.xyz), through HEY's hosted
[MCP server](https://heyresearch.xyz/docs/mcp) and its [agents guide](https://heyresearch.xyz/developers/agents).
HEY's own quality gate stays authoritative: this package relays HEY's records and decides nothing.

Runtime dependencies: `@hey-research-lab/sdk`, `@hey-research-lab/agent-contract` (HEY's own
packages: the API client, and the contract check and text folding for agent answers) and `zod`
(the action schemas AgentKit requires). `@coinbase/agentkit` is a peer dependency.

## What it does NOT prove

The provider relays what HEY's public API returns, with its sources. Activity status is a record
of development, not a view on a token. Nothing it returns is investment advice, a safety verdict or
a recommendation, and an unknown value means HEY does not know — not zero.

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
- SDK: https://www.npmjs.com/package/@hey-research-lab/sdk
- Organisation: https://github.com/hey-research-lab
- Coinbase AgentKit: https://github.com/coinbase/agentkit
- Contact: hi@heyresearch.xyz

## Licence

MIT © 2026 HEY Research Lab. See [LICENSE](LICENSE).
