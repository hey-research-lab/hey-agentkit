/**
 * The input schemas of the six actions. Field descriptions are what a model
 * reads when it fills the arguments, so they say what each value is and
 * where to get it. Format checks (slug, address, chain) are made inside the
 * action, so a wrong value comes back as a sentence the agent can act on.
 */
import { z } from 'zod';

const chainId = z
  .number()
  .int()
  .optional()
  .describe(
    'Optional. Robinhood Chain only: 4663 (the default). Any other chain id is refused with unsupported_chain.',
  );

const project = z
  .string()
  .describe(
    'The project\'s HEY slug, lowercase letters, digits and hyphens (e.g. "musepass-musepass"). Get it from find_projects or lookup_token when you only have a name, ticker or contract address.',
  );

export const ResearchProjectSchema = z
  .object({ project, chainId })
  .strip()
  .describe('Research one Robinhood Chain project on HEY.');

export const FindProjectsSchema = z
  .object({
    query: z
      .string()
      .describe(
        'A project name, ticker (with or without $) or 0x contract address on Robinhood Chain, 2–64 characters.',
      ),
    chainId,
  })
  .strip()
  .describe('Search HEY for Robinhood Chain projects.');

export const LookupTokenSchema = z
  .object({
    address: z
      .string()
      .describe('A Robinhood Chain token or contract address: 0x followed by 40 hex characters.'),
    chainId,
  })
  .strip()
  .describe('Look up which HEY project, if any, a Robinhood Chain token address belongs to.');

export const WhatChangedSchema = z
  .object({
    project: project
      .optional()
      .describe(
        "Optional. A project's HEY slug to narrow the window to one project; omit it for all of Robinhood Chain.",
      ),
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe('Optional. The window in days, 1–30; HEY uses 7 when omitted.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe(
        'Optional. How many changes to list, 1–50; HEY uses 25 when omitted. Totals are always complete.',
      ),
    buildingOnly: z
      .boolean()
      .optional()
      .describe(
        'Optional. true lists only changes that count as building (ships, releases, deployments), leaving context such as market or source changes out.',
      ),
    chainId,
  })
  .strip()
  .describe("What changed on Robinhood Chain in HEY's change ledger.");

export const ProjectTimelineSchema = z
  .object({
    project,
    lens: z
      .enum(['build', 'code', 'onchain', 'locks', 'everything'])
      .optional()
      .describe(
        'Optional. Which evidence to list: build (ships and releases, the default), code, onchain, locks or everything.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Optional. How many entries, newest first, 1–50 (default 10).'),
    chainId,
  })
  .strip()
  .describe("One Robinhood Chain project's ships and evidence, newest first.");

export const ChainOverviewSchema = z
  .object({
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe(
        'Optional. How many UTC days, 1–30 (default 7); the newest day is still in progress.',
      ),
    chainId,
  })
  .strip()
  .describe("Robinhood Chain day by day in HEY's record.");

export type ResearchProjectArgs = z.infer<typeof ResearchProjectSchema>;
export type FindProjectsArgs = z.infer<typeof FindProjectsSchema>;
export type LookupTokenArgs = z.infer<typeof LookupTokenSchema>;
export type WhatChangedArgs = z.infer<typeof WhatChangedSchema>;
export type ProjectTimelineArgs = z.infer<typeof ProjectTimelineSchema>;
export type ChainOverviewArgs = z.infer<typeof ChainOverviewSchema>;
