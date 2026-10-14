"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16 font-sans text-ink">
      <h1 className="m-0 text-[28px] font-normal">Something went wrong</h1>
      <p className="mt-3 text-[15px]">This page could not be shown. Nothing has been changed.</p>
      {error.digest ? <p className="text-[13px]">Reference for the logs: {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center border border-ink bg-transparent px-5 text-[13px] uppercase tracking-[.14em]"
      >
        Try again
      </button>
    </main>
  );
}
