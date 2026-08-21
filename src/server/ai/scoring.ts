import OpenAI from "openai";
import { runtimeEnv } from "@/lib/env";
import { launchScoreSchema } from "@/lib/schema";
import { dedupeByMetric } from "@/server/scoring/dedupe";
import { dedupeBySimilarity } from "@/server/scoring/similarity";
import { assess, type ReadinessAssessment } from "@/server/scoring/readiness";
import { assessOpportunity, type OpportunityAssessment } from "@/server/scoring/opportunity";
import { resolveStatus, type StatusDecision } from "@/server/scoring/thresholds";
import type { Launch, Signal } from "@/lib/types";

const client = runtimeEnv.openAiApiKey
  ? new OpenAI({ apiKey: runtimeEnv.openAiApiKey })
  : null;

export type ScoreLaunchInput = {
  launch: Launch;
  signals: Signal[];
  /** Injectable for deterministic tests of the recency rule. */
  now?: Date;
};

export type ScoredLaunch = Omit<ReturnType<typeof launchScoreSchema.parse>, "score"> & {
  /** The readiness composite. Null when no axis is measurable. */
  score: number | null;
  /** Why the status is what it is. Persisted so the decision stays arguable. */
  statusDecision: StatusDecision;
  /** Six-axis readiness and the tokenization recommendation. Companies only. */
  assessment: ReadinessAssessment;
  /**
   * Opportunity verdict. Set only for `entity_kind: "opportunity"`, where the
   * readiness axes do not apply — there is no product or founder to score.
   */
  opportunity: OpportunityAssessment | null;
};

/**
 * Status is decided by the deterministic threshold layer, never by the model.
 * The model contributes a score and an explanation; sufficiency of evidence is
 * not a judgement it is equipped to make.
 */
/**
 * Status AND score are both decided by deterministic layers, never by the
 * model or by the stored row.
 *
 * The model contributes an explanation only. Its `score` field is parsed for
 * schema conformance and then discarded: a reproducible assessment cannot
 * depend on a generative sample, and the fallback path used to echo
 * `launch.score` straight back — so the row gated its own status and was then
 * overwritten with itself.
 */
function applyThresholds(
  parsed: ReturnType<typeof launchScoreSchema.parse>,
  input: ScoreLaunchInput
): ScoredLaunch {
  // Two passes: exact identity collapses repeated sampling of one metric;
  // similarity collapses two sources reporting the same real-world event.
  const deduped = dedupeBySimilarity(dedupeByMetric(input.signals));

  const assessment = assess(deduped);
  const isOpportunity = input.launch.entityKind === "opportunity";

  // An opportunity is judged on whether a gap exists, not on readiness axes it
  // cannot have. Both paths derive their score the same way: from evidence.
  const opportunity = isOpportunity ? assessOpportunity(deduped) : null;
  const score = isOpportunity ? (opportunity?.score ?? null) : assessment.composite;

  const decision = resolveStatus({
    score,
    signals: deduped,
    currentStatus: input.launch.status,
    now: input.now
  });

  return {
    ...parsed,
    score,
    status: decision.status,
    statusDecision: decision,
    assessment,
    opportunity
  };
}

export async function scoreLaunch(input: ScoreLaunchInput): Promise<ScoredLaunch> {
  if (!client) {
    const fallback = launchScoreSchema.parse({
      // Placeholder only; applyThresholds replaces it with the composite.
      score: 0,
      status: input.launch.status,
      rationale: "OpenAI key not configured; returning deterministic fallback score.",
      signals: input.signals.map((signal) => ({
        source: signal.kind,
        kind: signal.kind,
        severity: signal.severity,
        title: signal.label,
        detail: signal.detail,
        value: signal.value,
        scoreDelta: signal.scoreDelta
      }))
    });

    return applyThresholds(fallback, input);
  }

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You score Solana launch opportunities from a small set of signals. " +
          "Return only valid JSON. Judge the strength of the evidence in the score " +
          "and rationale; the status field is recomputed downstream by a " +
          "deterministic rule, so do not optimise for it."
      },
      {
        role: "user",
        content: JSON.stringify({
          launch: input.launch,
          signals: input.signals
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "launch_score",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            status: {
              type: "string",
              enum: ["draft", "watching", "ready", "launched"]
            },
            rationale: { type: "string" },
            signals: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  source: { type: "string" },
                  kind: {
                    type: "string",
                    enum: ["github", "social", "market", "onchain", "partner"]
                  },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  title: { type: "string" },
                  detail: { type: "string" },
                  value: { type: "string" },
                  scoreDelta: { type: "integer" }
                },
                required: ["source", "kind", "severity", "title", "detail", "scoreDelta"]
              }
            }
          },
          required: ["score", "status", "rationale", "signals"]
        }
      }
    }
  });

  const text = response.output_text;
  return applyThresholds(launchScoreSchema.parse(JSON.parse(text)), input);
}
