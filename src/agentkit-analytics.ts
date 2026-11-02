/**
 * A narrow guard for one AgentKit 0.10.x behaviour, opt-in for the host.
 *
 * AgentKit's `@CreateAction` wrapper (every action, any provider) and every wallet provider's
 * constructor start an analytics POST to Coinbase without awaiting it. When that request fails
 * (a non-2xx answer or no network), the promise rejects with nobody to catch it, and Node 15+
 * ends the process on an unhandled rejection. Upstream: coinbase/agentkit#1531 (open), and
 * #1408 for the wallet-provider half only.
 *
 * `guardAgentKitAnalytics()` installs one `unhandledRejection` listener that ignores exactly
 * those rejections (an Error whose stack runs through AgentKit's `sendAnalyticsEvent`) and keeps
 * Node's default for everything else: any other unhandled rejection is raised again as an
 * uncaught exception, unless the host already listens for unhandled rejections itself, in which
 * case the host's own listener decides. It never touches the request, never sends anything and
 * never reads the wallet. Remove it once AgentKit handles the rejection.
 */

const ANALYTICS_FRAME = 'sendAnalyticsEvent';

/** True for the rejection AgentKit's unawaited analytics request produces, and nothing else. */
export function isAgentKitAnalyticsFailure(reason: unknown): boolean {
  return reason instanceof Error && typeof reason.stack === 'string'
    ? reason.stack.includes(ANALYTICS_FRAME)
    : false;
}

export type AgentKitAnalyticsGuardOptions = {
  /** Called with each ignored rejection, e.g. to log it once. Default: nothing. */
  onIgnored?: (reason: Error) => void;
};

let installed: ((reason: unknown) => void) | undefined;

/**
 * Install the guard (once per process; a second call returns the same remover). Returns a
 * function that removes it.
 */
export function guardAgentKitAnalytics(options: AgentKitAnalyticsGuardOptions = {}): () => void {
  const remove = (): void => {
    if (installed) process.off('unhandledRejection', installed);
    installed = undefined;
  };
  if (installed) return remove;
  const listener = (reason: unknown): void => {
    if (isAgentKitAnalyticsFailure(reason)) {
      options.onIgnored?.(reason as Error);
      return;
    }
    // Someone else listens too: leave the decision to them, as Node would.
    if (process.listenerCount('unhandledRejection') > 1) return;
    throw reason instanceof Error ? reason : new Error(`Unhandled rejection: ${String(reason)}`);
  };
  installed = listener;
  process.on('unhandledRejection', listener);
  return remove;
}
