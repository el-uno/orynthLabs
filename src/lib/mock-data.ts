import type { Launch, MetricCard, Signal } from "./types";

export const metricCards: MetricCard[] = [
  { label: "Launches tracked", value: "18", delta: "+4 this week" },
  { label: "Signals ingested", value: "246", delta: "+12% vs last 7d" },
  { label: "High-priority alerts", value: "7", delta: "3 need review" },
  { label: "Ready-for-launch", value: "4", delta: "1 moved today" }
];

export const launches: Launch[] = [
  {
    id: "launch-01",
    name: "Atlas Protocol",
    symbol: "ATLS",
    status: "ready",
    score: 92,
    chain: "Solana",
    updatedAt: "2026-08-17T08:05:00Z"
  },
  {
    id: "launch-02",
    name: "Nova Index",
    symbol: "NOVA",
    status: "watching",
    score: 78,
    chain: "Solana",
    updatedAt: "2026-08-17T06:42:00Z"
  },
  {
    id: "launch-03",
    name: "Cipher Labs",
    symbol: "CIPHER",
    status: "draft",
    score: 61,
    chain: "Solana",
    updatedAt: "2026-08-16T22:10:00Z"
  }
];

export const signals: Signal[] = [
  {
    id: "signal-01",
    kind: "github",
    label: "GitHub activity spike",
    severity: "high",
    value: "+14 commits",
    detail: "Rapid PR merges in launch-adjacent repository",
    timestamp: "2026-08-17T08:14:00Z"
  },
  {
    id: "signal-02",
    kind: "social",
    label: "X mention cluster",
    severity: "medium",
    value: "36 posts",
    detail: "Repeated mentions from small but overlapping accounts",
    timestamp: "2026-08-17T07:49:00Z"
  },
  {
    id: "signal-03",
    kind: "market",
    label: "Liquidity change",
    severity: "high",
    value: "+22%",
    detail: "Trading depth improved across two tracked pools",
    timestamp: "2026-08-17T07:31:00Z"
  },
  {
    id: "signal-04",
    kind: "onchain",
    label: "Wallet cluster movement",
    severity: "low",
    value: "8 wallets",
    detail: "Small coordinated funding pattern detected",
    timestamp: "2026-08-17T06:58:00Z"
  }
];
