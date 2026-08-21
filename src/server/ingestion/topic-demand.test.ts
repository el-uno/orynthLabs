import { describe, expect, it } from "vitest";
import { normalizeTopicDemand } from "./topic-demand";
import { assessOpportunity } from "@/server/scoring/opportunity";
import type { ObservedSignal, Signal } from "@/lib/types";

const NOW = new Date("2026-08-19T12:00:00Z");

function run(over: Partial<Parameters<typeof normalizeTopicDemand>[0]> = {}) {
  return normalizeTopicDemand({
    topic: "agent treasury",
    newRepositories: 300,
    topStars: 500,
    communityQuestions: 30,
    now: NOW,
    ...over
  });
}

function toSignal(o: ObservedSignal): Signal {
  return {
    id: Math.random().toString(36).slice(2),
    source: o.source,
    externalId: o.externalId,
    kind: o.kind,
    family: o.family,
    label: o.title,
    severity: o.severity,
    value: o.value,
    detail: o.detail,
    scoreDelta: o.scoreDelta,
    timestamp: o.observedAt
  };
}

describe("normalizeTopicDemand", () => {
  it("emits builder and attention, the two families an opportunity lacked", () => {
    expect(run().map((s) => s.family)).toEqual(["builder", "attention"]);
  });

  it("keys signals to the topic, not to a repository", () => {
    expect(run()[0].externalId).toBe("agent-treasury:topic-builder:2026-08-19");
  });

  it("escalates builder severity with repository creation", () => {
    expect(run({ newRepositories: 10 })[0].severity).toBe("low");
    expect(run({ newRepositories: 200 })[0].severity).toBe("medium");
    expect(run({ newRepositories: 900 })[0].severity).toBe("high");
  });

  it("escalates attention severity with question volume", () => {
    expect(run({ communityQuestions: 2 })[1].severity).toBe("low");
    expect(run({ communityQuestions: 20 })[1].severity).toBe("medium");
    expect(run({ communityQuestions: 80 })[1].severity).toBe("high");
  });

  // Quota exhaustion must lose the signal, not fabricate a zero.
  it("omits attention entirely when the source is unavailable", () => {
    const signals = run({ communityQuestions: null });
    expect(signals).toHaveLength(1);
    expect(signals[0].family).toBe("builder");
  });
});

describe("the opportunity gate is no longer starved", () => {
  // Before this source existed, every topic returned `crowded` or
  // `insufficient_evidence` across a 16-topic sweep — not because the gate was
  // miscalibrated but because no topic could supply even one demand family.
  const gap: Signal = {
    id: "gap",
    source: "npm",
    externalId: null,
    kind: "market",
    family: "market_structure",
    label: "Existing solution coverage",
    severity: "high",
    value: "1 incumbent",
    detail: "open gap",
    scoreDelta: 10,
    timestamp: NOW.toISOString()
  };

  it("still refuses when only market structure is present", () => {
    expect(assessOpportunity([gap]).verdict).toBe("insufficient_evidence");
  });

  it("reaches a real verdict once topic demand is supplied", () => {
    const signals = [gap, ...run().map(toSignal)];
    const a = assessOpportunity(signals);

    expect(a.evidence.demandFamilies).toEqual(["attention", "builder"]);
    expect(["strong", "emerging"]).toContain(a.verdict);
    expect(a.score).not.toBeNull();
  });

  it("still calls a served market crowded, however strong the demand", () => {
    const served: Signal = { ...gap, scoreDelta: -8, value: "12+ incumbents" };
    const a = assessOpportunity([served, ...run().map(toSignal)]);
    expect(a.verdict).toBe("crowded");
  });
});
