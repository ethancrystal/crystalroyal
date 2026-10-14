"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile } from "@/components/turnstile";
import { uploadReceipt, type UploadResult } from "@/app/reservation/[reference]/actions";

// The receipt upload zone (canvas Payment.dc.html): idle (dashed gold frame, drop or choose), uploading (file name
// and size, a gold hairline that fills), done ("Receipt received"), and failed (the reason inline, the zone ready
// again). Choosing or dropping a file starts the upload; without JavaScript a plain "Upload receipt" button posts
// the same form. The server checks everything again: size, type by magic bytes, receipt count and the token.
// Server actions do not report upload progress, so the hairline eases towards full while the request runs and the
// words carry the real state.

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";
const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const OK_EXT = /\.(jpe?g|png|webp|pdf)$/i;

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Quick checks before sending anything; the server repeats them authoritatively. */
function precheck(f: File): string | null {
  if (f.size === 0) return "This file is empty. Choose the receipt again.";
  if (f.size > MAX_BYTES) return "This file is larger than 10 MB. Choose a smaller copy, or send it on WhatsApp.";
  if (!OK_TYPES.has(f.type) && !OK_EXT.test(f.name)) {
    return "This file is not a JPG, PNG, WEBP or PDF. Choose a photo or PDF of the receipt.";
  }
  return null;
}

export interface UploadZoneProps {
  reference: string;
  token: string;
  tone?: "midnight" | "ivory";
  /** A receipt is already with the property (status payment_submitted): open on the done state. */
  received?: { label: string } | null;
  /** False once the reservation holds the maximum number of receipts. */
  canAddMore: boolean;
  /** id of the visible heading that names the zone. */
  labelledBy?: string;
}

export function UploadZone({ reference, token, tone = "midnight", received = null, canAddMore, labelledBy }: UploadZoneProps) {
  const [result, formAction, pending] = useActionState<UploadResult, FormData>(uploadReceipt, { status: "idle" });
  const [mode, setMode] = useState<"idle" | "done">(received ? "done" : "idle");
  const [chosen, setChosen] = useState<{ name: string; size: number } | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<UploadResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [dragging, setDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  const id = useId();
  const inputId = `${id}-file`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (result.status === "idle") return;
    // A Turnstile token is single-use: a fresh widget for the next attempt.
    setAttempt((a) => a + 1);
    if (result.status === "done") {
      setMode("done");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }, [result, router]);

  // The gold hairline: eases towards full over a time scaled to the file size; static under reduced motion.
  useEffect(() => {
    const el = barRef.current;
    if (!pending || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = "scaleX(0.5)";
      return;
    }
    const duration = Math.min(20000, Math.max(1500, ((chosen?.size ?? 1_000_000) / 250_000) * 1000));
    const anim = el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(0.92)" }], {
      duration,
      easing: "cubic-bezier(.1,.6,.3,1)",
      fill: "forwards",
    });
    return () => anim.cancel();
  }, [pending, chosen]);

  const serverError = result.status === "error" && result !== dismissed ? result.message : null;
  const error = clientError ?? serverError;

  function start(file: File) {
    setDismissed(result);
    const problem = precheck(file);
    if (problem) {
      setClientError(problem);
      setChosen(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setClientError(null);
    setChosen({ name: file.name, size: file.size });
    formRef.current?.requestSubmit();
  }

  const dark = tone === "midnight";
  const text = dark ? "var(--color-on-dark)" : "var(--color-ink)";
  const muted = dark ? "var(--color-on-dark-2)" : "var(--color-ink-2)";
  const accent = dark ? "var(--color-gold)" : "var(--color-bronze)";
  const panel: React.CSSProperties = {
    minHeight: 180,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: 24,
    color: text,
  };

  const doneLabel = result.status === "done" ? result.fileName : received?.label;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col" style={{ gap: 12 }} aria-labelledby={labelledBy}>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="t" value={token} />

      {/* The file input stays mounted in every state so the form always posts it. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name="receipt"
        accept={ACCEPT}
        className="peer sr-only"
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        aria-invalid={error ? true : undefined}
        disabled={pending || mode === "done"}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) start(f);
        }}
      />

      {pending ? (
        <div role="status" style={{ ...panel, gap: 14, border: "1px solid rgba(197,168,128,.6)" }}>
          <span className="[overflow-wrap:anywhere]">
            {chosen ? `${chosen.name} · ${fileSize(chosen.size)}` : "Your receipt"}
          </span>
          <span aria-hidden="true" style={{ height: 2, background: "rgba(197,168,128,.25)", position: "relative", overflow: "hidden" }}>
            <span
              ref={barRef}
              style={{ position: "absolute", inset: 0, background: "var(--color-gold)", transformOrigin: "left", transform: "scaleX(0)" }}
            />
          </span>
          <span style={{ fontSize: 13, color: muted }}>Uploading</span>
        </div>
      ) : mode === "done" ? (
        <div role="status" style={{ ...panel, gap: 10, border: "1px solid var(--color-ok)" }}>
          <span className="pill pill-ok" style={{ alignSelf: "flex-start" }}>
            Receipt received
          </span>
          {doneLabel ? <span className="[overflow-wrap:anywhere]">{doneLabel}</span> : null}
          <span style={{ fontSize: 14, color: muted }}>We will confirm shortly.</span>
          {canAddMore ? (
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setChosen(null);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="cursor-pointer self-start border-0 bg-transparent p-0 underline underline-offset-4"
              style={{ minHeight: 44, color: accent, fontFamily: "var(--font-sans)", fontSize: 15 }}
            >
              Upload another receipt
            </button>
          ) : null}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (!f || !inputRef.current) return;
            const dt = new DataTransfer();
            dt.items.add(f);
            inputRef.current.files = dt.files;
            start(f);
          }}
          className="cursor-pointer items-center text-center peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-[var(--color-gold)] max-[640px]:min-h-[150px]!"
          style={{
            ...panel,
            gap: 8,
            border: `1px ${dragging ? "solid" : "dashed"} ${error ? "var(--color-bad)" : accent}`,
            background: dragging ? (dark ? "var(--color-midnight-2)" : "var(--color-ivory-2)") : "transparent",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.3" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          <span>
            <span className="hide-sm">
              Drop the receipt here, or <span style={{ color: accent, textDecoration: "underline" }}>choose a file</span>
            </span>
            <span className="show-sm">Upload your transfer receipt</span>
          </span>
          <span id={hintId} style={{ fontSize: 13, color: muted }}>
            <span className="hide-sm">JPG, PNG or PDF, up to 10 MB</span>
            <span className="show-sm">Photo or PDF, up to 10 MB</span>
          </span>
        </label>
      )}

      {error && !pending ? (
        <p id={errorId} role="alert" className="m-0 flex flex-col items-start" style={{ fontSize: 15, gap: 8, color: text }}>
          <span className="pill pill-bad">Not uploaded</span>
          <span>{error}</span>
        </p>
      ) : null}

      {mode === "idle" ? <Turnstile key={attempt} tone={tone} action="upload" /> : null}

      {!hydrated && mode === "idle" ? (
        <button type="submit" className={dark ? "btn-dark" : "btn-light"} style={{ alignSelf: "flex-start" }}>
          Upload receipt
        </button>
      ) : null}
    </form>
  );
}
