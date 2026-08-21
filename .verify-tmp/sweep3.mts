import { ingestMarketStructure } from "../src/server/ingestion/run-market-structure";
import { ingestTopicDemand } from "../src/server/ingestion/run-topic-demand";
import { assessOpportunity } from "../src/server/scoring/opportunity";
import type { ObservedSignal, Signal } from "../src/lib/types";

const ALL: [string, string][] = [
  ["react state management", "saturated"], ["http client", "saturated"],
  ["date formatting", "saturated"], ["css framework", "saturated"],
  ["vector database client", "emerging"], ["llm agent memory", "emerging"],
  ["mcp server framework", "emerging"], ["ai agent payments", "emerging"],
  ["onchain identity attestation", "niche"], ["solana agent treasury policy", "niche"],
  ["autonomous spending controls", "niche"], ["multi agent treasury coordination", "niche"]
];
const [from, to] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? ALL.length)];
const toSignal = (o: ObservedSignal): Signal => ({
  id: Math.random().toString(36).slice(2), source: o.source, externalId: o.externalId,
  kind: o.kind, family: o.family, label: o.title, severity: o.severity,
  value: o.value, detail: o.detail, scoreDelta: o.scoreDelta, timestamp: o.observedAt
});

for (const [topic, tier] of ALL.slice(from, to)) {
  try {
    const market = await ingestMarketStructure({ topic, poolSize: 15 });
    const demand = await ingestTopicDemand({ topic });
    const a = assessOpportunity([...market, ...demand].map(toSignal));
    console.log(
      `${topic.padEnd(34)}${tier.padEnd(10)}cov=${String(a.evidence.coverageStrength).padEnd(5)}` +
      `fam=${a.evidence.demandFamilies.length} ${String(a.score ?? "-").padEnd(5)}${a.verdict}`
    );
  } catch (e) {
    console.log(`${topic.padEnd(34)}${tier.padEnd(10)}ERR ${(e as Error).message.slice(0, 40)}`);
  }
  await new Promise((r) => setTimeout(r, 11000));
}
