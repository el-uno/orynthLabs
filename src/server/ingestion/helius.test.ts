import { describe, expect, it } from "vitest";
import { normalizeChainActivity, topHolderShare } from "./helius";
import type { SignatureInfo, TokenLargestAccount, TokenSupply } from "@/server/clients/helius";

const NOW = new Date("2026-08-18T12:00:00Z");
const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function supply(amount: string, decimals = 6): TokenSupply {
  return { amount, decimals, uiAmount: Number(amount) / 10 ** decimals };
}

function accounts(amounts: string[]): TokenLargestAccount[] {
  return amounts.map((amount, i) => ({ address: `acct${i}`, amount, decimals: 6, uiAmount: null }));
}

function sig(daysAgo: number, err: unknown = null): SignatureInfo {
  return {
    signature: `sig-${daysAgo}-${Math.random()}`,
    slot: 1000,
    err,
    blockTime: Math.floor((NOW.getTime() - daysAgo * 86400000) / 1000)
  };
}

function run(input: {
  supply?: TokenSupply;
  largestAccounts?: TokenLargestAccount[];
  signatures?: SignatureInfo[];
}) {
  return normalizeChainActivity({
    mint: MINT,
    supply: input.supply ?? supply("1000000"),
    largestAccounts: input.largestAccounts ?? accounts([]),
    signatures: input.signatures ?? [],
    now: NOW
  });
}

describe("topHolderShare", () => {
  it("computes a straightforward share", () => {
    expect(topHolderShare(supply("1000"), accounts(["500", "250"]), 10)).toBeCloseTo(75, 4);
  });

  it("keeps precision far beyond 2^53", () => {
    // 1e18 base units — float math loses digits here.
    const big = supply("1000000000000000000", 9);
    const holders = accounts(Array.from({ length: 10 }, () => "70000000000000000"));
    expect(topHolderShare(big, holders, 10)).toBeCloseTo(70, 4);
  });

  it("respects the top-n cutoff", () => {
    const holders = accounts(Array.from({ length: 20 }, () => "50"));
    expect(topHolderShare(supply("1000"), holders, 10)).toBeCloseTo(50, 4);
  });

  it("returns 0 for zero supply rather than dividing by zero", () => {
    expect(topHolderShare(supply("0"), accounts(["10"]), 10)).toBe(0);
  });

  it("survives malformed amounts", () => {
    expect(topHolderShare(supply("not-a-number"), accounts(["10"]), 10)).toBe(0);
    expect(topHolderShare(supply("1000"), accounts(["bad", "500"]), 10)).toBeCloseTo(50, 4);
  });
});

describe("normalizeChainActivity", () => {
  it("emits activity, concentration and supply signals", () => {
    const signals = run({});
    expect(signals.map((s) => s.title)).toEqual([
      "On-chain transaction activity",
      "Token holder concentration",
      "Token supply"
    ]);
    expect(signals.every((s) => s.kind === "onchain")).toBe(true);
    expect(signals.every((s) => s.source === "helius")).toBe(true);
  });

  it("excludes transactions older than the window", () => {
    const signals = run({ signatures: [sig(1), sig(3), sig(30)] });
    expect(signals[0].value).toBe("2 txs");
  });

  it("counts failed transactions separately", () => {
    const signals = run({ signatures: [sig(1), sig(1, { InstructionError: [0, "x"] })] });
    expect(signals[0].detail).toContain("1 failed");
  });

  it("escalates activity severity with volume", () => {
    const many = (n: number) => Array.from({ length: n }, () => sig(1));
    expect(run({ signatures: many(5) })[0].severity).toBe("low");
    expect(run({ signatures: many(25) })[0].severity).toBe("medium");
    expect(run({ signatures: many(120) })[0].severity).toBe("high");
  });

  it("treats high concentration as high severity", () => {
    const signals = run({
      supply: supply("1000"),
      largestAccounts: accounts(["900"])
    });
    expect(signals[1].severity).toBe("high");
  });

  it("makes concentration count AGAINST the score", () => {
    const concentrated = run({ supply: supply("1000"), largestAccounts: accounts(["900"]) });
    const dispersed = run({ supply: supply("1000"), largestAccounts: accounts(["10"]) });

    expect(concentrated[1].scoreDelta).toBeLessThan(0);
    expect(dispersed[1].scoreDelta).toBeGreaterThanOrEqual(0);
    expect(concentrated[1].scoreDelta).toBeLessThan(dispersed[1].scoreDelta);
  });

  it("gives each signal a mint- and day-scoped external id", () => {
    const signals = run({});
    expect(signals.map((s) => s.externalId)).toEqual([
      `${MINT}:tx-activity:2026-08-18`,
      `${MINT}:holder-concentration:2026-08-18`,
      `${MINT}:supply:2026-08-18`
    ]);
  });

  it("is idempotent within a day and distinct across days", () => {
    const sameDay = normalizeChainActivity({
      mint: MINT, supply: supply("1000"), largestAccounts: accounts([]), signatures: [],
      now: new Date("2026-08-18T23:00:00Z")
    });
    const nextDay = normalizeChainActivity({
      mint: MINT, supply: supply("1000"), largestAccounts: accounts([]), signatures: [],
      now: new Date("2026-08-19T01:00:00Z")
    });

    expect(sameDay[0].externalId).toBe(run({})[0].externalId);
    expect(nextDay[0].externalId).not.toBe(run({})[0].externalId);
  });

  it("ignores signatures with no block time", () => {
    const signals = run({ signatures: [{ signature: "s", slot: 1, err: null, blockTime: null }] });
    expect(signals[0].value).toBe("0 txs");
  });
});

describe("degraded holder data", () => {
  it("omits the concentration signal when the holder query failed", () => {
    const signals = normalizeChainActivity({
      mint: MINT,
      supply: supply("1000"),
      largestAccounts: [],
      largestAccountsAvailable: false,
      signatures: [],
      now: NOW
    });

    // Two signals, not three, and crucially no 0% concentration claim.
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.title)).toEqual([
      "On-chain transaction activity",
      "Token supply"
    ]);
    expect(signals.some((s) => s.title.includes("concentration"))).toBe(false);
  });

  it("still reports concentration when holder data is present", () => {
    const signals = normalizeChainActivity({
      mint: MINT,
      supply: supply("1000"),
      largestAccounts: accounts(["900"]),
      largestAccountsAvailable: true,
      signatures: [],
      now: NOW
    });

    expect(signals).toHaveLength(3);
    expect(signals[1].severity).toBe("high");
  });
});
