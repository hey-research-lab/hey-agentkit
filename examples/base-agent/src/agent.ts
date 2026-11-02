/**
 * An AgentKit agent on Base that checks a Robinhood Chain project with HEY Research Lab before it
 * acts on the project's token.
 *
 *   pnpm start <robinhood-chain-token-address> [--intent=trade|bridge|fund] [--accept-quiet] [--verbose]
 *
 * The wallet is on Base. HEY's actions never touch it: they only read heyresearch.xyz. The one
 * step that would move value, `act()`, is a stub that prints what it would do; put your own
 * trade, bridge or funding action there, behind the check.
 */
import {
  AgentKit,
  CdpEvmWalletProvider,
  ViemWalletProvider,
  type WalletProvider,
} from '@coinbase/agentkit';
import { guardAgentKitAnalytics, heyResearchActionProvider } from '@hey-research-lab/agentkit';
import { createWalletClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

import { checkWithHey, type HeyCheck, type Intent } from './hey-check.js';

// AgentKit 0.10.x starts an analytics request on every action and wallet set-up without awaiting
// it; when that request fails, Node ends the process. This ignores exactly that rejection and
// nothing else (coinbase/agentkit#1531).
guardAgentKitAnalytics();

const INTENTS: readonly Intent[] = ['trade', 'bridge', 'fund'];

function parseArgs(argv: string[]): {
  token: string;
  intent: Intent;
  acceptQuiet: boolean;
  verbose: boolean;
} {
  const token = argv.find((arg) => !arg.startsWith('--'));
  if (!token || !/^0x[0-9a-fA-F]{40}$/.test(token)) {
    throw new Error(
      'Usage: pnpm start <robinhood-chain-token-address> [--intent=trade|bridge|fund] [--accept-quiet] [--verbose]',
    );
  }
  const intentArg = argv.find((arg) => arg.startsWith('--intent='))?.slice('--intent='.length);
  const intent = (intentArg ?? 'trade') as Intent;
  if (!INTENTS.includes(intent)) throw new Error(`--intent must be one of ${INTENTS.join(', ')}.`);
  return {
    token,
    intent,
    acceptQuiet: argv.includes('--accept-quiet'),
    verbose: argv.includes('--verbose'),
  };
}

/**
 * The agent's Base wallet: a CDP server wallet when the CDP keys are set, otherwise a throwaway
 * account made in memory for this run, which holds nothing and is never saved.
 */
async function baseWallet(): Promise<WalletProvider> {
  const { CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET } = process.env;
  const networkId = process.env.NETWORK_ID || 'base-mainnet';
  if (CDP_API_KEY_ID && CDP_API_KEY_SECRET && CDP_WALLET_SECRET) {
    return CdpEvmWalletProvider.configureWithWallet({
      apiKeyId: CDP_API_KEY_ID,
      apiKeySecret: CDP_API_KEY_SECRET,
      walletSecret: CDP_WALLET_SECRET,
      networkId,
      ...(process.env.CDP_WALLET_ADDRESS
        ? { address: process.env.CDP_WALLET_ADDRESS as `0x${string}` }
        : {}),
    });
  }
  console.log('No CDP keys set: using a throwaway Base account for this run (it holds nothing).');
  const client = createWalletClient({
    account: privateKeyToAccount(generatePrivateKey()),
    chain: base,
    transport: http(process.env.BASE_RPC_URL || undefined),
  });
  return new ViemWalletProvider(client);
}

/** Your value-moving step goes here. This stub moves nothing. */
async function act(intent: Intent, token: string, wallet: WalletProvider): Promise<void> {
  console.log(
    `[stub] The agent would now ${intent} (Robinhood Chain token ${token}) from ${wallet.getAddress()} on ${wallet.getNetwork().networkId}. Replace act() with your own action.`,
  );
}

function report(check: HeyCheck, verbose: boolean): void {
  console.log(`HEY: ${check.decision.toUpperCase()}. ${check.reason}`);
  if (check.link) console.log(`Evidence: ${check.link}`);
  if (verbose) console.log(`\n${check.answer}\n`);
  console.log('HEY Research Lab answers are research context, never trading advice.');
}

async function main(): Promise<void> {
  const { token, intent, acceptQuiet, verbose } = parseArgs(process.argv.slice(2));
  const walletProvider = await baseWallet();
  const agentKit = await AgentKit.from({
    walletProvider,
    // Add your own Base action providers beside HEY's; HEY's six actions are read-only.
    actionProviders: [heyResearchActionProvider()],
  });
  console.log(
    `Agent wallet ${walletProvider.getAddress()} on ${walletProvider.getNetwork().networkId}. Checking ${token} on Robinhood Chain with HEY before it ${intent}s.`,
  );

  const check = await checkWithHey(agentKit.getActions(), token, intent);
  report(check, verbose);

  if (check.decision === 'refuse') {
    process.exitCode = 2;
    return;
  }
  if (check.decision === 'warn' && !acceptQuiet) {
    console.log('Not acting: pass --accept-quiet to go ahead after reading the evidence.');
    process.exitCode = 3;
    return;
  }
  await act(intent, token, walletProvider);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
