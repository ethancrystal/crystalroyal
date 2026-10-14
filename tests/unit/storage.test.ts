import { afterEach, describe, expect, it, vi } from "vitest";
import { sniffReceipt } from "@/lib/storage";

// Receipts are typed by their magic bytes, never by the file name or the browser's claim.

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...Buffer.from(x, "latin1")] : [x])));

describe("sniffReceipt", () => {
  it("JPG", () => {
    expect(sniffReceipt(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, "JFIF"))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffReceipt(bytes(0xff, 0xd8, 0xff, 0xe1, "Exif"))).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });
  it("PNG", () => {
    expect(sniffReceipt(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, "IHDR"))).toEqual({ mime: "image/png", ext: "png" });
  });
  it("WEBP", () => {
    expect(sniffReceipt(bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 "))).toEqual({ mime: "image/webp", ext: "webp" });
  });
  it("PDF", () => {
    expect(sniffReceipt(bytes("%PDF-1.7\n%"))).toEqual({ mime: "application/pdf", ext: "pdf" });
  });

  it.each([
    ["empty", bytes()],
    ["plain text", bytes("Receipt for CRA-2611-0042")],
    ["HTML", bytes("<!doctype html><script>")],
    ["SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
    ["GIF", bytes("GIF89a", 1, 0)],
    ["Windows executable", bytes("MZ", 0x90, 0)],
    ["ZIP / DOCX", bytes("PK", 3, 4)],
    ["RIFF that is not WEBP (WAV)", bytes("RIFF", 0x24, 0, 0, 0, "WAVEfmt ")],
    ["PNG signature cut short", bytes(0x89, "PNG")],
    ["JPG marker cut short", bytes(0xff, 0xd8)],
    ["PDF marker without the dash", bytes("%PDF1.7")],
    ["PDF marker not at the start", bytes(" %PDF-1.7")],
  ])("refuses %s", (_label, b) => {
    expect(sniffReceipt(b)).toBeNull();
  });
});

describe("deleteReceiptObject (Supabase Storage)", () => {
  const path = "4f1c2a8e-1111-4a2b-8c3d-0123456789ab/9d8c7b6a-2222-4e5f-9a0b-abcdefabcdef.png";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function load(fetchImpl: (url: string, init: RequestInit) => Promise<Response>) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const fetchMock = vi.fn(fetchImpl);
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const mod = await import("@/lib/storage-retention");
    return { deleteReceiptObject: mod.deleteReceiptObject, fetchMock };
  }

  it("sends DELETE for the object in the private receipts bucket with the service key", async () => {
    const { deleteReceiptObject, fetchMock } = await load(async () => new Response('{"message":"Successfully deleted"}', { status: 200 }));
    await expect(deleteReceiptObject(path)).resolves.toBe("deleted");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://project.supabase.co/storage/v1/object/receipts/${path}`);
    expect(init.method).toBe("DELETE");
    expect(init.headers).toMatchObject({ Authorization: "Bearer service-role-key", apikey: "service-role-key" });
  });

  it("treats an object that is already gone as deleted", async () => {
    const notFound400 = await load(
      async () => new Response('{"statusCode":"404","error":"not_found","message":"Object not found"}', { status: 400 }),
    );
    await expect(notFound400.deleteReceiptObject(path)).resolves.toBe("missing");
    const notFound404 = await load(async () => new Response("", { status: 404 }));
    await expect(notFound404.deleteReceiptObject(path)).resolves.toBe("missing");
  });

  it("throws when storage refuses, so the path is kept for the next run", async () => {
    const forbidden = await load(async () => new Response('{"error":"Unauthorized"}', { status: 403 }));
    await expect(forbidden.deleteReceiptObject(path)).rejects.toThrow(/403/);
    const down = await load(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(down.deleteReceiptObject(path)).rejects.toThrow("fetch failed");
  });

  it("never sends a path that is not a receipt path", async () => {
    const { deleteReceiptObject, fetchMock } = await load(async () => new Response("", { status: 200 }));
    for (const bad of ["../secrets.png", `${path}/../../x.png`, "a/b.png", `${path}.exe`, ""]) {
      await expect(deleteReceiptObject(bad)).rejects.toThrow("not a receipt path");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
