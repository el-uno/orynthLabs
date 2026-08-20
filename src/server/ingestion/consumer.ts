import type { GitHubIssue } from "@/server/clients/github";
import type { ObservedSignal, SignalSeverity } from "@/lib/types";

export const CONSUMER_SOURCE = "github-issues";
export const DEFAULT_WINDOW_DAYS = 30;

/**
 * Consumer evidence: what a product's *own users* say about it.
 *
 * Same API as the builder family, entirely different evidence. Commits are
 * what the team does; issues are what users experience — "where existing
 * products fail users", in the thesis's words. The family a signal belongs to
 * is decided by meaning, never by which API produced it.
 *
 * Note the sign convention does NOT invert here, unlike `market_structure`.
 * That family measures *competitors*, so their absence is good news. This one
 * measures the entity's own users, so being ignored is simply bad.
 */

/** Below this many issues, shares and ratios are noise rather than evidence. */
export const MIN_ISSUES_FOR_RATIOS = 5;

const BUG_LABELS = ["bug", "defect", "regression", "broken", "error"];
const FEATURE_LABELS = ["enhancement", "feature", "feature request", "proposal", "idea"];

export type ConsumerInput = {
  owner: string;
  repo: string;
  /** One page of recent issues, used for ratios. */
  issues: GitHubIssue[];
  /**
   * Exact count of issues in the window, from search. Null when unavailable,
   * in which case the sample size is used and reported as a floor.
   *
   * The sample cannot carry this: one page is shared with pull requests, so a
   * busy repository reports a fraction of its real volume.
   */
  totalCount?: number | null;
  now?: Date;
  windowDays?: number;
};

function dayBucket(now: Date) {
  return now.toISOString().slice(0, 10);
}

/**
 * Real issues only.
 *
 * The GitHub issues endpoint includes pull requests; on an active repository
 * they are the overwhelming majority. Counting them would turn user voice into
 * contributor activity.
 */
export function issuesOnly(items: GitHubIssue[]): GitHubIssue[] {
  return items.filter((item) => item.pull_request === undefined);
}

function labelled(issue: GitHubIssue, names: string[]): boolean {
  return issue.labels.some((label) => names.includes(label.name.toLowerCase()));
}

export function normalizeConsumerActivity(input: ConsumerInput): ObservedSignal[] {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = now.getTime() - windowDays * 86400000;
  const bucket = dayBucket(now);
  const repoRef = `${input.owner}/${input.repo}`;

  const issues = issuesOnly(input.issues).filter((issue) => {
    const created = Date.parse(issue.created_at);
    return Number.isFinite(created) && created >= cutoff;
  });

  const signals: ObservedSignal[] = [];

  // 1. User demand — how many distinct people bothered to report something.
  const reporters = new Set(issues.map((i) => i.user?.login ?? "unknown"));
  const exact = typeof input.totalCount === "number";
  const demandCount = exact ? (input.totalCount as number) : issues.length;
  const demandSeverity: SignalSeverity =
    demandCount >= 25 ? "high" : demandCount >= 8 ? "medium" : "low";

  signals.push({
    source: CONSUMER_SOURCE,
    externalId: `${repoRef}:user-demand:${bucket}`,
    kind: "social",
    family: "consumer",
    severity: demandSeverity,
    title: "User-reported demand",
    detail: exact
      ? `${demandCount} issue(s) in the last ${windowDays} days, ${reporters.size} distinct reporter(s) in the sample`
      : `at least ${demandCount} issue(s) from ${reporters.size} reporter(s) in the last ${windowDays} days (sampled)`,
    value: `${demandCount} issues`,
    // Users taking the trouble to report is evidence the product is used.
    scoreDelta: demandSeverity === "high" ? 8 : demandSeverity === "medium" ? 4 : 1,
    observedAt: now.toISOString(),
    raw: {
      windowDays,
      issueCount: demandCount,
      countIsExact: exact,
      sampleSize: issues.length,
      reporterCount: reporters.size,
      pullRequestsExcluded: input.issues.length - issuesOnly(input.issues).length
    }
  });

  // Ratios below need a floor: "100% unanswered" across two issues says
  // nothing, and would read as neglect on a quiet week.
  if (issues.length >= MIN_ISSUES_FOR_RATIOS) {
    // 2. Is anyone home? Unanswered users are a product failing its users.
    const unanswered = issues.filter((i) => i.comments === 0).length;
    const unansweredShare = unanswered / issues.length;
    const neglectSeverity: SignalSeverity =
      unansweredShare >= 0.6 ? "high" : unansweredShare >= 0.35 ? "medium" : "low";

    signals.push({
      source: CONSUMER_SOURCE,
      externalId: `${repoRef}:maintainer-responsiveness:${bucket}`,
      kind: "social",
      family: "consumer",
      severity: neglectSeverity,
      title: "Maintainer responsiveness",
      detail: `${unanswered} of ${issues.length} sampled issue(s) received no reply at all`,
      value: `${Math.round(unansweredShare * 100)}% unanswered`,
      // Ignoring users counts against the product.
      scoreDelta:
        unansweredShare >= 0.6 ? -8 : unansweredShare >= 0.35 ? -4 : 4,
      observedAt: now.toISOString(),
      raw: { unanswered, total: issues.length, unansweredShare }
    });

    // 3. What are users saying? Only when the repo actually labels issues —
    // an unlabelled repo tells us nothing, and inferring from titles would be
    // guesswork dressed as measurement.
    const bugs = issues.filter((i) => labelled(i, BUG_LABELS)).length;
    const features = issues.filter((i) => labelled(i, FEATURE_LABELS)).length;
    const classified = bugs + features;

    if (classified >= MIN_ISSUES_FOR_RATIOS) {
      const bugShare = bugs / classified;
      const bugSeverity: SignalSeverity =
        bugShare >= 0.7 ? "high" : bugShare >= 0.45 ? "medium" : "low";

      signals.push({
        source: CONSUMER_SOURCE,
        externalId: `${repoRef}:issue-composition:${bucket}`,
        kind: "social",
        family: "consumer",
        severity: bugSeverity,
        title: "User issue composition",
        detail: `${bugs} bug report(s) against ${features} feature request(s) among labelled issues`,
        value: `${Math.round(bugShare * 100)}% bugs`,
        // Mostly bugs points at quality problems; mostly requests points at
        // users who want more of something that already works.
        scoreDelta: bugShare >= 0.7 ? -6 : bugShare >= 0.45 ? -2 : 4,
        observedAt: now.toISOString(),
        raw: { bugs, features, classified, bugShare }
      });
    }
  }

  return signals;
}
