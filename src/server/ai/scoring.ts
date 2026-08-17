import OpenAI from "openai";
import { runtimeEnv } from "@/lib/env";
import { launchScoreSchema } from "@/lib/schema";
import type { Launch, Signal } from "@/lib/types";

const client = runtimeEnv.openAiApiKey
  ? new OpenAI({ apiKey: runtimeEnv.openAiApiKey })
  : null;

export type ScoreLaunchInput = {
  launch: Launch;
  signals: Signal[];
};

export async function scoreLaunch(input: ScoreLaunchInput) {
  if (!client) {
    return launchScoreSchema.parse({
      score: input.launch.score,
      status: input.launch.status,
      rationale: "OpenAI key not configured; returning deterministic fallback score.",
      signals: input.signals.map((signal) => ({
        source: signal.kind,
        kind: signal.kind,
        severity: signal.severity,
        title: signal.label,
        detail: signal.detail,
        value: signal.value,
        scoreDelta: signal.severity === "high" ? 8 : signal.severity === "medium" ? 4 : 1
      }))
    });
  }

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You score Solana launch opportunities from a small set of signals. Return only valid JSON."
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
  return launchScoreSchema.parse(JSON.parse(text));
}
