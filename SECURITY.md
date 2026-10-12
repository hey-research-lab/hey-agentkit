# Security policy

## Reporting a vulnerability

Please report privately through GitHub's "Report a vulnerability" (Security → Advisories) on this
repository, or email hi@heyresearch.xyz with "security" in the subject. Do not open a public issue.
We aim to acknowledge within 3 working days. There is no bug bounty for this repository.

## Scope

`@hey-research-lab/agentkit` is a read-only Coinbase AgentKit action provider over HEY Research
Lab's public API.

- **Wallet:** no action receives the AgentKit wallet provider. Nothing is signed, sent, approved or
  swapped, and no balance or address is read. A test fails the build if any action is declared
  with the wallet parameter or touches a wallet method.
- **Network:** HTTPS GET requests to `https://heyresearch.xyz` only, through the published
  `@hey-research-lab/sdk` — one per action call, no automatic retries, no redirect followed except
  the SDK's single one to HEY's own `/api/` path, abandoned after 15 seconds by default. The
  provider never calls `POST /api/scan`, an account route or a write route, never calls a market
  or chain provider, and never fetches a URL found inside an answer.
- **Untrusted input:** action arguments come from a model. They are validated before any request
  (chain id 4663 only, project slug, EVM address, query length); a malformed value is answered with
  an error sentence and nothing is sent.
- **Untrusted output:** HEY's agent answers are checked against `@hey-research-lab/agent-contract`
  (a body that is not the contract, or an answer about another chain, is refused). Project names,
  release titles and other source text are folded onto one line, stripped of control, invisible,
  bidirectional-override and chat-template characters, bounded, and quoted «…» as data; words that
  read like an instruction to a model are labelled as such. They remain untrusted: a host agent
  must never follow them.
- **Test-only override:** `baseUrl` exists for a local HEY or a test mock. It accepts an `https:`
  origin, or `http:` on `localhost` only, with no credentials, path or query.
- **AgentKit:** the framework itself posts an anonymous invocation analytics event to Coinbase on
  every action call. That is outside this package.

## Handling secrets

This project never needs HEY credentials. An optional `HEY_API_KEY` is read from the environment
(or passed as `apiKey`), sent only as a bearer token — an environment key only to
`https://heyresearch.xyz` — never logged, never written to disk, never placed in a URL and never
included in an answer. Never commit a `.env` with values.

## Supported versions

The latest 0.x minor receives fixes.
