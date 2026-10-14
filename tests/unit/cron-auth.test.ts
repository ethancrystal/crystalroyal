import { afterEach, describe, expect, it, vi } from "vitest";

// /api/cron/* accept only `Authorization: Bearer CRON_SECRET`. Without a secret they refuse in production and run in
// development. env.ts reads the environment when it is imported, so each case loads the module afresh.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function guard(nodeEnv: string, secret: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("CRON_SECRET", secret);
  vi.resetModules();
  return (await import("@/app/api/cron/authorize")).refuseUnlessCron;
}

const req = (authorization?: string) =>
  new Request("https://crystalroyal.test/api/cron/expire-holds", { headers: authorization ? { authorization } : {} });

describe("refuseUnlessCron", () => {
  it("lets the right bearer token through", async () => {
    const refuse = await guard("production", "s3cret-value");
    expect(refuse(req("Bearer s3cret-value"))).toBeNull();
    expect(refuse(req("bearer s3cret-value"))).toBeNull();
  });

  it.each([
    ["no header", undefined],
    ["wrong token", "Bearer nope"],
    ["the token alone", "s3cret-value"],
    ["another scheme", "Basic s3cret-value"],
    ["a prefix of the token", "Bearer s3cret"],
    ["the token with more after it", "Bearer s3cret-value extra"],
  ])("refuses %s with 401", async (_label, auth) => {
    const refuse = await guard("production", "s3cret-value");
    const res = refuse(req(auth));
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: "Unauthorized." });
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses everything in production when CRON_SECRET is not set", async () => {
    const refuse = await guard("production", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(refuse(req())?.status).toBe(401);
    expect(refuse(req("Bearer "))?.status).toBe(401);
    expect(refuse(req("Bearer anything"))?.status).toBe(401);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET is not set"));
    log.mockRestore();
  });

  it("allows a plain request in development when CRON_SECRET is not set", async () => {
    const refuse = await guard("development", "");
    expect(refuse(req())).toBeNull();
  });

  it("still checks the secret in development when one is set", async () => {
    const refuse = await guard("development", "dev-secret");
    expect(refuse(req())?.status).toBe(401);
    expect(refuse(req("Bearer dev-secret"))).toBeNull();
  });
});
