# Contributing

Thank you for helping. This package is a thin, read-only AgentKit action provider over HEY
Research Lab's public API; changes that keep it that way are welcome.

## Setup

```sh
corepack enable
pnpm install
pnpm scan          # leak and attribution scan (scripts/scan.mjs)
pnpm lint
pnpm typecheck
pnpm test          # offline: fixtures only, the network is blocked
pnpm build
```

Node.js 22+, pnpm 9.15.1.

## Decorators

AgentKit registers actions with its `@CreateAction` decorator, which reads the decorated method's
parameter types at runtime (`design:paramtypes`) to decide whether the method takes the wallet
provider. So `tsconfig.json` sets `experimentalDecorators` and `emitDecoratorMetadata`, and:

- `pnpm build` (tsup) compiles the sources with `@swc/core`, which tsup selects automatically when
  `emitDecoratorMetadata` is on — esbuild alone does not emit the metadata;
- `pnpm test` (Vitest on Vite 8) reads the same tsconfig flags and emits the metadata itself.

A consumer of the published package needs neither flag: `dist/` already carries the metadata.
Every action method takes exactly one parameter, its parsed arguments — never the wallet provider
(`test/provider.test.ts` fails otherwise).

## Rules

- **One action, one SDK read.** Only routes documented at <https://heyresearch.xyz/docs/public-api>,
  through the published SDK (`@hey-research-lab/sdk`); for a route it has no method for yet, its
  public `client.get()`. Never fork or vendor it. Never an account, write or partner route, never
  `POST /api/scan`, no hidden fan-out, no automatic retries.
- **No wallet.** No action may take the wallet provider, sign, send or read a balance.
- **HEY's words, unknown as unknown.** State values verbatim; an absent value prints as "unknown"
  or "not measured — reason", never `0`, `false`, a blank or "none". A source's words are quoted
  «…» with the agent contract's `quoteExternal` / `quoteForTransport`.
- **Every answer ends with the attribution line** and a heyresearch.xyz link.
- **Robinhood Chain only** (4663). No network, chain or RPC options beyond the refusing `chainId`.
- **Wording:** no investment advice, no safety verdicts, no trading language, no "users" for
  addresses. `test/semantics.test.ts` scans every answer for the ecosystem's forbidden words.
- **Tests:** every behaviour is tested against fixtures in `test/fixtures`. `live/` holds answers
  recorded once from the live API (shared with the ecosystem's CLI); `synthetic/` holds
  hand-written answers for paths the live API cannot be asked for on demand (unknown values, rate
  limits, 5xx, malformed payloads, another chain). AgentKit's own analytics call is answered
  in-process by `vitest.setup.ts`; nothing reaches the network.
- **No secrets** in code, fixtures, commits or logs; no `.env` with values.
- Conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).

## Parity

The chain constants (`src/chain.ts`) and the address rules (`src/evm.ts`) follow the HEY Research
Lab ecosystem conventions shared by every repository in the organisation. The action-to-endpoint
map and the agent answer shapes were last checked against HEY's public contract — the OpenAPI
document at https://heyresearch.xyz/openapi.json, the SDK 0.2.0 types and the agent contract 0.2.0
— on 2026-10-13; the live fixtures were recorded from the live API on 2026-10-09.
