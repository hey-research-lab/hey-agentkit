# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

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
