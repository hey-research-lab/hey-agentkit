/**
 * HEY Research Lab as a Coinbase AgentKit action provider.
 *
 * Six read-only actions, each one read of HEY's public API through the
 * published SDK. None takes the wallet provider, so none can sign, send or
 * read a balance: the provider works beside any wallet on any network, and
 * every answer is about Robinhood Chain (4663) only.
 */
import {
  ActionProvider,
  CreateAction,
  type Network,
  type WalletProvider,
} from '@coinbase/agentkit';
import { safeParseAgentResponse } from '@hey-research-lab/agent-contract';
import type { HeyAgentCapability, HeyAgentResponseOf, HeyClient } from '@hey-research-lab/sdk';

import { assertChainId, CHAIN_ID } from './chain.js';
import { createClient, type HeyResearchConfig } from './client.js';
import { describeError, InputError } from './errors.js';
import { isAddress } from './evm.js';
import {
  renderChain,
  renderRefusal,
  renderResearch,
  renderSearch,
  renderTimeline,
  renderToken,
  renderWhatChanged,
} from './render.js';
import {
  ChainOverviewSchema,
  FindProjectsSchema,
  LookupTokenSchema,
  ProjectTimelineSchema,
  ResearchProjectSchema,
  WhatChangedSchema,
  type ChainOverviewArgs,
  type FindProjectsArgs,
  type LookupTokenArgs,
  type ProjectTimelineArgs,
  type ResearchProjectArgs,
  type WhatChangedArgs,
} from './schemas.js';

/** HEY's request rule for a project slug. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** The words every description ends with: what the answer is, and what it never is. */
const BOUNDARY =
  'Read-only: no wallet, no transaction, nothing signed. The answer is HEY Research Lab evidence with provenance (evidence ids, as-of time, a heyresearch.xyz link) — not price advice, not a safety verdict, and unknown stays unknown.';

export const ACTION_DESCRIPTIONS = {
  research_project: `Research one Robinhood Chain project on HEY Research Lab: is it still building, what did it ship and when (last meaningful ship), how much meaningful building in 30 days, its Build Momentum and Still Building state, the newest changes, what HEY verified about its token contract, and what HEY does not know (unknowns, each with what not to conclude). Input: the project's HEY slug — get it first with find_projects (name or ticker) or lookup_token (contract address). Market data appears only as context. ${BOUNDARY}`,
  find_projects: `Find Robinhood Chain projects on HEY Research Lab by name, ticker ($TICKER) or 0x contract address. Returns up to eight matches, each with its HEY slug, contract and link, and says which are published projects, which are only launch records HEY has not researched, and which are an issuer's token. A ticker is not identity: when two projects share a name or ticker, identify them by contract address. Use it before research_project or project_timeline. ${BOUNDARY}`,
  lookup_token: `Look up a Robinhood Chain token or contract address (0x…) on HEY Research Lab: which published project it belongs to, whether that project is still building (activity status, last ship, meaningful ships in 30 days), whether the project itself names this contract (token verification), and HEY's link. An address HEY has no project for is reported as such, which is not a finding about the token. ${BOUNDARY}`,
  what_changed: `What changed on Robinhood Chain recently, from HEY Research Lab's change ledger: ships, releases, contract deployments and upgrades, activity-status moves, sources added, for all of Robinhood Chain or one project (by slug), over the last 1–30 days. Gives the true total in the window, how many count as building, counts by type, and the newest changes with their dates, precision and evidence ids. ${BOUNDARY}`,
  project_timeline: `One Robinhood Chain project's recent ships and evidence timeline on HEY Research Lab, newest first: releases, weekly code activity, deployments and other evidence, each with its date and precision, whether it counts as building, its verification state (self-reported stays distinct from verified) and its source. Input: the project's HEY slug (from find_projects). ${BOUNDARY}`,
  chain_overview: `Robinhood Chain day by day from HEY Research Lab: ships recorded, builders shipping, builders verified and projects published each UTC day, beside chain activity counts (transactions, transfers, tokens first recorded). Aggregates only, for the last 1–30 days; the newest day is still in progress. ${BOUNDARY}`,
} as const;

function checkChain(chainId: number | undefined): void {
  assertChainId(chainId ?? CHAIN_ID);
}

function checkSlug(value: string): string {
  const slug = value.trim();
  if (!SLUG_RE.test(slug)) {
    throw new InputError(
      'invalid_project_slug',
      `"${slug.slice(0, 80)}" is not a HEY project slug (lowercase letters, digits and hyphens, at most 80 characters). Use find_projects with the name, ticker or contract address to get the slug.`,
    );
  }
  return slug;
}

function checkAddress(value: string): string {
  const raw = value.trim();
  // Agent input: a "0X" prefix is accepted and normalised, as the ecosystem's CLI and bot do.
  const candidate = /^0X/.test(raw) ? `0x${raw.slice(2)}` : raw;
  if (!isAddress(candidate)) {
    throw new InputError(
      'invalid_address',
      'A Robinhood Chain address is 0x followed by 40 hexadecimal characters.',
    );
  }
  return candidate.toLowerCase();
}

/** An agent answer, checked against HEY's agent contract before it is rendered. */
async function agentAnswer<C extends HeyAgentCapability>(
  answer: Promise<HeyAgentResponseOf<C>>,
  render: (response: HeyAgentResponseOf<C>) => string,
): Promise<string> {
  const response = await answer;
  const checked = safeParseAgentResponse(response, { allowUnknownFields: true });
  if (!checked.success) {
    return `Error (${checked.error.code}): HEY's answer did not match its agent contract: ${checked.error.message}`;
  }
  return response.status === 'ok' ? render(response) : renderRefusal(response);
}

/**
 * HEY Research Lab's AgentKit action provider. Construct it with
 * `heyResearchActionProvider()`; AgentKit prefixes each action with the class
 * name, so the tools are `HeyResearchActionProvider_research_project` and so on.
 */
export class HeyResearchActionProvider extends ActionProvider<WalletProvider> {
  private readonly client: HeyClient;

  constructor(config: HeyResearchConfig = {}) {
    super('hey_research', []);
    this.client = createClient(config);
  }

  @CreateAction({
    name: 'research_project',
    description: ACTION_DESCRIPTIONS.research_project,
    schema: ResearchProjectSchema,
  })
  async researchProject(args: ResearchProjectArgs): Promise<string> {
    try {
      checkChain(args.chainId);
      const project = checkSlug(args.project);
      return await agentAnswer(
        this.client.agent.answer('research_project', { project }),
        renderResearch,
      );
    } catch (error) {
      return describeError(error);
    }
  }

  @CreateAction({
    name: 'find_projects',
    description: ACTION_DESCRIPTIONS.find_projects,
    schema: FindProjectsSchema,
  })
  async findProjects(args: FindProjectsArgs): Promise<string> {
    try {
      checkChain(args.chainId);
      const query = args.query.trim();
      if (Array.from(query).length < 2 || Array.from(query).length > 64) {
        throw new InputError('invalid_query', 'The search takes 2–64 characters.');
      }
      return renderSearch(await this.client.search.suggest(query), query);
    } catch (error) {
      return describeError(error);
    }
  }

  @CreateAction({
    name: 'lookup_token',
    description: ACTION_DESCRIPTIONS.lookup_token,
    schema: LookupTokenSchema,
  })
  async lookupToken(args: LookupTokenArgs): Promise<string> {
    try {
      checkChain(args.chainId);
      const address = checkAddress(args.address);
      return renderToken(await this.client.token.lookup(CHAIN_ID, address));
    } catch (error) {
      return describeError(error);
    }
  }

  @CreateAction({
    name: 'what_changed',
    description: ACTION_DESCRIPTIONS.what_changed,
    schema: WhatChangedSchema,
  })
  async whatChanged(args: WhatChangedArgs): Promise<string> {
    try {
      checkChain(args.chainId);
      const project = args.project === undefined ? undefined : checkSlug(args.project);
      return await agentAnswer(
        this.client.agent.answer('what_changed', {
          ...(project ? { project } : {}),
          ...(args.days !== undefined ? { days: args.days } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
          ...(args.buildingOnly ? { building: 'only' as const } : {}),
        }),
        renderWhatChanged,
      );
    } catch (error) {
      return describeError(error);
    }
  }

  @CreateAction({
    name: 'project_timeline',
    description: ACTION_DESCRIPTIONS.project_timeline,
    schema: ProjectTimelineSchema,
  })
  async projectTimeline(args: ProjectTimelineArgs): Promise<string> {
    try {
      checkChain(args.chainId);
      const project = checkSlug(args.project);
      return renderTimeline(
        await this.client.projects.timeline(project, {
          lens: args.lens ?? 'build',
          limit: args.limit ?? 10,
        }),
      );
    } catch (error) {
      return describeError(error);
    }
  }

  @CreateAction({
    name: 'chain_overview',
    description: ACTION_DESCRIPTIONS.chain_overview,
    schema: ChainOverviewSchema,
  })
  async chainOverview(args: ChainOverviewArgs): Promise<string> {
    try {
      checkChain(args.chainId);
      return renderChain(await this.client.chain({ days: args.days ?? 7 }));
    } catch (error) {
      return describeError(error);
    }
  }

  /** HEY is read over HTTPS, whatever network the wallet is on. */
  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

/** HEY Research Lab's action provider for AgentKit. `apiKey` is optional (default: `HEY_API_KEY`). */
export const heyResearchActionProvider = (
  config: HeyResearchConfig = {},
): HeyResearchActionProvider => new HeyResearchActionProvider(config);
