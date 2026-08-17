import { describe, expect, it } from "vitest";
import { getDashboardData } from "./dashboard";
import { launches, signals } from "@/lib/mock-data";

// No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY is set in the test environment,
// so the repositories return null and the dashboard must fall back cleanly.
describe("getDashboardData without Supabase", () => {
  it("falls back to mock data and says so", async () => {
    const data = await getDashboardData();

    expect(data.usingMockData).toBe(true);
    expect(data.launches).toEqual(launches);
    expect(data.signals).toEqual(signals);
  });

  it("still returns a full set of metric cards", async () => {
    const data = await getDashboardData();
    expect(data.metrics).toHaveLength(4);
    expect(data.metrics.every((card) => card.label && card.value)).toBe(true);
  });
});
