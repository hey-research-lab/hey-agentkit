/**
 * HEY's answers as plain text for an agent.
 *
 * Every answer leads with HEY's one-line answer, keeps HEY's state words
 * verbatim, prints a missing value as unknown with its reason, names its
 * evidence ids and as-of time, and ends with HEY's link and the attribution
 * line. Market figures are never printed: market status is context, and the
 * figures stay on HEY's market page.
 */
import { valuationWithheldSentence } from '@hey-research-lab/agent-contract';
import type {
  HeyAgentChange,
  HeyAgentEvidenceRef,
  HeyAgentResponse,
  HeyAgentResponseOf,
  HeyChain,
  HeySearchSuggestions,
  HeyTimeline,
  HeyTokenLookup,
} from '@hey-research-lab/sdk';

import { CHAIN_ID, CHAIN_NAME } from './chain.js';
import {
  QUOTE_LEGEND,
  SITE,
  heyWords,
  lines,
  orUnknown,
  projectUrl,
  quote,
  say,
  sourceLine,
  when,
} from './text.js';

const CHAIN = `${CHAIN_NAME} (${CHAIN_ID})`;
const MAX_CLAIMS = 12;
const MAX_UNKNOWNS = 12;
const MAX_EVIDENCE = 8;
const MAX_RECENT = 5;

function evidenceLine(refs: readonly HeyAgentEvidenceRef[]): string {
  return refs.length === 0 ? 'no evidence id' : `evidence ${refs.map((r) => r.id).join(', ')}`;
}

/** One change from the ledger: when, what, whether it counts as building, its evidence. */
function changeLine(change: HeyAgentChange): string {
  const dated = change.occurredAt
    ? `${change.occurredAt} (${change.precision})`
    : `detected ${change.detectedAt} (no source date)`;
  const counts = change.countsAsBuilding ? 'counts as building' : 'context, not building';
  const verification = change.verification ? ` · ${heyWords(change.verification)}` : '';
  return `- ${dated} [${heyWords(change.type)}, ${change.status}] ${say(change.summary)} — ${counts}${verification} · ${evidenceLine(change.evidence)} · ${change.project.url}`;
}

/** The parts every agent answer shares: unknowns, freshness, evidence, as-of, HEY's note. */
function envelopeTail(response: HeyAgentResponse, link: string): string[] {
  const out: string[] = [];
  if (response.unknowns.length > 0) {
    out.push(
      `Unknowns (${response.unknowns.length}) — HEY does not know these; a missing value is not negative evidence:`,
    );
    for (const gap of response.unknowns.slice(0, MAX_UNKNOWNS)) {
      out.push(
        `- ${gap.category} · ${heyWords(gap.dimension)}: ${say(gap.statement)} Do not conclude: ${say(gap.doNotConclude)}`,
      );
    }
    if (response.unknowns.length > MAX_UNKNOWNS) {
      out.push(`- ${response.unknowns.length - MAX_UNKNOWNS} more at ${response.links.self}`);
    }
  } else {
    out.push('Unknowns: HEY listed none for this answer.');
  }
  if (response.freshness.length > 0) {
    out.push(
      `Freshness: ${response.freshness
        .map((f) => `${f.family} ${f.freshnessStatus} (data as of ${when(f.dataAsOf)})`)
        .join('; ')}`,
    );
  }
  if (response.evidence.length > 0) {
    out.push(`Evidence (${response.evidence.length}, each a receipt on HEY):`);
    for (const ref of response.evidence.slice(0, MAX_EVIDENCE)) {
      out.push(
        `- ${ref.id} → ${ref.receiptUrl}${ref.sourceUrl ? ` (source ${ref.sourceUrl})` : ''}`,
      );
    }
    if (response.evidence.length > MAX_EVIDENCE) {
      out.push(`- ${response.evidence.length - MAX_EVIDENCE} more at ${response.links.self}`);
    }
  }
  for (const disclosure of response.disclosures ?? []) {
    out.push(`Disclosure (${disclosure.code}): ${say(disclosure.statement)}`);
  }
  out.push(
    `As of: ${response.asOf}${response.citation ? ` · cite: ${response.citation.url}` : ''}`,
    `HEY's note: ${say(response.boundaries.disclaimer)}`,
    QUOTE_LEGEND,
    sourceLine(link),
  );
  return out;
}

/** An agent answer HEY refused (`not_found`, `moved`, `invalid_request`, `unavailable`). */
export function renderRefusal(response: HeyAgentResponse): string {
  const code = response.error?.code ?? response.status;
  const message = response.error ? say(response.error.message) : say(response.answer);
  const moved = response.error?.movedTo
    ? ` The project moved to the slug "${heyWords(response.error.movedTo)}"; ask again with it.`
    : '';
  const hint =
    response.status === 'not_found'
      ? ' Try find_projects with a name, ticker or contract address to get the right slug.'
      : '';
  return lines(
    `Error (${heyWords(code)}): HEY could not answer — ${message}${moved}${hint}`,
    sourceLine(response.links.page ?? SITE),
  );
}

export function renderResearch(response: HeyAgentResponseOf<'research_project'>): string {
  const data = response.data;
  const slug = data?.identity.slug ?? response.subject?.project?.slug ?? response.query.project;
  const link = slug ? projectUrl(slug) : SITE;
  if (!data) {
    return lines(
      `HEY research on ${CHAIN}`,
      `Answer (${response.answerStatus}): ${say(response.answer)}`,
      'Details: HEY sent no research data with this answer.',
      envelopeTail(response, link),
    );
  }
  const { identity, builderState: b } = data;
  const symbol = identity.symbol ? ` ${say(identity.symbol)}` : '';
  const narrative = identity.narrative ? ` · narrative ${say(identity.narrative.name)}` : '';
  const out: string[] = [
    `HEY research: ${say(identity.name)}${symbol} — ${identity.slug} on ${CHAIN}`,
    `Answer (${response.answerStatus}): ${say(response.answer)}`,
    `Project: kind ${heyWords(identity.projectKind)} · research level ${heyWords(identity.researchLevel)}${narrative} · first recorded by HEY ${identity.firstRecordedByHeyAt}`,
    'Builder state (development evidence only, never price):',
    `- Activity status: ${heyWords(b.activityStatus)} (measured: ${orUnknown(b.activityMeasured)})`,
    `- Last meaningful ship: ${b.lastMeaningfulShipAt ?? "not on HEY's record"}`,
    `- Meaningful events in 30 days: ${orUnknown(b.meaningfulEvents30d, null, 'not measured')}`,
    `- Build Momentum (0–100): ${orUnknown(b.buildMomentum, b.buildMomentumReason, 'not measured')}`,
    `- Still Building: ${b.stillBuildingState ?? (b.stillBuilding ? 'HELD' : 'unknown')}${b.stillBuildingWithheld ? ` — ${heyWords(b.stillBuildingWithheld)}` : ''} (verified building through a market drawdown HEY tracked; not a signal about price)`,
    `- Scoring version: ${orUnknown(b.scoringVersion)} · why: ${b.explainUrl}`,
  ];

  if (data.latestMeaningfulChange) {
    out.push('Latest meaningful change:', changeLine(data.latestMeaningfulChange));
  } else {
    out.push(
      `Latest meaningful change: not listed${data.latestMeaningfulChangeReason ? ` — ${heyWords(data.latestMeaningfulChangeReason)}` : ''}`,
    );
  }

  if (data.recentChanges.available) {
    const shown = data.recentChanges.items.slice(0, MAX_RECENT);
    out.push(
      `Recent changes (${shown.length} of ${data.recentChanges.items.length} listed; more at ${data.recentChanges.url}):`,
    );
    out.push(...shown.map(changeLine));
  } else {
    out.push(
      `Recent changes: unknown${data.recentChanges.reason ? ` — ${heyWords(data.recentChanges.reason)}` : ''}`,
    );
  }

  if (response.claims.length > 0) {
    out.push(`Claims (${response.claims.length}; FACT, DERIVED or UNKNOWN as HEY tags them):`);
    for (const claim of response.claims.slice(0, MAX_CLAIMS)) {
      const context = claim.contextOnly ? ' · context only' : '';
      const reason = claim.reason ? ` · reason ${heyWords(claim.reason)}` : '';
      out.push(
        `- [${claim.status}] ${heyWords(claim.dimension)}: ${say(claim.statement)} (freshness ${claim.freshness}${context}${reason})`,
      );
    }
    if (response.claims.length > MAX_CLAIMS) {
      out.push(`- ${response.claims.length - MAX_CLAIMS} more at ${response.links.self}`);
    }
  }

  const token = data.contractIdentity.token;
  out.push(
    token
      ? `Token: ${token.chainId}:${token.address} · token verification ${orUnknown(token.verification)}${token.verificationReason ? ` (${heyWords(token.verificationReason)})` : ''} · contracts: ${data.contractIdentity.contractsUrl}`
      : `Token: none recorded for this project on HEY · contracts: ${data.contractIdentity.contractsUrl}`,
  );

  const market = data.marketContext;
  if (market) {
    const withheld = market.valuationWithheld
      ? ` ${valuationWithheldSentence(market.valuationWithheld)}`
      : '';
    out.push(
      `Market context (context only, never builder evidence, not advice): token market status ${orUnknown(market.tokenMarketStatus)}.${withheld} Figures with their sources: ${market.url}`,
    );
  }
  if (data.usageContext) {
    out.push(
      `Usage context (context only): ${heyWords(data.usageContext.state)} — ${heyWords(data.usageContext.reason)} · ${data.usageContext.url}`,
    );
  }

  out.push(...envelopeTail(response, link));
  return out.join('\n');
}

export function renderWhatChanged(response: HeyAgentResponseOf<'what_changed'>): string {
  const data = response.data;
  const slug = response.subject?.project?.slug ?? response.query.project;
  const link = slug ? projectUrl(slug) : `${SITE}/updates`;
  if (!data) {
    return lines(
      `What changed on ${CHAIN}`,
      `Answer (${response.answerStatus}): ${say(response.answer)}`,
      'Details: HEY sent no change data with this answer.',
      envelopeTail(response, link),
    );
  }
  const scope = data.scope === 'project' && slug ? `project ${slug}` : 'all of Robinhood Chain';
  const building =
    data.countsAsBuilding === undefined ? '' : ` (${data.countsAsBuilding} count as building)`;
  const out: string[] = [
    `What changed on ${CHAIN} — ${scope}, last ${data.window.days} days (${data.window.from} to ${data.window.to})`,
    `Answer (${response.answerStatus}): ${say(response.answer)}`,
    `Total in the window: ${data.total}${building} · listed here: ${data.shown}`,
  ];
  if (data.byType.length > 0) {
    out.push(`By type: ${data.byType.map((t) => `${heyWords(t.type)} ${t.count}`).join(', ')}`);
  }
  if (data.items.length > 0) {
    out.push('Changes, newest first:', ...data.items.map(changeLine));
  } else {
    out.push("Changes: HEY's ledger holds none in this window.");
  }
  out.push(
    `All changes in the window: ${data.more}`,
    `Ledger: newest recorded ${when(data.ledger.newestRecordedAt)} · collecting since ${when(data.ledger.collectionStart)}`,
  );
  out.push(...envelopeTail(response, link));
  return out.join('\n');
}

export function renderSearch(result: HeySearchSuggestions, query: string): string {
  const link = `${SITE}/search?q=${encodeURIComponent(query)}`;
  const out: string[] = [`HEY search on ${CHAIN} for ${quote(query)}`];
  if (result.suggestions.length === 0) {
    out.push(
      "HEY's search index holds no project, launch record or issuer token matching this. That is a reading of HEY's index, not a finding about the project.",
    );
  } else {
    out.push(`Matches (${result.suggestions.length}, at most eight):`);
    for (const s of result.suggestions) {
      const symbol = s.symbol ? ` ${quote(s.symbol)}` : '';
      if (s.type === 'project') {
        const slug = s.target.startsWith('/project/') ? s.target.slice('/project/'.length) : null;
        const contract = s.contract ? ` · contract ${s.contract.toLowerCase()}` : '';
        const same = s.sameNameDifferentContract
          ? ' · another project shares this name or ticker on a different contract: identify it by contract address, not ticker'
          : '';
        const empty = s.emptyNamesake
          ? ' · a page with no token, ship or builder signal recorded that shares its name with a fuller match'
          : '';
        out.push(
          `- Project ${quote(s.name)}${symbol}${slug ? ` · slug ${slug}` : ''}${contract}${same}${empty} → ${SITE}${s.target}`,
        );
      } else if (s.type === 'launch') {
        const notice = s.brandNotice ? ` · ${heyWords(s.brandNotice.title)}` : '';
        out.push(
          `- Launch record ${quote(s.name)}${symbol} · contract ${s.contract.toLowerCase()} · launched via ${quote(s.launchedVia)} · not a published project: HEY has not researched it${notice} → ${SITE}${s.target}`,
        );
      } else {
        out.push(
          `- Issuer token ${quote(s.name)}${symbol} · contract ${s.contract.toLowerCase()} · ${heyWords(s.label)} · never a project → ${SITE}${s.target}`,
        );
      }
    }
    if (result.moreLaunchRecords) {
      out.push(`HEY may hold more launch records matching this: ${link}`);
    }
    out.push('Next: research a project with research_project and its slug.');
  }
  out.push(QUOTE_LEGEND, sourceLine(link));
  return out.join('\n');
}

export function renderToken(result: HeyTokenLookup): string {
  const address = result.contractAddress.toLowerCase();
  const out: string[] = [`HEY token lookup: ${address} on ${CHAIN}`];
  const project = result.project;
  if (result.status !== 'published' || !project) {
    if (result.issuer) {
      out.push(`Issuer token: ${heyWords(result.issuer.sentence)} It is never a project on HEY.`);
    } else {
      out.push(
        "HEY has no published project for this address. That is HEY's record, not a finding about the token or whoever launched it.",
      );
    }
    out.push(
      `Read the chain about this address with HEY Scan: ${result.scanUrl}`,
      `HEY's note: ${heyWords(result.disclaimer)}`,
      sourceLine(result.scanUrl),
    );
    return out.join('\n');
  }
  const link = projectUrl(project.slug);
  const symbol = project.symbol ? ` ${quote(project.symbol)}` : '';
  const applies = project.activityAppliesToToken
    ? 'yes'
    : "no — on MISMATCH the project's own site names a different contract, so the activity below is the project's, not this token's";
  out.push(
    `Published project: ${quote(project.name)}${symbol} · slug ${project.slug}`,
    `Activity status: ${heyWords(project.activityStatus)} — ${heyWords(project.activityLabel)}: ${heyWords(project.activityHelp)}`,
    `Activity measured: ${orUnknown(project.activityMeasured)}`,
    `Meaningful ships in 30 days: ${
      project.activityMeasured
        ? orUnknown(project.meaningfulShipsLast30Days, null, 'not measured')
        : 'not measured — HEY has no builder source it can read for this project'
    }`,
    project.lastShip
      ? `Last ship: ${project.lastShip.publishedAt} ${quote(project.lastShip.title)}${project.lastShip.sourceUrl ? ` (source ${project.lastShip.sourceUrl})` : ''}`
      : `Last ship: ${project.lastShipAt ?? "not on HEY's record"}`,
    `Research level: ${orUnknown(project.researchLevel)}`,
    `Token verification: ${project.tokenVerification.status}${project.tokenVerification.reason ? ` (${heyWords(project.tokenVerification.reason)})` : ''} — whether the project itself names this contract`,
    `Activity applies to this token: ${applies}`,
    `As of: ${when(project.asOf)}`,
    `Next: research_project with the slug ${project.slug} for the evidence, unknowns and changes.`,
    `HEY's note: ${heyWords(result.disclaimer)}`,
    QUOTE_LEGEND,
    sourceLine(link),
  );
  return out.join('\n');
}

export function renderTimeline(timeline: HeyTimeline): string {
  const link = projectUrl(timeline.project.slug);
  const t = timeline.totals;
  const out: string[] = [
    `HEY timeline: ${quote(timeline.project.name)} — ${timeline.project.slug} on ${CHAIN}, lens ${heyWords(timeline.lens)}, newest first`,
    `Listed: ${timeline.items.length} of ${timeline.total}${timeline.truncated ? ' (older entries exist)' : ''} · totals: ships ${t.ships}, contract source ${t.contractSource}, locks ${t.locks}, resumed ${t.resumed}, verification ${t.verification}, market integrity ${t.marketIntegrity}`,
  ];
  if (timeline.items.length === 0) {
    out.push("Entries: HEY's timeline holds none in this lens.");
  }
  for (const entry of timeline.items) {
    const counts = entry.countsAsBuilding ? 'counts as building' : 'context, not building';
    const verification = entry.verification ? ` · ${heyWords(entry.verification)}` : '';
    const source = entry.source ? ` · source ${heyWords(entry.source)}` : '';
    const substance = entry.codeSubstance ? ` · code substance ${entry.codeSubstance.verdict}` : '';
    out.push(
      `- ${entry.at} (${entry.precision}) [${heyWords(entry.kind)}] ${quote(entry.title)} — ${counts}${verification}${substance}${source} · id ${heyWords(entry.id)}`,
    );
  }
  if (timeline.nextCursor) {
    out.push(`Older entries: ${link} (the API pages with before=${heyWords(timeline.nextCursor)})`);
  }
  out.push(
    'Market moves around an entry are context on HEY, never a cause, and are not listed here.',
    `HEY's note: ${heyWords(timeline.disclaimer)}`,
    QUOTE_LEGEND,
    sourceLine(link),
  );
  return out.join('\n');
}

function count(value: number | undefined, noun: string): string {
  return `${noun} ${value === undefined ? 'not measured' : value}`;
}

export function renderChain(chain: HeyChain): string {
  const out: string[] = [
    `HEY on ${CHAIN}: day by day (UTC), aggregates only, oldest first`,
    'Building (HEY records it on the day it learns it):',
  ];
  for (const day of chain.days) {
    const partial = day.day === chain.today ? ' (today, in progress)' : '';
    out.push(
      `- ${day.day}${partial}: ${[
        count(day.ships, 'ships'),
        count(day.buildersShipping, 'builders shipping'),
        count(day.buildersVerified, 'builders verified'),
        count(day.projectsPublished, 'projects published'),
      ].join(' · ')}`,
    );
  }
  out.push('Chain activity (counts, not attention or price):');
  for (const day of chain.days) {
    const basis = day.basis.chain ? ` [${day.basis.chain}]` : ' [no chain reading]';
    const backfill = day.launchesBackfill ? ' (a backfill day, not that day’s launches)' : '';
    out.push(
      `- ${day.day}${basis}: ${[
        count(day.transactions, 'transactions'),
        count(day.transfers, 'transfers'),
        `${count(day.launches, 'tokens first recorded')}${backfill}`,
      ].join(' · ')}`,
    );
  }
  out.push(
    `Last full day: ${when(chain.lastFullDay)}`,
    `About launches: ${heyWords(chain.launchesNote)}`,
    `HEY's note: ${heyWords(chain.disclaimer)}`,
    sourceLine(`${SITE}/pulse`),
  );
  return out.join('\n');
}
