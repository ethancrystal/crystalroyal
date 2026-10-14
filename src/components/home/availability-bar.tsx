import { addDays, isIsoDate, todayInKarachi } from "@/lib/dates";

// The availability bar from the canvas (Main.dc.html hero, HomeMobile form): a plain GET form to /availability,
// so it works without JavaScript. Desktop: one row of ledger fields and the gold action. At 900px and below:
// a two-by-two grid of fields with the action full width underneath.

export interface AvailabilityBarDefaults {
  arrive?: string;
  depart?: string;
  adults?: number;
  children?: number;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

export function AvailabilityBar({
  defaults = {},
  maxGuests = 8,
  id = "check-availability",
  describedBy,
}: {
  defaults?: AvailabilityBarDefaults;
  /** The largest party any apartment accommodates; sets the Adults and Children options. */
  maxGuests?: number;
  id?: string;
  /** id of a message about this search (e.g. why it could not be shown). */
  describedBy?: string;
}) {
  const today = todayInKarachi();
  const arrive = defaults.arrive && isIsoDate(defaults.arrive) && defaults.arrive >= today ? defaults.arrive : "";
  const depart = defaults.depart && isIsoDate(defaults.depart) && defaults.depart > (arrive || today) ? defaults.depart : "";
  const top = Math.max(1, maxGuests);
  // A party a little larger than any apartment can still be chosen, so the guest hears why it does not fit.
  const adults = range(1, top);
  const children = range(0, Math.max(0, top - 1));
  const a = Math.min(Math.max(defaults.adults ?? 2, 1), top);
  const c = Math.min(Math.max(defaults.children ?? 0, 0), Math.max(0, top - 1));
  const fid = (k: string) => `${id}-${k}`;

  // .field comes from globals.css (unlayered), so the phone overrides carry Tailwind's important marker.
  const cell = "field max-[900px]:gap-1.5! max-[900px]:px-4! max-[900px]:py-3.5! max-[900px]:border-b!";
  const right = "max-[900px]:border-r-0!";

  return (
    <form
      id={id}
      action="/availability"
      method="get"
      aria-label="Check availability"
      aria-describedby={describedBy}
      className="flex flex-wrap max-[900px]:grid max-[900px]:grid-cols-2"
      style={{ background: "var(--color-midnight-2)", border: "1px solid var(--hair-gold-strong)", scrollMarginTop: 24 }}
    >
      <div className={cell} style={{ borderBottomColor: "var(--hair-gold)" }}>
        <label htmlFor={fid("arrive")}>Arrival</label>
        <input id={fid("arrive")} name="arrive" type="date" required min={today} defaultValue={arrive} />
      </div>
      <div className={`${cell} ${right}`} style={{ borderBottomColor: "var(--hair-gold)" }}>
        <label htmlFor={fid("depart")}>Departure</label>
        <input id={fid("depart")} name="depart" type="date" required min={addDays(today, 1)} defaultValue={depart} />
      </div>
      <div className={cell} style={{ borderBottomColor: "var(--hair-gold)" }}>
        <label htmlFor={fid("adults")}>Adults</label>
        <select id={fid("adults")} name="adults" defaultValue={String(a)}>
          {adults.map((n) => (
            <option key={n} value={n} style={{ background: "var(--color-midnight-2)" }}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className={`${cell} ${right}`} style={{ borderBottomColor: "var(--hair-gold)" }}>
        <label htmlFor={fid("children")}>Children</label>
        <select id={fid("children")} name="children" defaultValue={String(c)}>
          {children.map((n) => (
            <option key={n} value={n} style={{ background: "var(--color-midnight-2)" }}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="btn-gold min-h-[92px]! grow basis-[220px] max-[900px]:col-span-2 max-[900px]:min-h-[52px]!"
      >
        Check availability
      </button>
    </form>
  );
}
