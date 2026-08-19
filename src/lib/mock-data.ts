import type { Launch, MetricCard, Signal } from "./types";

export const metricCards: MetricCard[] = [
  { label: "Entities tracked", value: "18", delta: "+4 this week" },
  { label: "Signals ingested", value: "246", delta: "+12% vs last 7d" },
  { label: "High-priority alerts", value: "7", delta: "3 need review" },
  { label: "Launch-ready", value: "4", delta: "1 moved today" }
];

/**
 * Demo entities spanning what the product actually assesses: an opportunity
 * with no company yet, a live product with no token, and a company that has
 * launched one. The old fixtures were all token launches, which misrepresented
 * the input the system is built for.
 */
export const launches: Launch[] = [
  {
    id: "entity-01",
    slug: "agent-treasury-infrastructure",
    name: "Agent Treasury Infrastructure",
    entityKind: "opportunity",
    symbol: null,
    status: "watching",
    score: 87,
    chain: null,
    recommendation: "insufficient_evidence",
    readiness: {
      product: null,
      founder: null,
      market: 82,
      community: null,
      distribution: null,
      economicDesign: null
    },
    updatedAt: "2026-08-17T08:05:00Z"
  },
  {
    id: "entity-02",
    slug: "nova-index",
    name: "Nova Index",
    entityKind: "company",
    symbol: null,
    status: "watching",
    score: 78,
    chain: null,
    recommendation: "build_further",
    readiness: {
      product: 74,
      founder: 71,
      market: 66,
      community: 41,
      distribution: 52,
      economicDesign: null
    },
    updatedAt: "2026-08-17T06:42:00Z"
  },
  {
    id: "entity-03",
    slug: "atlas-protocol",
    name: "Atlas Protocol",
    entityKind: "company",
    symbol: "ATLS",
    status: "launched",
    score: 92,
    chain: "Solana",
    recommendation: "launch_now",
    readiness: {
      product: 88,
      founder: 91,
      market: 84,
      community: 63,
      distribution: 75,
      economicDesign: 79
    },
    updatedAt: "2026-08-16T22:10:00Z"
  }
];

export const signals: Signal[] = [
  {
    id: "signal-01",
    kind: "github",
    family: "builder",
    label: "GitHub activity spike",
    severity: "high",
    value: "+14 commits",
    scoreDelta: 8,
    detail: "Rapid PR merges in launch-adjacent repository",
    timestamp: "2026-08-17T08:14:00Z"
  },
  {
    id: "signal-02",
    kind: "social",
    family: "attention",
    label: "X mention cluster",
    severity: "medium",
    value: "36 posts",
    scoreDelta: 4,
    detail: "Repeated mentions from small but overlapping accounts",
    timestamp: "2026-08-17T07:49:00Z"
  },
  {
    id: "signal-03",
    kind: "market",
    family: "capital",
    label: "Liquidity change",
    severity: "high",
    value: "+22%",
    scoreDelta: 8,
    detail: "Trading depth improved across two tracked pools",
    timestamp: "2026-08-17T07:31:00Z"
  },
  {
    id: "signal-04",
    kind: "onchain",
    family: "capital",
    label: "Wallet cluster movement",
    severity: "low",
    value: "8 wallets",
    scoreDelta: 1,
    detail: "Small coordinated funding pattern detected",
    timestamp: "2026-08-17T06:58:00Z"
  }
];
