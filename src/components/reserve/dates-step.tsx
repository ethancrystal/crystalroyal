"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AvailabilityCalendar } from "@/components/calendar";
import { ledgerDate, numberWord } from "@/components/calendar-logic";
import { Stepper } from "@/components/stepper";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { nightsBetween, todayInKarachi } from "@/lib/dates";
import { formatNumber } from "@/lib/money";
import { FolioSpine } from "./folio-spine";
import { ReserveFrame, StepHeading } from "./frame";
import { MobileStayBar } from "./mobile-bar";
import { PendingSubmit } from "./pending-submit";
import {
  ageHints,
  arrowRange,
  childFee,
  choicesQuery,
  guestsWords,
  nightsWords,
  parseAm,
  partyLines,
  partyTooLargeMessage,
  previewQuote,
  stayRange,
  type AmenityLite,
  type PricingSettings,
  type RateLite,
  type TypeLite,
} from "./shared";
import { StateCard } from "./state-card";
import { SITE } from "@/lib/site";

// Step 1 · Dates and guests (canvas Reserve1, ReserveMobile). The calendar and the party steppers are kept in the
// URL as the guest chooses, so the spine, the mobile bar and a reload all agree. "Continue" posts to the server,
// which checks the stay (and its availability) and either moves on or returns here with the problem.

export interface DatesProblem {
  code: string;
  message: string;
  nearby: { arrive: string; depart: string; label: string }[];
}

export interface DatesStepProps {
  slug: string;
  type: TypeLite & { standard_guests: number; max_guests: number };
  rates: RateLite[];
  currentRate: RateLite;
  settings: PricingSettings;
  amenities: AmenityLite[];
  minNights: number;
  maxNights: number;
  initial: { arrive: string; depart: string; adults: number; children: number; am: string };
  problem: DatesProblem | null;
  whatsappNumber: string;
  childMaxAge: number | null;
  action: (formData: FormData) => Promise<void>;
}

const BANNER_CODES = new Set(["unavailable", "taken", "party"]);

export function DatesStep({
  slug,
  type,
  rates,
  currentRate,
  settings,
  amenities,
  minNights,
  maxNights,
  initial,
  problem,
  whatsappNumber,
  childMaxAge,
  action,
}: DatesStepProps) {
  const uid = useId();
  const today = useMemo(() => todayInKarachi(), []);
  const [arrive, setArrive] = useState(initial.arrive);
  const [depart, setDepart] = useState(initial.depart);
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [localError, setLocalError] = useState("");
  const problemRef = useRef<HTMLElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  const qty = useMemo(() => parseAm(initial.am), [initial.am]);
  const guests = adults + children;
  const max = type.max_guests;
  const standard = type.standard_guests;

  // Keep the choices in the URL (no server round trip): a reload, the step links and the back link see them.
  // Written only when they differ from the URL, so a problem named in it (?error=) stays until something changes.
  useEffect(() => {
    const live = new URLSearchParams(window.location.search);
    const same =
      (live.get("arrive") ?? "") === arrive &&
      (live.get("depart") ?? "") === depart &&
      (live.get("adults") ?? "") === String(adults) &&
      (live.get("children") ?? "") === String(children);
    if (same) return;
    const q = choicesQuery({ arrive, depart, adults: String(adults), children: String(children), am: initial.am });
    window.history.replaceState(null, "", `${window.location.pathname}${q}`);
  }, [arrive, depart, adults, children, initial.am]);

  // A problem returned by the server belongs to the choices it was found with; it goes once they change.
  const unchanged =
    arrive === initial.arrive && depart === initial.depart && adults === initial.adults && children === initial.children;
  const shownProblem = problem && unchanged ? problem : null;
  const banner = shownProblem && BANNER_CODES.has(shownProblem.code) ? shownProblem : null;
  const inlineProblem = shownProblem && !banner ? shownProblem.message : "";
  const tooLarge = guests > max;

  useEffect(() => {
    if (!problem) return;
    (BANNER_CODES.has(problem.code) ? problemRef.current : messageRef.current)?.focus();
    // Only when the page arrives with a problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { breakdown, error: quoteError, rate } = previewQuote({
    type,
    rates,
    currentRate,
    settings,
    arrive,
    depart,
    adults,
    children,
    qty,
    amenities,
    today,
  });
  const fees = { extraAdultFee: rate.extra_adult_per_night, extraChildFee: childFee(settings, rate) };
  const nights = arrive && depart && depart > arrive ? nightsBetween(arrive, depart) : 0;
  const hints = ageHints(childMaxAge);
  const lines = partyLines(guests, standard, max, rate.extra_adult_per_night);
  const partyId = `${uid}-party`;
  const msgId = `${uid}-msg`;
  const message = localError || inlineProblem;

  const setStay = (a: string, d: string) => {
    setArrive(a);
    setDepart(d);
    setLocalError("");
  };
  const setParty = (a: number, c: number) => {
    setAdults(a);
    setChildren(c);
    setLocalError("");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!arrive || !depart) {
      e.preventDefault();
      setLocalError("Choose your arrival and departure to continue.");
      messageRef.current?.focus();
    } else if (tooLarge) {
      e.preventDefault();
      problemRef.current?.focus();
    }
  };

  const stayLine = nights
    ? `${stayRange(arrive, depart)} · ${nightsWords(nights)} · ${guestsWords(guests)}`
    : guestsWords(guests);

  const datesSummary = nights ? `${arrowRange(arrive, depart, today)} · ${nightsWords(nights)}` : arrive ? `Arrival ${ledgerDate(arrive, today)} · choose a departure` : "";

  const partyCard = tooLarge ? (
    <StateCard
      ref={problemRef}
      tone="wait"
      pill="Party too large"
      heading={`This apartment welcomes up to ${numberWord(max)}`}
      actions={
        <WhatsAppLink
          number={whatsappNumber}
          text={`Reservation enquiry: ${type.name}, ${guests} guests`}
          className="btn-light"
          style={{ minHeight: 48, padding: "0 24px", fontSize: 12 }}
          plainClassName="text-[15px]"
        >
          Ask on WhatsApp
        </WhatsAppLink>
      }
    >
      <p className="m-0">{partyTooLargeMessage(max)}</p>
    </StateCard>
  ) : null;

  const datesBanner =
    banner && banner.code !== "party" ? (
      <StateCard
        ref={problemRef}
        tone="bad"
        pill="Unavailable"
        heading={banner.code === "taken" ? "Those nights have just been reserved" : undefined}
        actions={banner.nearby.map((n) => (
          <button
            key={n.arrive}
            type="button"
            className="btn-light"
            style={{ minHeight: 48, padding: "0 24px", fontSize: 12 }}
            onClick={() => setStay(n.arrive, n.depart)}
          >
            See {n.label}
          </button>
        ))}
      >
        <p className="m-0">{banner.message}</p>
      </StateCard>
    ) : null;

  const main = (
    <div className="flex flex-col gap-8 lg:gap-12">
      <StepHeading
        step={1}
        typeName={type.name}
        title="When will you arrive, and who is coming?"
        mobileTitle="Dates and guests"
      />

      {datesBanner}

      <section aria-labelledby={`${uid}-dates`} className="flex flex-col" style={{ gap: 12 }}>
        <h2 id={`${uid}-dates`} className="eyebrow sm:hidden" style={{ color: "var(--color-bronze)" }}>
          Your dates
        </h2>
        <dl className="m-0 grid sm:hidden" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", border: "1px solid var(--color-ink)" }}>
          {[
            ["Arrival", arrive],
            ["Departure", depart],
          ].map(([label, v], i) => (
            <div key={label} style={{ padding: "10px 14px", borderRight: i === 0 ? "1px solid var(--color-ink)" : undefined }}>
              <dt style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-ink-2)" }}>{label}</dt>
              <dd className="m-0" style={v ? undefined : { color: "var(--color-ink-2)" }}>
                {v ? ledgerDate(v, today) : "Choose a date"}
              </dd>
            </div>
          ))}
        </dl>
        <AvailabilityCalendar
          typeSlug={slug}
          arrive={arrive}
          depart={depart}
          onChange={setStay}
          minNights={minNights}
          maxNights={maxNights}
          months={2}
          variant="panel"
          heading={
            <div className="flex flex-wrap items-baseline max-sm:hidden" style={{ gap: "4px 24px" }}>
              <h2 className="eyebrow" style={{ color: "var(--color-bronze)" }}>
                Your dates
              </h2>
              {datesSummary ? (
                <p className="num m-0" style={{ fontSize: 15 }}>
                  {datesSummary}
                </p>
              ) : null}
            </div>
          }
        />
        {nights ? (
          <p className="num m-0 sm:hidden" style={{ fontSize: 14 }}>
            {nightsWords(nights)}
          </p>
        ) : null}
      </section>

      <section aria-labelledby={`${uid}-party-h`} className="flex flex-col" style={{ gap: 6, maxWidth: 640 }}>
        <h2 id={`${uid}-party-h`} className="eyebrow" style={{ color: "var(--color-bronze)", marginBottom: 8 }}>
          Your party
        </h2>
        <Stepper
          label="Adults"
          hint={hints.adults}
          value={adults}
          min={1}
          max={Math.max(1, max - children)}
          onChange={(v) => setParty(v, children)}
          tone="ivory"
          minReason="At least one adult is required."
          maxReason={null}
          describedBy={partyId}
          decLabel="Fewer adults"
          incLabel="More adults"
        />
        <Stepper
          label="Children"
          hint={hints.children}
          value={children}
          min={0}
          max={Math.max(0, max - adults)}
          onChange={(v) => setParty(adults, v)}
          tone="ivory"
          maxReason={null}
          describedBy={partyId}
          decLabel="Fewer children"
          incLabel="More children"
        />
        <div id={partyId} role="status" className="flex flex-col" style={{ marginTop: 12, gap: 2 }}>
          {lines.map((l) => (
            <p key={l} className="m-0" style={{ fontSize: 15, color: "var(--color-ink-2)" }}>
              {l}
            </p>
          ))}
        </div>
        {standard === 6 ? (
          <p className="m-0" style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
            The standard six may be two adults and four children, or four adults and two children.
          </p>
        ) : null}
        {partyCard ? <div style={{ marginTop: 16 }}>{partyCard}</div> : null}
      </section>

      <div className="flex flex-col" style={{ gap: 12 }}>
        <p
          id={msgId}
          ref={messageRef}
          tabIndex={-1}
          aria-live="polite"
          className="m-0 outline-none"
          style={
            message
              ? { borderTop: "1px solid var(--color-bad)", paddingTop: 10, fontSize: 15, color: "var(--color-ink)" }
              : { fontSize: 0 }
          }
        >
          {message}
        </p>
        <div className="flex flex-wrap items-center max-lg:hidden" style={{ gap: 16 }}>
          <PendingSubmit className="btn-light" style={{ padding: "0 32px" }} describedBy={message ? msgId : undefined}>
            Continue
          </PendingSubmit>
          <Link
            href={`/apartments/${slug}${choicesQuery({ arrive, depart, adults: String(adults), children: String(children) })}`}
            className="underline"
            style={{ fontSize: 15, color: "var(--color-bronze)" }}
          >
            Back to the apartment
          </Link>
        </div>
      </div>
    </div>
  );

  const spine = (
    <FolioSpine
      typeName={type.name}
      stayLine={stayLine}
      breakdown={tooLarge ? null : breakdown}
      taxLabel={settings.tax_label}
      {...fees}
      emptyMessage={
        tooLarge ? partyTooLargeMessage(max) : quoteError || "Choose your arrival and departure to see the price of your stay."
      }
      note={<p className="m-0">PKR. Rates as of {SITE.ratesAsOf}, subject to change. Nothing is charged now.</p>}
    />
  );

  const bar = (
    <MobileStayBar
      summary={nights ? `${nightsWords(nights)} · ${guestsWords(guests)}` : `${guestsWords(guests)} · choose your dates`}
      breakdown={tooLarge ? null : breakdown}
      taxLabel={settings.tax_label}
      {...fees}
      fallbackAmount={formatNumber(rate.nightly_rate)}
      fallbackCaption="per night, plus applicable taxes"
    >
      <PendingSubmit className="btn-gold w-full" style={{ padding: "0 20px" }} describedBy={message ? msgId : undefined}>
        Continue
      </PendingSubmit>
    </MobileStayBar>
  );

  return (
    <form action={action} onSubmit={onSubmit} noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="arrive" value={arrive} />
      <input type="hidden" name="depart" value={depart} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="children" value={children} />
      <input type="hidden" name="am" value={initial.am} />
      <ReserveFrame main={main} spine={spine} bar={bar} />
    </form>
  );
}

