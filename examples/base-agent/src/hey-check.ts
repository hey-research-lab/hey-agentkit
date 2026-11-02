/**
 * The check a Base agent runs before it acts on a Robinhood Chain token.
 *
 * It calls HEY's research_project action through AgentKit with the token's contract address and
 * turns the answer into proceed, warn or refuse. The decision is made here, in code, from the
 * fields `readResearchAnswer` reads out of HEY's answer: a model is never asked to read the status
 * for us, because text that reaches a model can steer it (AgentKit's README says the same).
 *
 * HEY's answer is research context about whether a project is still building, with sources. It is
 * never trading advice, a safety verdict or a view on the token's price, and neither is this check.
 */
import type { Action } from '@coinbase/agentkit';
import { readResearchAnswer } from '@hey-research-lab/agentkit';

export const RESEARCH_ACTION = 'HeyResearchActionProvider_research_project';

/** What the agent was about to do with the token. It changes the wording only, never the rule. */
export type Intent = 'trade' | 'bridge' | 'fund';

export type HeyDecision = 'proceed' | 'warn' | 'refuse';

export type HeyCheck = {
  decision: HeyDecision;
  /** One plain sentence: what HEY read, and why that is the decision. */
  reason: string;
  /** HEY's activity status, verbatim, or null when HEY gave none. */
  activityStatus: string | null;
  slug: string | null;
  lastMeaningfulShipAt: string | null;
  /** The heyresearch.xyz page to read the evidence on. */
  link: string | null;
  /** HEY's full answer, with its sources and evidence ids, for the log or the model. */
  answer: string;
};

/** Building HEY can see: SHIPPING, ACTIVE, or RESUMED after a quiet spell. */
const PROCEED = new Set(['SHIPPING', 'ACTIVE', 'RESUMED']);
/** Little building lately: the agent warns and needs an explicit go-ahead. */
const WARN = new Set(['QUIET']);

/** Ask HEY about the project behind a Robinhood Chain token, then decide. */
export async function checkWithHey(
  actions: readonly Action[],
  token: string,
  intent: Intent,
): Promise<HeyCheck> {
  const research = actions.find((action) => action.name === RESEARCH_ACTION);
  if (!research) {
    throw new Error(
      'HEY is not among this agent’s actions: add heyResearchActionProvider() to AgentKit.from.',
    );
  }
  const answer = await research.invoke({ address: token });
  return decide(answer, intent);
}

/** The rule, on HEY's rendered answer. Anything HEY could not answer fails closed. */
export function decide(answer: string, intent: Intent): HeyCheck {
  const read = readResearchAnswer(answer);
  const before = `before you ${intent === 'fund' ? 'fund it' : intent === 'bridge' ? 'bridge to it' : 'trade its token'}`;

  if (!read.ok) {
    const reason =
      read.code === 'not_published' || read.code === 'not_found'
        ? `HEY holds no published project for this token, so there is no building record to check ${before}. That is a statement about HEY's index, not about the token.`
        : read.code === 'ambiguous'
          ? `More than one project matches; HEY picks none (${read.candidates.join(', ')}). Ask again with the token's contract address.`
          : `HEY could not answer (${read.code}), so the check fails closed. Try again later.`;
    return {
      decision: 'refuse',
      reason,
      activityStatus: null,
      slug: null,
      lastMeaningfulShipAt: null,
      link: read.link,
      answer,
    };
  }

  const status = read.activityStatus;
  const project = read.slug ?? 'this project';
  const lastShip = read.lastMeaningfulShipAt
    ? `last meaningful ship ${read.lastMeaningfulShipAt.slice(0, 10)}`
    : 'no meaningful ship on HEY’s record';
  const base = {
    activityStatus: status,
    slug: read.slug,
    lastMeaningfulShipAt: read.lastMeaningfulShipAt,
    link: read.link,
    answer,
  };

  if (status && PROCEED.has(status)) {
    return {
      ...base,
      decision: 'proceed',
      reason: `HEY reads ${project} as ${status}, ${lastShip}. That is a record of building, not a view on the token.`,
    };
  }
  if (status && WARN.has(status)) {
    return {
      ...base,
      decision: 'warn',
      reason: `HEY reads ${project} as QUIET, ${lastShip}: no meaningful updates for over a month. Read the evidence ${before}.`,
    };
  }
  if (status === 'DORMANT') {
    return {
      ...base,
      decision: 'refuse',
      reason: `HEY reads ${project} as DORMANT, ${lastShip}: no meaningful updates observed for a long time (not the same as abandoned). Read the evidence ${before}.`,
    };
  }
  return {
    ...base,
    decision: 'refuse',
    reason: `HEY has not measured ${project}'s building (${status ?? 'no status'}); its answer says why. Unknown is not quiet, and it is not a reason to go ahead either.`,
  };
}
