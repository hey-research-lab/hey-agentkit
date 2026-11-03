/** The package version, sent to HEY as `x-hey-integration: hey-agentkit/<version>`. Held to package.json by a test. */
export const VERSION = '0.2.1';

/** How this integration names itself to HEY (user-agent prefix and `x-hey-integration`). */
export const INTEGRATION = `hey-agentkit/${VERSION}`;
