"use client";

import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { addMonths, monthStart, nightsBetween, todayInKarachi } from "@/lib/dates";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  cleanIso,
  dayLabel,
  dayState,
  monthFullyTaken,
  monthLabel,
  monthName,
  monthWeeks,
  moveDate,
  problemMessage,
  rangeProblem,
  selectNight,
  spokenDay,
  viewFor,
  type NightState,
  type SelectionProblem,
} from "./calendar-logic";

// The guest availability calendar (canvas: Apartment "Availability", ApartmentMobile, Reserve1, Tokens day states).
// Two months side by side from 640px, one month with previous/next below that. Nights come from
// /api/availability; the server checks every stay again when the guest reserves, so a night whose state has not
// loaded yet is treated as free rather than blocking the guest.

type MonthData = { status: "loading" } | { status: "error" } | { status: "ready"; nights: Record<string, NightState> };

const NARROW = "(max-width: 639px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** Loads (and keeps) the night states of each month once per type. */
function useMonthStates(typeSlug: string, months: string[]) {
  const [data, setData] = useState<Record<string, MonthData>>({});
  const [attempt, setAttempt] = useState(0);
  const requested = useRef(new Set<string>());
  const monthsKey = months.join(",");

  useEffect(() => {
    for (const m of monthsKey.split(",")) {
      const k = `${typeSlug}|${m}`;
      if (requested.current.has(k)) continue;
      requested.current.add(k);
      setData((d) => ({ ...d, [k]: { status: "loading" } }));
      const qs = new URLSearchParams({ type: typeSlug, from: m, to: addMonths(m, 1) });
      fetch(`/api/availability?${qs}`)
        .then(async (r) => {
          if (!r.ok) throw new Error(`availability ${r.status}`);
          const body = (await r.json()) as { nights?: { date: string; state: NightState }[] };
          if (!Array.isArray(body.nights)) throw new Error("availability: bad body");
          const nights: Record<string, NightState> = {};
          for (const n of body.nights) nights[n.date] = n.state;
          setData((d) => ({ ...d, [k]: { status: "ready", nights } }));
        })
        .catch(() => {
          requested.current.delete(k);
          setData((d) => ({ ...d, [k]: { status: "error" } }));
        });
    }
  }, [typeSlug, monthsKey, attempt]);

  const stateOf = useCallback(
    (date: string): NightState | undefined => {
      const md = data[`${typeSlug}|${monthStart(date)}`];
      return md?.status === "ready" ? md.nights[date] : undefined;
    },
    [data, typeSlug],
  );
  const statusOf = (month: string) => data[`${typeSlug}|${month}`]?.status ?? "loading";
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { stateOf, statusOf, retry };
}

export interface AvailabilityCalendarProps {
  /** Apartment type slug, e.g. "three-bedroom". */
  typeSlug: string;
  /** Controlled selection: ISO dates or "". An arrival with no departure is a selection in progress. */
  arrive: string;
  depart: string;
  onChange: (arrive: string, depart: string) => void;
  /** max(type.min_nights, settings.min_nights) and settings.max_nights. */
  minNights: number;
  maxNights: number;
  /** Months side by side from 640px (default 2). Below 640px one month shows. */
  months?: number;
  /** Rendered left of the previous/next buttons (e.g. the page's "Availability" h2). */
  heading?: React.ReactNode;
  /** plain: on the ivory page (Apartment). panel: inside an ivory-2 panel (Reserve step 1). */
  variant?: "plain" | "panel";
  className?: string;
}

export function AvailabilityCalendar({
  typeSlug,
  arrive,
  depart,
  onChange,
  minNights,
  maxNights,
  months = 2,
  heading,
  variant = "plain",
  className = "",
}: AvailabilityCalendarProps) {
  const uid = useId();
  const today = useMemo(() => todayInKarachi(), []);
  const minMonth = monthStart(today);
  const narrow = useMediaQuery(NARROW);
  const count = narrow ? 1 : Math.max(1, months);
  const panel = variant === "panel";

  const [view, setView] = useState(() => {
    const m = monthStart(arrive || today);
    return m < minMonth ? minMonth : m;
  });
  const [focusDate, setFocusDate] = useState("");
  const [problem, setProblem] = useState<SelectionProblem | null>(null);
  const [announce, setAnnounce] = useState("");
  const pendingFocus = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const rendered = useMemo(
    () => Array.from({ length: Math.max(1, months) }, (_, i) => addMonths(view, i)),
    [view, months],
  );
  const { stateOf, statusOf, retry } = useMonthStates(typeSlug, rendered);
  const lastVisible = addMonths(view, count - 1);
  const isVisible = (d: string) => monthStart(d) >= view && monthStart(d) <= lastVisible;

  // An arrival chosen elsewhere (date inputs, a link) brings its month into view.
  useEffect(() => {
    if (!arrive) return;
    setView((v) => viewFor(v, count, arrive, minMonth));
  }, [arrive, count, minMonth]);

  const tabbable =
    focusDate && isVisible(focusDate)
      ? focusDate
      : arrive && isVisible(arrive)
        ? arrive
        : isVisible(today)
          ? today
          : view;

  // Layout effect: focus must land on the new cell before the next key press is handled.
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    root.current?.querySelector<HTMLButtonElement>(`button[data-date="${tabbable}"]`)?.focus();
  });

  const choose = (date: string) => {
    setFocusDate(date);
    const { selection, problem: p } = selectNight({ arrive, depart }, date, { today, stateOf, minNights, maxNights });
    setProblem(p);
    if (p) return;
    if (selection.arrive !== arrive || selection.depart !== depart) {
      onChange(selection.arrive, selection.depart);
      if (!selection.arrive) setAnnounce("Dates cleared.");
      else if (!selection.depart) setAnnounce(`Arrival ${spokenDay(selection.arrive)}. Now choose your departure.`);
      else {
        const n = nightsBetween(selection.arrive, selection.depart);
        setAnnounce(
          `${spokenDay(selection.arrive)} to ${spokenDay(selection.depart)}, ${n} ${n === 1 ? "night" : "nights"}.`,
        );
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, date: string) => {
    if (e.key === "Escape") {
      if (arrive || depart || problem) {
        e.preventDefault();
        setProblem(null);
        if (arrive || depart) {
          onChange("", "");
          setAnnounce("Dates cleared.");
        }
      }
      return;
    }
    const next = moveDate(date, e.key);
    if (!next) return; // Enter and Space activate the button: a normal click.
    e.preventDefault();
    if (monthStart(next) < minMonth) return;
    setView((v) => viewFor(v, count, next, minMonth));
    setFocusDate(next);
    pendingFocus.current = true;
  };

  const canPrev = view > minMonth;
  const go = (n: number) => setView((v) => (addMonths(v, n) < minMonth ? minMonth : addMonths(v, n)));

  const ink2 = "var(--color-ink-2)";
  const navBtn = (dir: -1 | 1, label: string, bare = false) => {
    const disabled = dir === -1 && !canPrev;
    return (
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && go(dir)}
        className="flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          border: bare ? 0 : "1px solid var(--color-ink)",
          background: "transparent",
          color: "var(--color-ink)",
          fontSize: bare ? 20 : 17,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.3 : 1,
        }}
      >
        <span aria-hidden="true">{dir === -1 ? "‹" : "›"}</span>
      </button>
    );
  };

  const anyError = rendered.some((m) => statusOf(m) === "error");
  // A range chosen elsewhere (typed dates, a shared link) can still conflict; say so in words here too.
  const shown =
    problem ??
    (arrive && depart && depart > arrive && arrive >= today
      ? rangeProblem(arrive, depart, { today, stateOf, minNights, maxNights })
      : null);
  const hintId = `${uid}-hint`;
  const msgId = `${uid}-msg`;
  const multi = count > 1 || months > 1;

  return (
    <div ref={root} className={`flex flex-col ${className}`} style={{ gap: 20, color: "var(--color-ink)" }}>
      <div className={`${heading ? "flex" : "hidden sm:flex"} flex-wrap items-baseline justify-between gap-3`}>
        {heading ? <div className="min-w-0">{heading}</div> : <span />}
        <div className="hidden gap-2 sm:flex">
          {navBtn(-1, multi ? "Previous months" : "Previous month")}
          {navBtn(1, multi ? "Next months" : "Next month")}
        </div>
      </div>

      <div style={panel ? { background: "var(--color-ivory-2)" } : undefined} className={panel ? "p-3.5 sm:p-7" : undefined}>
        <div className="flex items-center justify-between sm:hidden" style={{ marginBottom: panel ? 6 : 12 }}>
          {navBtn(-1, "Previous month", panel)}
          <span className={panel ? undefined : "eyebrow"} style={panel ? { fontWeight: 500 } : { color: "var(--color-bronze)" }}>
            {monthLabel(view)}
          </span>
          {navBtn(1, "Next month", panel)}
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 40 }}>
          {rendered.map((m, i) => {
            const weeks = monthWeeks(m);
            const loading = statusOf(m) === "loading";
            const full = monthFullyTaken(m, today, stateOf);
            return (
              <div key={m} className={i > 0 ? "max-sm:hidden" : undefined}>
                <p
                  className={`hidden sm:block ${panel ? "" : "eyebrow"}`}
                  style={panel ? { margin: "0 0 10px", fontWeight: 500 } : { margin: "0 0 12px", color: "var(--color-bronze)" }}
                  aria-hidden="true"
                >
                  {monthLabel(m)}
                </p>
                <div
                  role="grid"
                  aria-label={monthLabel(m)}
                  aria-describedby={`${hintId} ${msgId}`}
                  aria-busy={loading || undefined}
                >
                  <div role="row" className="grid grid-cols-7">
                    {WEEKDAY_SHORT.map((w, wi) => (
                      <div
                        key={w}
                        role="columnheader"
                        aria-label={WEEKDAY_LONG[wi]}
                        className="day max-sm:h-7! max-sm:text-[10px]!"
                        style={{ height: panel ? 30 : 32, fontSize: 11, letterSpacing: ".14em", color: ink2 }}
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                  {weeks.map((week, wi) => (
                    <div key={wi} role="row" className="grid grid-cols-7">
                      {week.map((d, di) => {
                        if (!d) return <div key={`e${di}`} role="gridcell" />;
                        const state = dayState(d, { arrive, depart, today, state: stateOf(d) });
                        const inRange = state === "selected" || state === "departure";
                        return (
                          <div key={d} role="gridcell" aria-selected={inRange}>
                            <button
                              type="button"
                              data-date={d}
                              data-state={state}
                              tabIndex={d === tabbable ? 0 : -1}
                              aria-label={dayLabel(d, state, arrive)}
                              aria-disabled={state === "past" || undefined}
                              aria-current={d === today ? "date" : undefined}
                              onClick={() => choose(d)}
                              onKeyDown={(e) => onKeyDown(e, d)}
                              className={`day relative w-full focus-visible:z-10 max-sm:h-11! max-sm:text-[14px]! ${panel ? "sm:h-12!" : ""} ${
                                state === "available" ? "hover:border-[var(--color-ink-2)]!" : ""
                              }`}
                              style={{ cursor: state === "past" ? "default" : "pointer" }}
                            >
                              {Number(d.slice(8))}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {full ? (
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: ink2 }}>{monthName(m)} is fully reserved.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p id={msgId} className="err" aria-live="polite" style={{ margin: 0 }}>
        {shown ? problemMessage(shown) : ""}
      </p>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>

      <div className="flex flex-col" style={{ gap: 8 }}>
        <ul className="m-0 flex list-none flex-wrap p-0" style={{ gap: "8px 20px", fontSize: 13, color: ink2 }}>
          <li className="flex items-center" style={{ gap: 8 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, background: "var(--color-midnight)" }} />
            Your stay
          </li>
          <li className="flex items-center" style={{ gap: 8 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, background: "var(--color-taupe)" }} />
            Reserved
          </li>
          <li className="flex items-center" style={{ gap: 8 }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, border: "1px dashed var(--color-ink-2)" }} />
            Unavailable
          </li>
        </ul>
        <p id={hintId} style={{ margin: 0, fontSize: 13, color: ink2 }}>
          Tap a night for arrival and another for departure. Stays are from {minNights} to {maxNights} nights. Every
          date is Karachi time.
        </p>
        {anyError ? (
          <p role="status" style={{ margin: 0, fontSize: 13, color: ink2 }}>
            Availability could not be loaded just now. Your dates are checked again when you reserve.{" "}
            <button
              type="button"
              onClick={retry}
              style={{
                minHeight: 44,
                padding: 0,
                border: 0,
                background: "transparent",
                color: "var(--color-bronze)",
                textDecoration: "underline",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Try again
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------- URL-backed selection ----------

/**
 * arrive/depart kept in the URL search params, so the apartment-page calendar and the stay card stay in sync
 * without a shared parent. Writes use history.replaceState, which Next.js folds into useSearchParams without a
 * server round trip (router.replace would re-render the whole page on every tap); a local copy makes the change
 * immediate even before the URL settles.
 */
export function useStayUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  const urlArrive = cleanIso(params.get("arrive"));
  const urlDepart = cleanIso(params.get("depart"));
  const [local, setLocal] = useState({ arrive: urlArrive, depart: urlDepart });

  useEffect(() => {
    // Read the live location: it already holds the newest write, even if this render's params lag behind it.
    const live = new URLSearchParams(window.location.search);
    const a = cleanIso(live.get("arrive"));
    const d = cleanIso(live.get("depart"));
    setLocal((prev) => (prev.arrive === a && prev.depart === d ? prev : { arrive: a, depart: d }));
  }, [urlArrive, urlDepart]);

  const setParams = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    },
    [pathname],
  );

  const setStay = useCallback(
    (arrive: string, depart: string) => {
      setLocal({ arrive, depart });
      setParams({ arrive, depart });
    },
    [setParams],
  );

  return { arrive: local.arrive, depart: local.depart, setStay, setParams, params };
}

export type CalendarWithUrlProps = Omit<AvailabilityCalendarProps, "arrive" | "depart" | "onChange"> & {
  /** Called after the URL is updated. */
  onChange?: (arrive: string, depart: string) => void;
};

function UrlCalendar({ onChange, ...props }: CalendarWithUrlProps) {
  const { arrive, depart, setStay } = useStayUrl();
  return (
    <AvailabilityCalendar
      {...props}
      arrive={arrive}
      depart={depart}
      onChange={(a, d) => {
        setStay(a, d);
        onChange?.(a, d);
      }}
    />
  );
}

/** The calendar with its selection in ?arrive=&depart=. Safe on statically rendered pages (own Suspense boundary). */
export function CalendarWithUrl(props: CalendarWithUrlProps) {
  return (
    <Suspense fallback={<AvailabilityCalendar {...props} arrive="" depart="" onChange={() => {}} />}>
      <UrlCalendar {...props} />
    </Suspense>
  );
}
