import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { PhText, Section } from "@/components/admin/ui";
import { emailPreviews } from "@/components/admin/settings/email-samples";

// Email previews (brief: "rendered from the templates with sample data"; canvas: the "Email previews" row of
// buttons). All ten templates rendered by renderEmail() with a sample reservation, each with its subject above it and
// the HTML in a fully sandboxed iframe (no scripts, no navigation, nothing loaded from this origin).

export const metadata: Metadata = { title: "Email previews" };

/** Links inside a preview open nothing: the sandbox blocks new windows, and <base target> keeps the frame in place. */
function frameDoc(html: string): string {
  return html.replace("<html>", '<html><head><base target="_blank"><meta name="color-scheme" content="light"></head>');
}

export default async function EmailPreviewsPage() {
  await requireAdmin();
  const { previews, priced } = await emailPreviews();

  return (
    <Section id="emails" title="Email previews" variant="display" gap={24}>
      <p className="m-0 max-w-[760px] text-[14px] text-ink-2">
        Every email as it is sent, rendered from the templates with a sample reservation: CRA-2611-0042, Sana Ahmed, the
        three-bedroom from 2 to 5 November, 2 adults and 4 children
        {priced ? ", priced with today’s rate and settings" : ""}. Bank details, contact details and times come from the
        current settings, so anything still [bracketed] appears bracketed here too. Nothing is sent from this page.
      </p>
      <nav aria-label="Jump to an email">
        <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
          {previews.map((p) => (
            <li key={p.kind}>
              <a
                href={`#email-${p.kind}`}
                className="inline-flex min-h-[44px] items-center border border-ink px-[18px] font-sans text-[12px] font-medium uppercase tracking-[.14em] text-ink! no-underline transition-colors hover:bg-ink hover:text-ivory!"
              >
                {p.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {previews.map((p) => (
        <article
          key={p.kind}
          id={`email-${p.kind}`}
          aria-labelledby={`email-${p.kind}-h`}
          className="flex scroll-mt-6 flex-col gap-3 border-t border-bronze pt-5"
        >
          <h3 id={`email-${p.kind}-h`} className="eyebrow text-bronze">
            {p.label}
          </h3>
          <dl className="m-0 grid gap-x-4 gap-y-1 text-[14px] [grid-template-columns:minmax(0,80px)_minmax(0,1fr)]">
            <dt className="text-ink-2">Subject</dt>
            <dd className="m-0 min-w-0 break-words text-[16px] font-medium text-ink">
              <PhText text={p.subject} />
            </dd>
            <dt className="text-ink-2">To</dt>
            <dd className="m-0 min-w-0 break-words">
              <PhText text={p.to} />
            </dd>
            <dt className="text-ink-2">Sent</dt>
            <dd className="m-0 min-w-0">{p.when}</dd>
          </dl>
          <iframe
            title={`Preview: ${p.label}`}
            srcDoc={frameDoc(p.html)}
            sandbox=""
            referrerPolicy="no-referrer"
            className="block h-[560px] w-full max-w-[680px] border border-taupe bg-ivory"
          />
          <details className="max-w-[680px]">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] text-bronze underline underline-offset-2">
              Plain-text version
            </summary>
            <pre className="m-0 mt-2 whitespace-pre-wrap break-words border border-taupe bg-paper p-4 font-sans text-[13px] leading-[1.6] text-ink">
              {p.text}
            </pre>
          </details>
        </article>
      ))}
    </Section>
  );
}
