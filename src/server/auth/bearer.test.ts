import { afterEach, describe, expect, it } from "vitest";
import { authorizeApiRequest } from "./bearer";
import { authorizeSigningRequest } from "@/server/signing/auth";

function requestWith(token?: string) {
  return new Request("http://localhost/api/test", {
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
}

afterEach(() => {
  delete process.env.API_TOKEN;
  delete process.env.SIGNING_API_TOKEN;
});

describe("authorizeApiRequest", () => {
  it("disables the route when API_TOKEN is unset", () => {
    const result = authorizeApiRequest(requestWith("anything"));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(503);
  });

  it("rejects a request with no authorization header", () => {
    process.env.API_TOKEN = "secret";
    const result = authorizeApiRequest(requestWith());
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
  });

  it("rejects a wrong token", () => {
    process.env.API_TOKEN = "secret";
    const result = authorizeApiRequest(requestWith("wrong"));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
  });

  it("rejects a token that is a prefix of the real one", () => {
    process.env.API_TOKEN = "secret-value";
    const result = authorizeApiRequest(requestWith("secret"));
    expect(result.ok).toBe(false);
  });

  it("accepts the correct token", () => {
    process.env.API_TOKEN = "secret";
    expect(authorizeApiRequest(requestWith("secret")).ok).toBe(true);
  });
});

describe("authorizeSigningRequest", () => {
  it("does not accept the general API token", () => {
    process.env.API_TOKEN = "api-secret";
    process.env.SIGNING_API_TOKEN = "signing-secret";

    const result = authorizeSigningRequest(requestWith("api-secret"));
    expect(result.ok).toBe(false);
  });

  it("accepts the signing token", () => {
    process.env.SIGNING_API_TOKEN = "signing-secret";
    expect(authorizeSigningRequest(requestWith("signing-secret")).ok).toBe(true);
  });

  it("is disabled independently of API_TOKEN", () => {
    process.env.API_TOKEN = "api-secret";
    const result = authorizeSigningRequest(requestWith("api-secret"));
    expect(result.ok === false && result.status).toBe(503);
  });
});
