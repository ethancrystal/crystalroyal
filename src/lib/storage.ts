import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, hasSupabaseStorage } from "./env";

// Receipts: Supabase Storage private bucket `receipts` in production; ./.data/receipts in development.
// Objects are never public. Admins read them through a 60-second signed URL (or streamed locally).

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPTS_PER_RESERVATION = 3;

const LOCAL_ROOT = path.join(process.cwd(), ".data", "receipts");

/** Type by magic bytes, never by the client's claim. Returns null for anything but JPG, PNG, WEBP or PDF. */
export function sniffReceipt(b: Uint8Array): { mime: string; ext: string } | null {
  const at = (i: number) => b[i];
  if (b.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => at(i) === v))
    return { mime: "image/png", ext: "png" };
  if (
    b.length >= 12 &&
    String.fromCharCode(at(0), at(1), at(2), at(3)) === "RIFF" &&
    String.fromCharCode(at(8), at(9), at(10), at(11)) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  if (b.length >= 5 && String.fromCharCode(at(0), at(1), at(2), at(3), at(4)) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

/** Stores the bytes at receipts/{reservationId}/{uuid}.{ext}; returns the object path. */
export async function saveReceipt(reservationId: string, bytes: Uint8Array, mime: string, ext: string): Promise<string> {
  const objectPath = `${reservationId}/${randomUUID()}.${ext}`;
  if (hasSupabaseStorage()) {
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/receipts/${objectPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.supabaseServiceKey}`, "Content-Type": mime, "x-upsert": "false" },
      body: Buffer.from(bytes),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`receipt upload failed: ${res.status} ${await res.text()}`);
    return objectPath;
  }
  if (env.isProduction) throw new Error("Supabase Storage is not configured.");
  const file = path.join(LOCAL_ROOT, objectPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return objectPath;
}

/** Supabase: a signed URL valid for 60 seconds. Local: the bytes. */
export async function openReceipt(objectPath: string): Promise<{ url: string } | { bytes: Uint8Array; mime: string }> {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(objectPath)) throw new Error("bad receipt path");
  if (hasSupabaseStorage()) {
    const res = await fetch(`${env.supabaseUrl}/storage/v1/object/sign/receipts/${objectPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.supabaseServiceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`signing failed: ${res.status}`);
    const { signedURL } = (await res.json()) as { signedURL: string };
    return { url: `${env.supabaseUrl}/storage/v1${signedURL}` };
  }
  const bytes = new Uint8Array(await readFile(path.join(LOCAL_ROOT, objectPath)));
  const sniffed = sniffReceipt(bytes);
  return { bytes, mime: sniffed?.mime ?? "application/octet-stream" };
}
