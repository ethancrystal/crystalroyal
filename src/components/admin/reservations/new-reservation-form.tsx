"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/admin/shell";
import {
  CheckboxField,
  Field,
  PAYMENT_METHOD_LABEL,
  PRICING_LABEL,
  PhText,
  TypeMarker,
  fmtNum,
  fmtPKR,
  fmtShortDay,
} from "@/components/admin/ui";
import { Ph } from "@/components/ph";
import { isIsoDate, nightsBetween } from "@/lib/dates";
import { PricingError, type PriceBreakdown } from "@/lib/pricing";
import { quoteStay } from "@/lib/quote";
import type { Amenity, PricingType, Settings } from "@/lib/types";
import { BreakdownTable, type BreakdownLine } from "./breakdown";
import { EMPTY_STATE, type ConsoleAction } from "./shared";

// "New reservation" for phone and walk-in bookings: the reserve flow's steps on one page (apartment and dates,
// party, services, guest), priced live with the same quoteStay() the server uses (the server prices again from the
// database on submit), with an availability hint and an optional "Record payment now" that confirms the stay.

export interface NewTypeOption {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  standard_guests: number | null;
  max_guests: number | null;
  min_nights: number;
  /** why it cannot be reserved here, or null */
  blocked: string | null;
}

export interface NewRate {
  apartment_type_id: string;
  nightly_rate: number;
  extra_adult_per_night: number | null;
  effective_from: string;
}

export type QuoteSettings = Pick<
  Settings,
  "tax_rate_percent" | "tax_label" | "deposit_policy" | "child_extra_policy" | "child_extra_fee" | "min_nights" | "max_nights" | "child_max_age"
>;

type AmenityOption = Pick<Amenity, "id" | "name" | "pricing_type" | "price" | "max_quantity">;

function rateOn(rates: NewRate[], typeId: string, date: string): NewRate | null {
  let found: NewRate | null = null;
  for (const r of rates) {
    if (r.apartment_type_id !== typeId) continue;
    if (r.effective_from <= date && (!found || r.effective_from >= found.effective_from)) found = r;
  }
  // A date before the rate in force (only possible for a past arrival, which the server refuses): use the earliest.
  return found ?? rates.find((r) => r.apartment_type_id === typeId) ?? null;
}

function priceNote(a: AmenityOption): ReactNode {
  if (a.price === null) {
    return (
      <>
        <Ph value="[PKR __]" /> {PRICING_LABEL[a.pricing_type as PricingType]} · quoted separately
      </>
    );
  }
  return `${fmtPKR(a.price)} ${PRICING_LABEL[a.pricing_type as PricingType]}`;
}

type Availability = { state: "idle" | "checking" | "free" | "taken" | "error"; text?: string };

export function NewReservationForm({
  types,
  rates,
  settings,
  amenities,
  today,
  holdHours,
  action,
}: {
  types: NewTypeOption[];
  rates: NewRate[];
  settings: QuoteSettings;
  amenities: AmenityOption[];
  /** Karachi today, the earliest arrival */
  today: string;
  holdHours: number;
  action: ConsoleAction;
}) {
  const [state, formAction] = useActionState(action, EMPTY_STATE);
  const firstOpen = types.find((t) => !t.blocked);
  const [typeId, setTypeId] = useState(firstOpen?.id ?? "");
  const [arrive, setArrive] = useState("");
  const [depart, setDepart] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [guest, setGuest] = useState({ name: "", phone: "", email: "", arrivalTime: "", requests: "" });
  const [recordNow, setRecordNow] = useState(false);
  const [method, setMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState<string | null>(null); // null: follow the amount due
  const [bankReference, setBankReference] = useState("");
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });

  const fe = state.fieldErrors ?? {};
  const type = types.find((t) => t.id === typeId) ?? null;

  // After a refusal, focus the first field marked invalid (else the message), since the pending button lost focus.
  const formRef = useRef<HTMLFormElement>(null);
  const initialState = useRef(state);
  useEffect(() => {
    if (state === initialState.current || !state.error) return;
    const form = formRef.current;
    form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-form-error]')?.focus();
  }, [state]);

  const quote = useMemo((): { breakdown: PriceBreakdown } | { message: string } | null => {
    if (!type || type.blocked || !isIsoDate(arrive) || !isIsoDate(depart)) return null;
    const rate = rateOn(rates, type.id, arrive);
    if (!rate) return { message: "There is no rate for these dates." };
    const a = Number(adults);
    const c = Number(children);
    if (!Number.isInteger(a) || !Number.isInteger(c)) return { message: "Enter the number of adults and children." };
    try {
      return {
        breakdown: quoteStay({
          type,
          rate,
          settings,
          checkIn: arrive,
          checkOut: depart,
          adults: a,
          children: c,
          amenities: amenities
            .map((am) => ({ amenity: am, quantity: Number(qty[am.id] || 0) }))
            .filter((x) => x.quantity !== 0),
        }),
      };
    } catch (e) {
      if (e instanceof PricingError) return { message: e.message };
      return { message: "The price could not be worked out. Check the form." };
    }
  }, [type, arrive, depart, adults, children, qty, rates, settings, amenities]);

  const breakdown = quote && "breakdown" in quote ? quote.breakdown : null;
  const amountValue = amount ?? (breakdown ? String(breakdown.amountDue) : "");

  // Availability hint from the public per-night endpoint (no guest data). The server checks again on submit.
  useEffect(() => {
    if (!type || type.blocked || !isIsoDate(arrive) || !isIsoDate(depart) || depart <= arrive || nightsBetween(arrive, depart) > 120) {
      setAvailability({ state: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setAvailability({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/availability?type=${encodeURIComponent(type.slug)}&from=${arrive}&to=${depart}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { nights: { date: string; state: "free" | "reserved" | "blocked" }[] };
        const taken = data.nights.find((n) => n.state !== "free");
        setAvailability(
          taken
            ? { state: "taken", text: `Not free: ${fmtShortDay(taken.date)} is ${taken.state === "blocked" ? "blocked" : "already reserved"}.` }
            : { state: "free", text: "Free for these nights." },
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setAvailability({ state: "error", text: "Availability could not be checked just now. It is checked again when you add the reservation." });
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [type, arrive, depart]);

  const lines: BreakdownLine[] = breakdown
    ? [
        { key: "nights", label: `${breakdown.nights} night${breakdown.nights === 1 ? "" : "s"} × ${fmtNum(breakdown.nightlyRate)}`, amount: breakdown.subtotalNights },
        {
          key: "extra",
          label: breakdown.extraGuests > 0 ? `Additional guests (${breakdown.extraGuests})` : "Additional guests",
          amount: breakdown.extraAmount,
        },
        ...breakdown.amenityLines.map((l) => ({ key: l.id, label: `${l.name} × ${l.quantity}`, amount: l.lineTotal, note: "to quote" })),
        breakdown.taxRatePercent === null
          ? { key: "tax", label: "Tax", amount: null, note: "rate not set" }
          : {
              key: "tax",
              label: (
                <>
                  <PhText text={settings.tax_label || "Tax"} /> ({breakdown.taxRatePercent}%)
                </>
              ),
              amount: breakdown.taxAmount,
            },
      ]
    : [];

  const setG = (k: keyof typeof guest) => (e: { target: { value: string } }) => setGuest((g) => ({ ...g, [k]: e.target.value }));
  const general = state.error && Object.keys(fe).length === 0 ? state.error : null;
  const errorSummary = state.error && Object.keys(fe).length > 0 ? state.error : null;

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-wrap items-start gap-10">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
        {errorSummary ? (
          <p role="alert" className="err m-0 text-[15px]">
            Not added. {errorSummary}
          </p>
        ) : null}

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="eyebrow mb-3 text-bronze">Apartment</legend>
          <div className="flex flex-col gap-2">
            {types.map((t) => {
              const id = `nr-type-${t.slug}`;
              return (
                <div key={t.id} className="border border-taupe bg-paper px-4 py-2">
                  <label htmlFor={id} className={`flex min-h-[44px] items-center gap-3 text-[15px] ${t.blocked ? "cursor-not-allowed text-ink-2" : "cursor-pointer"}`}>
                    <input
                      type="radio"
                      id={id}
                      name="typeId"
                      value={t.id}
                      checked={typeId === t.id}
                      disabled={Boolean(t.blocked)}
                      onChange={() => setTypeId(t.id)}
                      aria-describedby={[t.blocked ? `${id}-why` : `${id}-cap`, fe.typeId ? "nr-type-err" : ""].filter(Boolean).join(" ")}
                      aria-invalid={fe.typeId ? true : undefined}
                      className="h-5 w-5 accent-[var(--color-ink)]"
                    />
                    <TypeMarker slug={t.slug}>{t.name}</TypeMarker>
                  </label>
                  {t.blocked ? (
                    <p id={`${id}-why`} className="m-0 pb-1.5 pl-8 text-[13px] text-ink-2">
                      {t.blocked}{" "}
                      <Link href="/admin/settings" className="text-bronze! underline underline-offset-2">
                        Settings
                      </Link>
                      .
                    </p>
                  ) : (
                    <p id={`${id}-cap`} className="m-0 pb-1.5 pl-8 text-[13px] text-ink-2">
                      {t.standard_guests} guests as standard, up to {t.max_guests}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {fe.typeId ? (
            <p id="nr-type-err" className="err">
              {fe.typeId}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="eyebrow mb-3 text-bronze">Dates and party</legend>
          <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
            <Field label="Arrival" name="arrive" id="nr-arrive" type="date" min={today} required value={arrive} onChange={(e) => setArrive(e.target.value)} error={fe.arrive} />
            <Field
              label="Departure"
              name="depart"
              id="nr-depart"
              type="date"
              min={arrive || today}
              required
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
              error={fe.depart}
            />
            <Field
              label="Adults"
              name="adults"
              id="nr-adults"
              type="number"
              inputMode="numeric"
              min={1}
              max={type?.max_guests ?? 30}
              required
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              error={fe.adults}
            />
            <Field
              label="Children"
              name="children"
              id="nr-children"
              type="number"
              inputMode="numeric"
              min={0}
              max={type?.max_guests ?? 30}
              required
              value={children}
              onChange={(e) => setChildren(e.target.value)}
              hint={settings.child_max_age !== null ? `Aged ${settings.child_max_age} and under.` : undefined}
              error={fe.children}
            />
          </div>
          <p className="m-0 text-[13px] text-ink-2">
            Stays are from {Math.max(type?.min_nights ?? 1, settings.min_nights)} to {settings.max_nights} nights. Every date is Karachi time.
          </p>
        </fieldset>

        {amenities.length > 0 ? (
          <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
            <legend className="eyebrow mb-3 text-bronze">Services</legend>
            <div className="grid gap-x-5 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
              {amenities.map((a) => (
                <Field
                  key={a.id}
                  label={a.name}
                  name={`am_${a.id}`}
                  id={`nr-am-${a.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={a.max_quantity}
                  value={qty[a.id] ?? "0"}
                  onChange={(e) => setQty((q) => ({ ...q, [a.id]: e.target.value }))}
                  hint={
                    <>
                      {priceNote(a)}
                      {a.max_quantity > 1 ? ` · up to ${a.max_quantity}` : ""}
                    </>
                  }
                  error={fe[`am_${a.id}`]}
                />
              ))}
            </div>
            {fe.amenities ? <p className="err">{fe.amenities}</p> : null}
          </fieldset>
        ) : null}

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="eyebrow mb-3 text-bronze">Guest</legend>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <Field label="Full name" name="name" id="nr-name" autoComplete="off" required maxLength={120} value={guest.name} onChange={setG("name")} error={fe.name} />
            <Field
              label="Mobile (WhatsApp)"
              name="phone"
              id="nr-phone"
              type="tel"
              autoComplete="off"
              required
              maxLength={30}
              value={guest.phone}
              onChange={setG("phone")}
              hint="With the country code, or starting 03."
              error={fe.phone}
            />
            <Field
              label="Email"
              name="email"
              id="nr-email"
              type="email"
              autoComplete="off"
              maxLength={200}
              value={guest.email}
              onChange={setG("email")}
              hint="Optional. Without one, the guest is not emailed."
              error={fe.email}
            />
            <Field
              label="Arrival time"
              name="arrivalTime"
              id="nr-arrival-time"
              maxLength={40}
              value={guest.arrivalTime}
              onChange={setG("arrivalTime")}
              hint="Optional, for example 15:00 to 18:00."
              error={fe.arrivalTime}
            />
          </div>
          <Field as="textarea" label="Requests" name="requests" id="nr-requests" maxLength={1000} value={guest.requests} onChange={setG("requests")} error={fe.requests} />
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="eyebrow mb-3 text-bronze">Payment</legend>
          <CheckboxField
            label="Record payment now"
            name="recordNow"
            id="nr-record"
            checked={recordNow}
            onChange={(e) => setRecordNow(e.target.checked)}
            hint={
              recordNow
                ? "The guest has already paid. Recording it confirms the stay."
                : `Without a payment the dates are held for ${holdHours} hours while the guest transfers, as online.`
            }
          />
          {recordNow ? (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
              <Field
                as="select"
                label="Method"
                name="method"
                id="nr-method"
                options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                error={fe.method}
              />
              <Field
                label="Amount, PKR"
                name="amount"
                id="nr-amount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={amountValue}
                onChange={(e) => setAmount(e.target.value)}
                error={fe.amount}
              />
              <Field
                label="Reference"
                name="bankReference"
                id="nr-ref"
                maxLength={100}
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                hint="Optional: the bank or receipt reference."
                error={fe.bankReference}
              />
            </div>
          ) : null}
        </fieldset>
      </div>

      <aside aria-label="Price and availability" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 min-[1200px]:sticky min-[1200px]:top-6">
        <section aria-labelledby="nr-price-h" className="flex flex-col gap-3 bg-ivory-2 p-5">
          <h2 id="nr-price-h" className="eyebrow text-bronze">
            Price
          </h2>
          <div aria-live="polite" className="flex flex-col gap-3">
            {breakdown ? (
              <BreakdownTable
                label="Price preview"
                lines={lines}
                total={{ label: breakdown.amountDue === breakdown.total ? "Amount due" : "Total", amount: breakdown.total }}
                after={breakdown.amountDue !== breakdown.total ? [{ key: "due", label: "Due on reserving", amount: breakdown.amountDue }] : undefined}
              />
            ) : quote && "message" in quote ? (
              <p className="m-0 text-[15px] text-bad">{quote.message}</p>
            ) : (
              <p className="m-0 text-[14px] text-ink-2">Choose the apartment, dates and party to see the price.</p>
            )}
            {availability.state !== "idle" ? (
              <p className={`m-0 text-[14px] ${availability.state === "taken" ? "text-bad" : availability.state === "free" ? "text-ok" : "text-ink-2"}`}>
                {availability.state === "checking" ? "Checking availability…" : availability.text}
              </p>
            ) : null}
          </div>
          <p className="m-0 text-[13px] text-ink-2">Priced by the same engine as online reservations, and priced again when you add it.</p>
        </section>
        {general ? (
          <p role="alert" tabIndex={-1} data-form-error className="err m-0 text-[15px] outline-none">
            {general}
          </p>
        ) : null}
        <SubmitButton pendingText="Adding…" className="self-start" disabled={!firstOpen}>
          {recordNow ? "Add and confirm" : "Add the reservation"}
        </SubmitButton>
      </aside>
    </form>
  );
}
