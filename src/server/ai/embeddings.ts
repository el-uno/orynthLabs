import OpenAI from "openai";
import { runtimeEnv } from "@/lib/env";

/**
 * text-embedding-3-small emits 1536 dimensions, matching the `vector(1536)`
 * column defined in migration 0001. Changing the model means a migration.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const client = runtimeEnv.openAiApiKey
  ? new OpenAI({ apiKey: runtimeEnv.openAiApiKey })
  : null;

/**
 * Embeds signal texts, or returns null when no key is configured.
 *
 * Null rather than throwing: embeddings are an enhancement to dedup, not a
 * precondition for ingestion. Losing them must never cost a signal.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!client || texts.length === 0) {
    return null;
  }

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts
  });

  return response.data.map((item) => item.embedding);
}

/** The text a signal is embedded from. Title plus detail carries the meaning. */
export function embeddingText(input: { title: string; detail: string }) {
  return `${input.title}. ${input.detail}`;
}
