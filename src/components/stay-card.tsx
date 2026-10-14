"use client";

import Link from "next/link";
import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { addDays, nightsBetween, todayInKarachi } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { PricingError, type PriceBreakdown } from "@/lib/pricing";
import { quoteStay } from "@/lib/quote";
import type { ApartmentType, Rate, Settings } from "@/lib/types";
import { useStayUrl } from "./calendar";
import { cleanIso, ledgerDate, numberWord, partyNote, type NightState } from "./calendar-logic";
import { PriceSummary } from "./price-summary";
import { Stepper } from "./stepper";

// The apartment-page reservation card (canvas: Apartment.dc.html <aside>, ApartmentMobile card). Dates live in the
// URL (?arrive=&depart=), shared with the page's CalendarWithUrl; the party is kept in ?adults=&children= too.
// The price is a preview from quoteStay() with the same rows the server uses; the reserve steps recompute it.

export type StayCardSettings = Pick<
  Settings,
  "tax_rate_percent" | "tax_label" | "deposit_policy" | "child_extra_policy" | "child_extra_fee" | "min_nights" | "max_nights"
>;

export interface StayCardProps {
  type: Pick<ApartmentType, "slug" | "standard_guests" | "max_guests" | "min_nights">;
  /** The rate in force today (shown as the big numeral and used when no `rates` row covers the arrival). */
  rate: Pick<Rate, "nightly_rate" | "extra_adult_per_night">;
  /** Optional rate history; when given, a stay is priced at the latest row effective on its arrival. */
  rates?: Pick<Rate, "nightly_rate" | "extra_adult_per_night" | "effective_from">[];
  settings: StayCardSettings;
  /** aside (default): the desktop column, sticky. section: the mobile card under the gallery. */
  as?: "aside" | "section";
  className?: string;
  style?: React.CSSProperties;
}

const HAIR = "rgba(197, 168, 128, 0.45)";
const MUTED = "var(--color-on-dark-2)";

function intParam(v: string | null, min: number, max: number, fallback: number): number {
  const n = v === null || v.trim() === "" ? NaN : Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

function DateCell({
  label,
  value,
  min,
  today,
  onChange,
  divider,
}: {
  label: string;
  value: string;
  min: string;
  today: string;
  onChange: (v: string) => void;
  divider?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="relative block cursor-pointer focus-within:outline-2 focus-within:outline-offset-[-3px] focus-within:outline-[var(--color-gold)] max-sm:px-3.5! max-sm:py-2.5!"
      style={{ padding: "12px 16px", borderRight: divider ? `1px solid ${HAIR}` : undefined, minHeight: 44 }}
    >
      <span className="eyebrow block max-sm:text-[10px]!" style={{ color: MUTED, fontSize: 11 }}>
        {label}
      </span>
      <span aria-hidden="true" className="block" style={value ? undefined : { color: MUTED }}>
        {value ? ledgerDate(value, today) : "Choose a date"}
      </span>
      {/* The native date input covers the cell: tapping opens the platform picker; the label names it. */}
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(cleanIso(e.target.value))}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Older browsers: the input still accepts typed dates.
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        style={{ colorScheme: "dark" }}
      />
    </label>
  );
}

interface ViewProps extends StayCardProps {
  arrive: string;
  depart: string;
  initialAdults: number;
  initialChildren: number;
  setStay: (arrive: string, depart: string) => void;
  setParams: (patch: Record<string, string | number | null>) => void;
}

function StayCardView({
  type,
  rate,
  rates,
  settings,
  as = "aside",
  className = "",
  style,
  arrive,
  depart,
  initialAdults,
  initialChildren,
  setStay,
  setParams,
}: ViewProps) {
  const uid = useId();
  const today = useMemo(() => todayInKarachi(), []);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [avail, setAvail] = useState<{ key: string; ok: boolean } | null>(null);

  const standard = type.standard_guests;
  const maxGuests = type.max_guests;
  const guests = adults + children;

  // A stay is priced at the latest rate effective on its arrival (rateFor() on the server).
  const stayRate = useMemo(() => {
    if (arrive && rates?.length) {
      const r = rates
        .filter((x) => x.effective_from <= arrive)
        .sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))[0];
      if (r) return r;
    }
    return rate;
  }, [arrive, rates, rate]);

  // Are all nights free? The calendar shows the same thing; this keeps the card honest when dates are typed.
  useEffect(() => {
    if (!arrive || !depart || depart <= arrive || nightsBetween(arrive, depart) > 120) return;
    const key = `${arrive}|${depart}`;
    let cancelled = false;
    fetch(`/api/availability?${new URLSearchParams({ type: type.slug, from: arrive, to: depart })}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ nights?: { state: NightState }[] }>) : null))
      .then((body) => {
        if (!cancelled && body && Array.isArray(body.nights)) {
          setAvail({ key, ok: body.nights.every((n) => n.state === "free") });
        }
      })
      .catch(() => {
        // The reserve steps check availability again on the server.
      });
    return () => {
      cancelled = true;
    };
  }, [type.slug, arrive, depart]);

  let breakdown: PriceBreakdown | null = null;
  let error = "";
  if (arrive && depart) {
    if (arrive < today) {
      error = "Choose an arrival from today on.";
    } else {
      try {
        breakdown = quoteStay({
          type,
          rate: stayRate,
          settings,
          checkIn: arrive,
          checkOut: depart,
          adults,
          children,
          amenities: [],
        });
      } catch (e) {
        error = e instanceof PricingError ? e.message : "The price could not be worked out for these dates.";
      }
    }
  }
  const unavailable = avail !== null && avail.key === `${arrive}|${depart}` && !avail.ok;
  const ready = Boolean(breakdown) && !unavailable;
  // Why the stay cannot be reserved yet, once dates are chosen (shown in words and spoken politely).
  const message = !arrive || !depart ? "" : unavailable ? `These dates are not available for the ${type.slug} apartment.` : error;

  const setParty = (a: number, c: number) => {
    setAdults(a);
    setChildren(c);
    setParams({ adults: a, children: c });
  };

  const onArrive = (v: string) => setStay(v, v && depart > v ? depart : "");
  const onDepart = (v: string) => setStay(arrive, v);

  const childFee =
    settings.child_extra_policy === "free"
      ? 0
      : settings.child_extra_policy === "reduced"
        ? (settings.child_extra_fee ?? stayRate.extra_adult_per_night)
        : stayRate.extra_adult_per_night;

  const partyId = `${uid}-party`;
  const reasonId = `${uid}-reason`;
  const msgId = `${uid}-msg`;
  const href = `/reserve/${type.slug}?${new URLSearchParams({
    arrive,
    depart,
    adults: String(adults),
    children: String(children),
  })}`;
  const ctaClass =
    "btn-dark w-full max-sm:border-0! max-sm:bg-[var(--color-gold)]! max-sm:text-[var(--color-midnight)]! max-sm:hover:bg-[var(--color-facet)]!";
  const Tag = as;

  return (
    <Tag
      aria-label="Reserve this stay"
      className={`on-midnight flex flex-col gap-[22px] p-8 max-sm:gap-[18px] max-sm:px-4 max-sm:py-7 ${className}`}
      style={{
        ...(as === "aside" ? { flex: "1 1 380px", position: "sticky", top: 24, alignSelf: "flex-start" } : {}),
        ...style,
      }}
    >
      <p className="m-0">
        <span
          className="num max-sm:text-[42px]!"
          style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 48, lineHeight: 1.05, color: "var(--color-gold)" }}
        >
          {formatNumber(stayRate.nightly_rate)}
        </span>{" "}
        <span className="max-sm:text-[13px]!" style={{ color: MUTED, fontSize: 14 }}>
          PKR per night, plus applicable taxes
        </span>
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", border: `1px solid ${HAIR}` }}>
        <DateCell label="Arrival" value={arrive} min={today} today={today} onChange={onArrive} divider />
        <DateCell
          label="Departure"
          value={depart}
          min={addDays(arrive && arrive >= today ? arrive : today, 1)}
          today={today}
          onChange={onDepart}
        />
      </div>

      <Stepper
        label="Adults"
        value={adults}
        min={1}
        max={maxGuests !== null ? Math.max(1, maxGuests - children) : 20}
        onChange={(v) => setParty(v, children)}
        minReason="At least one adult is required."
        maxReason={null}
        describedBy={partyId}
        decLabel="Fewer adults"
        incLabel="More adults"
      />
      <Stepper
        label="Children"
        hint={standard !== null ? `Counted in the party of ${numberWord(standard)}` : undefined}
        value={children}
        min={0}
        max={maxGuests !== null ? Math.max(0, maxGuests - adults) : 20}
        onChange={(v) => setParty(adults, v)}
        maxReason={null}
        describedBy={partyId}
        decLabel="Fewer children"
        incLabel="More children"
      />
      {standard !== null && maxGuests !== null ? (
        <p id={partyId} className="m-0" style={{ fontSize: 13, color: MUTED }}>
          {partyNote(guests, standard, maxGuests)}
        </p>
      ) : null}

      {breakdown ? (
        <>
          <PriceSummary
            breakdown={breakdown}
            taxLabel={settings.tax_label}
            tone="midnight"
            variant="card"
            extraAdultFee={stayRate.extra_adult_per_night}
            extraChildFee={childFee}
            className="max-sm:hidden"
          />
          <p
            className="m-0 flex justify-between gap-4 sm:hidden"
            style={{ borderTop: "1px solid var(--hair-gold)", paddingTop: 14 }}
          >
            <span>
              {breakdown.taxRatePercent === null ? "Total before tax" : "Total"} · {breakdown.nights}{" "}
              {breakdown.nights === 1 ? "night" : "nights"}
            </span>
            <span className="num whitespace-nowrap">PKR {formatNumber(breakdown.total)}</span>
          </p>
        </>
      ) : null}

      {message ? (
        <p
          id={msgId}
          className="m-0"
          style={{ fontSize: 14, borderTop: "1px solid var(--color-bad)", paddingTop: 10, color: "var(--color-on-dark)" }}
        >
          {message}
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {message}
      </span>

      {ready ? (
        <Link href={href} className={ctaClass}>
          Reserve this stay
        </Link>
      ) : (
        <>
          <a
            role="link"
            aria-disabled="true"
            tabIndex={0}
            aria-describedby={message ? msgId : reasonId}
            className={`${ctaClass} sm:hover:bg-transparent! sm:hover:text-[var(--color-on-dark)]! max-sm:hover:bg-[var(--color-gold)]!`}
          >
            Reserve this stay
          </a>
          {!message ? (
            <p id={reasonId} className="m-0" style={{ fontSize: 13, color: MUTED, textAlign: "center", marginTop: -8 }}>
              Choose your arrival and departure to continue.
            </p>
          ) : null}
        </>
      )}
      <p className="m-0" style={{ fontSize: 13, color: MUTED, textAlign: "center" }}>
        Nothing is charged now. You settle by Meezan Bank transfer.
      </p>
    </Tag>
  );
}

function StayCardFromUrl(props: StayCardProps) {
  const { arrive, depart, setStay, setParams, params } = useStayUrl();
  return (
    <StayCardView
      {...props}
      arrive={arrive}
      depart={depart}
      initialAdults={intParam(params.get("adults"), 1, 20, 2)}
      initialChildren={intParam(params.get("children"), 0, 20, 0)}
      setStay={setStay}
      setParams={setParams}
    />
  );
}

/** The reservation card, reading and writing ?arrive=&depart=&adults=&children=. Has its own Suspense boundary. */
export function StayCard(props: StayCardProps) {
  return (
    <Suspense
      fallback={
        <StayCardView
          {...props}
          arrive=""
          depart=""
          initialAdults={2}
          initialChildren={0}
          setStay={() => {}}
          setParams={() => {}}
        />
      }
    >
      <StayCardFromUrl {...props} />
    </Suspense>
  );
}
