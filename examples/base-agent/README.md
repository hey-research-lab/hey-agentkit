# Base agent: check a Robinhood Chain project before acting on its token

An AgentKit agent with a wallet on Base. Before it trades a Robinhood Chain project's token,
bridges to it or funds it, it asks HEY Research Lab whether the project is still building, with
sources, and decides in code:

| What we read                                                   | The agent               |
| -------------------------------------------------------------- | ----------------------- |
| `SHIPPING`, `ACTIVE`, `RESUMED`                                | proceeds                |
| `QUIET` (no meaningful updates for over a month)               | warns, needs a go-ahead |
| `DORMANT`, `UNKNOWN`                                           | refuses                 |
| no published project for the token, several matches, any error | refuses                 |

The check is `src/hey-check.ts`. It calls our `research_project` action through AgentKit with the
token's contract address, reads the answer with `readResearchAnswer`, and applies the table above.
The model never reads the status for the agent: text a tool returns can steer a model, so the
decision stays in code.

**Our answers are research context about building, never trading advice.** A status is a record
of development, not a view on the token's price, and not a safety verdict. An unknown status means
we have not measured the building; it is not a reason to go ahead.

## Run it

```sh
cd examples/base-agent
pnpm install            # or npm install
cp .env.example .env    # optional: every value is optional
pnpm start 0xb33eb16782776b4d738c0fd643577cb0284db610 --intent=bridge
```

Output, abridged:

```text
No CDP keys set: using a throwaway Base account for this run (it holds nothing).
Agent wallet 0x… on base-mainnet. Checking 0xb33e… on Robinhood Chain with HEY before it bridges.
HEY: PROCEED. HEY reads hey-research-lab as SHIPPING, last meaningful ship 2026-11-01. That is a record of building, not a view on the token.
Evidence: https://heyresearch.xyz/project/hey-research-lab
HEY Research Lab answers are research context, never trading advice.
[stub] The agent would now bridge (Robinhood Chain token 0xb33e…) from 0x… on base-mainnet. Replace act() with your own action.
```

Options: `--intent=trade|bridge|fund` (default `trade`; it changes the wording only),
`--accept-quiet` to go ahead on `QUIET` after reading the evidence, and `--verbose` to print our
full answer with its evidence ids. The process exits non-zero when it does not act.

## Keys

None are needed. `.env.example` lists the optional ones; copy it to `.env`, which git ignores.

- `HEY_API_KEY`: lifts our anonymous rate limit and nothing else; sent to heyresearch.xyz only.
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`: a CDP server wallet for the agent.
  Without all three, the example makes a throwaway Base account in memory for the run. It holds
  nothing and is never saved.
- `NETWORK_ID` (default `base-mainnet`) and `BASE_RPC_URL`.

## Make it yours

- **Your action goes in `act()`.** The stub moves nothing. Put your trade, bridge or funding step
  there, behind the check, and add its action provider to `AgentKit.from` beside ours.
- **In a model-driven loop**, run the same check inside the tool that moves value, so the model
  cannot skip it:

  ```ts
  const check = await checkWithHey(agentKit.getActions(), token, 'trade');
  if (check.decision === 'refuse') return `Not trading: ${check.reason} ${check.link ?? ''}`;
  if (check.decision === 'warn' && !userConfirmed) return `Needs confirmation: ${check.reason}`;
  ```

## Two AgentKit 0.10.4 issues this example works around

- `guardAgentKitAnalytics()` at the top of `src/agent.ts`: AgentKit's unawaited analytics request
  ends the process when it fails, which it does today
  ([coinbase/agentkit#1531](https://github.com/coinbase/agentkit/issues/1531)). The guard ignores
  exactly that rejection.
- `@x402/svm` pinned to `2.28.0` in `package.json`: a fresh install otherwise resolves 2.29.0 and
  `@coinbase/agentkit` fails to load
  ([coinbase/agentkit#1607](https://github.com/coinbase/agentkit/issues/1607)).

Remove both once AgentKit fixes them.

## About us

We research one chain, Robinhood Chain (4663). Our agent is registered under ERC-8004 on Base as
[agentId 1148006](https://basescan.org/nft/0x8004a169fb4a3325136eb29fa0ceb6d2e539a432/1148006),
and on Ethereum (56081) and Robinhood Chain (8783). See the [package README](../../README.md) for
every action, and [heyresearch.xyz/developers](https://heyresearch.xyz/developers) for the API.
