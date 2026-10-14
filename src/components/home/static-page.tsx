import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Shell for the static pages (house rules, privacy, terms) in the site style: the midnight masthead, an ivory
// reading column at the canvas's measure (640px), display headings, and the footer.

export function StaticPage({
  eyebrow = "The fine print",
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="on-ivory">
        <div className="container-site flex flex-col gap-14 py-28 max-[900px]:gap-10 max-[900px]:py-16">
          <div className="flex flex-col gap-4" style={{ maxWidth: 640 }}>
            <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
              {eyebrow}
            </p>
            <h1 className="display text-[64px] max-[900px]:text-[40px]">{title}</h1>
            {intro ? (
              <div className="m-0" style={{ color: "var(--color-ink-2)" }}>
                {intro}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-14 max-[900px]:gap-10" style={{ maxWidth: 640 }}>
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export function StaticSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4" style={{ borderTop: "1px solid var(--color-bronze)", paddingTop: 24 }}>
      <h2 id={id} className="display text-[38px] max-[900px]:text-[30px]">
        {title}
      </h2>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/** A hairline list in the site style (house rules, what we keep). */
export function RuledList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="m-0 list-none p-0" style={{ borderTop: "1px solid var(--color-taupe)" }}>
      {items.map((item, i) => (
        <li key={i} className="py-3.5 max-[900px]:py-3" style={{ borderBottom: "1px solid var(--color-taupe)" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}
