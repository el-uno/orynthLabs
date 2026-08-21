import type { ObservedSignal, SignalSeverity } from "@/lib/types";

/**
 * Demand evidence keyed to a *topic* rather than an entity.
 *
 * Every other demand source is entity-scoped: commits belong to a repository,
 * transactions to a mint, issues to a project. A Build Opportunity has none of
 * those — it is a market gap nobody has built into yet — so until now the only
 * topic-scoped evidence was market structure. That left the opportunity gate
 * starved rather than miscalibrated: it requires demand across two or more
 * families, and no topic could supply even one.
 *
 * Two families, both from sources needing no new credentials:
 *   builder   — repositories being created in the space
 *   attention — a community forming around the problem
 */

export const TOPIC_BUILDER_SOURCE = "github-search";
export const TOPIC_ATTENTION_SOURCE = "stackoverflow";

export const DEFAULT_WINDOW_DAYS = 90;

/**
 * Provisional bands.
 *
 * Set from a handful of observed topics (313 new repos for "mcp server
 * framework" against 2008 for "react state management"; 37 Stack Overflow
 * questions against 8). They discriminate in the right direction but have NOT
 * been swept the way the market-structure constants were — treat the tiers as
 * directional until calibrated.
 */
export const BUILDER_HIGH = 500;
export const BUILDER_MEDIUM = 100;
export const ATTENTION_HIGH = 50;
export const ATTENTION_MEDIUM = 10;

export type TopicDemandInput = {
  topic: string;
  /** Repositories created in the window that match the topic. */
  newRepositories: number;
  /** Stars on the strongest recent entrants, as a traction hint. */
  topStars: number;
  /** Questions asked about the topic in the window; null when unavailable. */
  communityQuestions: number | null;
  now?: Date;
  windowDays?: number;
};

function dayBucket(now: Date) {
  return now.toISOString().slice(0, 10);
}

function tier(value: number, medium: number, high: number): SignalSeverity {
  if (value >= high) return "high";
  if (value >= medium) return "medium";
  return "low";
}

/**
 * Contribution for a measured volume.
 *
 * **Zero contributes zero.** A "low" tier used to award +1 regardless, so a
 * topic with no repositories and no questions still registered as demand —
 * `multi agent treasury coordination` had 0 of both and scored 56 `emerging`.
 * Absence of evidence was being counted as weak evidence for, which is the
 * same null-versus-zero confusion the readiness axes already avoid.
 */
function contribution(value: number, severity: SignalSeverity): number {
  if (value <= 0) return 0;
  return severity === "high" ? 8 : severity === "medium" ? 4 : 1;
}

export function normalizeTopicDemand(input: TopicDemandInput): ObservedSignal[] {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const bucket = dayBucket(now);
  const topicKey = input.topic.toLowerCase().replace(/\s+/g, "-");
  const signals: ObservedSignal[] = [];

  // 1. Builder demand — are developers building in this space at all?
  const builderSeverity = tier(input.newRepositories, BUILDER_MEDIUM, BUILDER_HIGH);
  signals.push({
    source: TOPIC_BUILDER_SOURCE,
    externalId: `${topicKey}:topic-builder:${bucket}`,
    kind: "github",
    family: "builder",
    severity: builderSeverity,
    title: "Topic developer activity",
    detail:
      `${input.newRepositories} repositories created in the last ${windowDays} days` +
      ` matching "${input.topic}"; strongest recent entrant has ${input.topStars} stars`,
    value: `${input.newRepositories} new repos`,
    scoreDelta: contribution(input.newRepositories, builderSeverity),
    observedAt: now.toISOString(),
    raw: {
      windowDays,
      newRepositories: input.newRepositories,
      topStars: input.topStars,
      topic: input.topic
    }
  });

  // 2. Attention — is a community forming around the problem?
  // Omitted rather than zeroed when unavailable: no answer from the source is
  // not the same as nobody asking.
  if (input.communityQuestions !== null) {
    const attentionSeverity = tier(
      input.communityQuestions,
      ATTENTION_MEDIUM,
      ATTENTION_HIGH
    );

    signals.push({
      source: TOPIC_ATTENTION_SOURCE,
      externalId: `${topicKey}:community-interest:${bucket}`,
      kind: "social",
      family: "attention",
      severity: attentionSeverity,
      title: "Community interest",
      detail: `${input.communityQuestions} question(s) asked about "${input.topic}" in the last ${windowDays} days`,
      value: `${input.communityQuestions} questions`,
      scoreDelta: contribution(input.communityQuestions, attentionSeverity),
      observedAt: now.toISOString(),
      raw: { windowDays, questions: input.communityQuestions, topic: input.topic }
    });
  }

  return signals;
}
