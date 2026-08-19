import { describe, expect, it } from "vitest";
import { OrynthPathError, resolvePartnerUrl } from "./orynth";
import { launchSnapshotInputSchema } from "@/lib/schema";

const BASE = "https://api.orynth.io";

describe("resolvePartnerUrl", () => {
  it("resolves an ordinary path", () => {
    expect(resolvePartnerUrl(BASE, "/partners/atlas").toString()).toBe(
      "https://api.orynth.io/partners/atlas"
    );
  });

  it("preserves a path prefix on the base URL", () => {
    // new URL(path, base) would discard the /v1 here.
    expect(resolvePartnerUrl("https://api.orynth.io/v1", "/partners/atlas").toString()).toBe(
      "https://api.orynth.io/v1/partners/atlas"
    );
  });

  it("tolerates a trailing slash on the base URL", () => {
    expect(resolvePartnerUrl("https://api.orynth.io/", "/partners/atlas").toString()).toBe(
      "https://api.orynth.io/partners/atlas"
    );
  });

  it("keeps query strings", () => {
    expect(resolvePartnerUrl(BASE, "/partners?status=live").toString()).toBe(
      "https://api.orynth.io/partners?status=live"
    );
  });

  // The vulnerability this module exists for: string concatenation made
  // `https://api.orynth.io` + `@evil.com/x` resolve to host evil.com, sending
  // the Authorization header to a caller-chosen server.
  it("refuses a path that re-points the host via userinfo", () => {
    expect(() => resolvePartnerUrl(BASE, "@evil.com/steal")).toThrow(OrynthPathError);
  });

  it("refuses a protocol-relative path", () => {
    expect(() => resolvePartnerUrl(BASE, "//evil.com/steal")).toThrow(OrynthPathError);
  });

  it("refuses an absolute URL", () => {
    expect(() => resolvePartnerUrl(BASE, "https://evil.com/steal")).toThrow(OrynthPathError);
  });

  it("refuses traversal that would escape a path prefix", () => {
    expect(() => resolvePartnerUrl("https://api.orynth.io/v1", "/../admin")).toThrow(
      OrynthPathError
    );
  });

  it("refuses backslashes and whitespace", () => {
    expect(() => resolvePartnerUrl(BASE, "/partners\\@evil.com")).toThrow(OrynthPathError);
    expect(() => resolvePartnerUrl(BASE, "/partners atlas")).toThrow(OrynthPathError);
  });

  it("refuses a relative path", () => {
    expect(() => resolvePartnerUrl(BASE, "partners/atlas")).toThrow(OrynthPathError);
  });

  it("never leaves the configured origin", () => {
    const hostile = ["@evil.com/x", "//evil.com/x", "https://evil.com/x", "\\\\evil.com/x"];
    for (const path of hostile) {
      let host: string | null = null;
      try {
        host = resolvePartnerUrl(BASE, path).host;
      } catch {
        host = null;
      }
      expect(host === null || host === "api.orynth.io").toBe(true);
    }
  });
});

describe("request schema rejects hostile paths at the edge", () => {
  const body = (partnerPath: string) => ({ owner: "o", repo: "r", partnerPath });

  it("accepts a normal path", () => {
    expect(launchSnapshotInputSchema.safeParse(body("/partners/atlas")).success).toBe(true);
  });

  it("rejects host re-pointing before it reaches the queue", () => {
    for (const path of ["@evil.com/x", "//evil.com/x", "https://evil.com/x", "/../admin"]) {
      expect(launchSnapshotInputSchema.safeParse(body(path)).success).toBe(false);
    }
  });
});
