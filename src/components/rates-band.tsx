import { RATES_FOOTNOTE, RATES_WORDING } from "@/lib/site";

/** "Occupancy and nightly rates" — contractual wording, reproduced verbatim on midnight (home) or ivory (apartment). */
export function RatesBand({ tone = "midnight", only }: { tone?: "midnight" | "ivory"; only?: string }) {
  const items = only ? RATES_WORDING.filter((r) => r.slug === only) : RATES_WORDING;
  const dark = tone === "midnight";
  const muted = dark ? "var(--color-on-dark-2)" : "var(--color-ink-2)";
  const rule = dark ? "var(--color-gold)" : "var(--color-bronze)";
  return (
    <section aria-labelledby="rates-h" className={dark ? "on-midnight" : "on-ivory-2"}>
      <div className="container-site flex flex-col gap-10" style={{ paddingTop: dark ? 112 : 56, paddingBottom: dark ? 112 : 56 }}>
        <h2 id="rates-h" className="eyebrow" style={{ color: dark ? "var(--color-gold)" : "var(--color-bronze)" }}>
          Occupancy and nightly rates
        </h2>
        <div className="grid gap-14" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))" }}>
          {items.map((r) => (
            <div key={r.slug} className="flex flex-col gap-4" style={{ borderTop: `1px solid ${rule}`, paddingTop: 28 }}>
              <p className="display" style={{ fontSize: 30, fontWeight: 400 }}>
                {r.title}
              </p>
              <p style={{ margin: 0, color: muted }}>{r.body}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: muted }}>{RATES_FOOTNOTE}</p>
      </div>
    </section>
  );
}
