"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { todayInKarachi } from "@/lib/dates";
import { AmenityCard } from "./amenity-card";
import { FolioSpine } from "./folio-spine";
import { ReserveFrame, StepHeading } from "./frame";
import { MobileStayBar } from "./mobile-bar";
import { PendingSubmit } from "./pending-submit";
import {
  childFee,
  choicesQuery,
  guestsWords,
  nightsWords,
  previewQuote,
  serializeAm,
  stayRange,
  type AmenityLite,
  type PricingSettings,
  type RateLite,
  type TypeLite,
} from "./shared";

// Step 2 · At your service (canvas Reserve2). One card per active amenity; the spine and the bar update as services
// are added. The selection is kept in ?am= as the guest chooses. "Continue" and "Skip for now" post to the server,
// which checks every amenity and quantity again.

export interface AmenitiesStepProps {
  slug: string;
  type: TypeLite;
  rates: RateLite[];
  currentRate: RateLite;
  settings: PricingSettings;
  amenities: AmenityLite[];
  stay: { arrive: string; depart: string; adults: number; children: number; nights: number };
  initialQty: Record<string, number>;
  problem: string | null;
  action: (formData: FormData) => Promise<void>;
}

const BTN = { minHeight: 52, padding: "0 32px" } as const;

export function AmenitiesStep({
  slug,
  type,
  rates,
  currentRate,
  settings,
  amenities,
  stay,
  initialQty,
  problem,
  action,
}: AmenitiesStepProps) {
  const today = useMemo(() => todayInKarachi(), []);
  const [qty, setQty] = useState<Record<string, number>>(initialQty);
  const problemRef = useRef<HTMLParagraphElement>(null);
  const am = serializeAm(qty, amenities);

  // Keep the selection in ?am= as the guest chooses (only when it differs from the URL).
  useEffect(() => {
    const live = new URLSearchParams(window.location.search);
    if ((live.get("am") ?? "") === am) return;
    const q = choicesQuery({
      arrive: stay.arrive,
      depart: stay.depart,
      adults: String(stay.adults),
      children: String(stay.children),
      am,
    });
    window.history.replaceState(null, "", `${window.location.pathname}${q}`);
  }, [am, stay.arrive, stay.depart, stay.adults, stay.children]);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { breakdown, error, rate } = previewQuote({
    type,
    rates,
    currentRate,
    settings,
    arrive: stay.arrive,
    depart: stay.depart,
    adults: stay.adults,
    children: stay.children,
    qty,
    amenities,
    today,
  });
  const fees = { extraAdultFee: rate.extra_adult_per_night, extraChildFee: childFee(settings, rate) };
  const guests = stay.adults + stay.children;
  const unpriced = amenities.some((a) => a.price === null);

  const main = (
    <div className="flex flex-col" style={{ gap: 36 }}>
      <StepHeading
        step={2}
        typeName={type.name}
        eyebrowExtra="optional"
        title="At your service"
        intro={
          <p className="m-0">
            Add anything you would like arranged before you arrive.
            {unpriced
              ? " Where a price is still to be confirmed, we note your request and quote it separately; it is not added to your total."
              : ""}
          </p>
        }
      />
      {problem ? (
        <p
          ref={problemRef}
          tabIndex={-1}
          className="m-0 outline-none"
          style={{ borderTop: "1px solid var(--color-bad)", paddingTop: 10, fontSize: 15 }}
        >
          {problem}
        </p>
      ) : null}
      {amenities.length ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 16 }}>
          {amenities.map((a) => (
            <AmenityCard
              key={a.id}
              amenity={a}
              quantity={qty[a.id] ?? 0}
              onChange={(n) => setQty((cur) => ({ ...cur, [a.id]: n }))}
            />
          ))}
        </div>
      ) : (
        <p className="m-0" style={{ color: "var(--color-ink-2)" }}>
          Nothing to add just now. Ask us at any time during your stay.
        </p>
      )}
      <div className="flex flex-wrap items-center max-lg:hidden" style={{ gap: 16 }}>
        <PendingSubmit className="btn-light" style={BTN}>
          Continue
        </PendingSubmit>
        <PendingSubmit className="btn-ghost-light" style={{ ...BTN, padding: "0 28px" }} name="skip" value="1">
          Skip for now
        </PendingSubmit>
      </div>
    </div>
  );

  const spine = (
    <FolioSpine
      typeName={type.name}
      stayLine={`${stayRange(stay.arrive, stay.depart)} · ${nightsWords(stay.nights)} · ${guestsWords(guests)}`}
      breakdown={breakdown}
      taxLabel={settings.tax_label}
      {...fees}
      emptyMessage={error}
      note={<p className="m-0">PKR. Amenity prices are confirmed by the property.</p>}
    />
  );

  const bar = (
    <MobileStayBar
      summary={`${nightsWords(stay.nights)} · ${guestsWords(guests)}`}
      breakdown={breakdown}
      taxLabel={settings.tax_label}
      {...fees}
    >
      <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <PendingSubmit className="btn-dark" style={{ padding: "0 8px", fontSize: 12 }} name="skip" value="1">
          Skip for now
        </PendingSubmit>
        <PendingSubmit className="btn-gold" style={{ padding: "0 8px", fontSize: 12 }}>
          Continue
        </PendingSubmit>
      </div>
    </MobileStayBar>
  );

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="arrive" value={stay.arrive} />
      <input type="hidden" name="depart" value={stay.depart} />
      <input type="hidden" name="adults" value={stay.adults} />
      <input type="hidden" name="children" value={stay.children} />
      <input type="hidden" name="am" value={am} />
      <ReserveFrame main={main} spine={spine} bar={bar} />
    </form>
  );
}
