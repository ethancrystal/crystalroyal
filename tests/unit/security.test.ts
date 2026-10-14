import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { safeEqual, signPayload, verifyPayload } from "@/lib/security";

// signPayload/verifyPayload carry the reserve draft cookie and the local admin session: any change to the body or
// the signature, or a different key, must read as null.

const SECRET = "a-test-secret-of-at-least-32-characters";

describe("signPayload / verifyPayload", () => {
  const payload = { slug: "three-bedroom", arrive: "2026-11-02", depart: "2026-11-05", adults: 2, children: 4 };

  it("round-trips a payload", () => {
    const signed = signPayload(payload, SECRET);
    expect(signed).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyPayload(signed, SECRET)).toEqual(payload);
  });

  it("rejects a changed body", () => {
    const signed = signPayload(payload, SECRET);
    const [, sig] = signed.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, adults: 8 })).toString("base64url");
    expect(verifyPayload(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a flipped character anywhere", () => {
    const signed = signPayload(payload, SECRET);
    for (const i of [0, Math.floor(signed.length / 2), signed.length - 1]) {
      const c = signed[i] === "A" ? "B" : "A";
      const tampered = signed.slice(0, i) + c + signed.slice(i + 1);
      if (tampered === signed) continue;
      expect(verifyPayload(tampered, SECRET), `position ${i}`).toBeNull();
    }
  });

  it("rejects a changed or truncated signature", () => {
    const signed = signPayload(payload, SECRET);
    expect(verifyPayload(signed.slice(0, -1), SECRET)).toBeNull();
    expect(verifyPayload(`${signed}A`, SECRET)).toBeNull();
    const body = signed.split(".")[0];
    expect(verifyPayload(`${body}.`, SECRET)).toBeNull();
  });

  it("rejects another key", () => {
    expect(verifyPayload(signPayload(payload, SECRET), `${SECRET}x`)).toBeNull();
  });

  it("rejects missing and malformed values", () => {
    expect(verifyPayload(undefined, SECRET)).toBeNull();
    expect(verifyPayload(null, SECRET)).toBeNull();
    expect(verifyPayload("", SECRET)).toBeNull();
    expect(verifyPayload("no-dot-here", SECRET)).toBeNull();
    expect(verifyPayload(".onlysig", SECRET)).toBeNull();
  });

  it("rejects a correctly signed body that is not JSON", () => {
    // Sign raw bytes the way signPayload would, but without JSON inside.
    const body = Buffer.from("not json{").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
    expect(verifyPayload(`${body}.${sig}`, SECRET)).toBeNull();
  });
});

describe("safeEqual", () => {
  it("is true only for identical strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ABC")).toBe(false);
  });
  it("handles different lengths without throwing", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "a")).toBe(false);
    expect(safeEqual("a".repeat(43), "a".repeat(44))).toBe(false);
  });
  it("compares unicode by content", () => {
    expect(safeEqual("Crystal Royal ·", "Crystal Royal ·")).toBe(true);
    expect(safeEqual("é", "é")).toBe(false);
  });
});
