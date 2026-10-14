"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { numberWord } from "@/components/calendar-logic";
import { Ph } from "@/components/ph";
import type { PriceBreakdown } from "@/lib/pricing";
import { DETAIL_ORDER, type DetailField, type DetailsState, type DetailValues } from "./details-types";
import { FocusOnMount } from "./focus-on-mount";
import { ReserveFrame, StepHeading } from "./frame";
import { MobileStayBar } from "./mobile-bar";
import { PendingSubmit } from "./pending-submit";
import { stepHref, type Choices } from "./shared";

// Step 3 · Your details (canvas Reserve3, States "Form validation"). The server action validates with guestDetails,
// keeps the details only in the signed draft cookie and moves on to the review; when something needs attention the
// form comes back with every value kept and each error linked to its field.

export interface DetailsStepProps {
  slug: string;
  typeName: string;
  choices: Choices;
  initialValues: DetailValues;
  /** settings.check_in, e.g. "15:00" or the "[15:00]" placeholder. */
  checkIn: string;
  /** Why the guest was sent back here from the review (e.g. "Add your details to continue."). */
  notice?: string | null;
  action: (state: DetailsState, formData: FormData) => Promise<DetailsState>;
  spine: React.ReactNode;
  bar: {
    summary: string;
    breakdown: PriceBreakdown | null;
    taxLabel: string;
    extraAdultFee: number | null;
    extraChildFee: number | null;
  };
}

const LABEL: Record<DetailField, string> = {
  name: "Full name",
  phone: "Mobile number (WhatsApp)",
  email: "Email",
  arrivalTime: "Expected arrival time",
  requests: "Anything we should know?",
  acceptRules: "House rules",
};

function arrivalOptions(checkIn: string): string[] {
  const time = /^\d{1,2}:\d{2}$/.test(checkIn.trim()) ? checkIn.trim() : null;
  return [
    time ? `Afternoon, ${time} to 18:00` : "Afternoon, until 18:00",
    "Evening, after 18:00",
    "Late night, after 22:00",
    "Not sure yet",
  ];
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DetailsStep({ slug, typeName, choices, initialValues, checkIn, notice, action, spine, bar }: DetailsStepProps) {
  const uid = useId();
  const [state, formAction] = useActionState(action, { errors: {}, values: initialValues, attempt: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const v = state.values;
  const errorFields = DETAIL_ORDER.filter((f) => state.errors[f]);
  const count = errorFields.length;
  const options = arrivalOptions(checkIn);
  // A value from an earlier draft that is not one of the options (the check-in time changed) stays selectable.
  const allOptions = v.arrivalTime && !options.includes(v.arrivalTime) ? [...options, v.arrivalTime] : options;

  useEffect(() => {
    if (!state.attempt || !count) return;
    const first = errorFields[0];
    formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempt]);

  const ids = (f: DetailField, help?: boolean) =>
    [help ? `${uid}-${f}-help` : "", state.errors[f] ? `${uid}-${f}-err` : ""].filter(Boolean).join(" ") || undefined;

  const err = (f: DetailField) =>
    state.errors[f] ? (
      <p id={`${uid}-${f}-err`} className="err" style={{ fontSize: 14 }}>
        {state.errors[f]}
      </p>
    ) : null;

  const inputStyle = (f: DetailField): React.CSSProperties | undefined =>
    state.errors[f] ? { borderColor: "var(--color-bad)" } : undefined;

  const help = (f: DetailField, text: React.ReactNode) => (
    <p id={`${uid}-${f}-help`} className="m-0" style={{ marginTop: 6, fontSize: 13, color: "var(--color-ink-2)" }}>
      {text}
    </p>
  );

  const main = (
    <div className="flex flex-col" style={{ gap: 32 }}>
      <StepHeading
        step={3}
        typeName={typeName}
        title="Your details"
        intro={<p className="m-0">So we can send your payment instructions and greet you on arrival.</p>}
      />

      {notice && !state.attempt ? (
        <FocusOnMount>
          <p className="m-0" style={{ borderTop: "1px solid var(--color-bad)", paddingTop: 10, fontSize: 15, maxWidth: 760 }}>
            {notice}
          </p>
        </FocusOnMount>
      ) : null}

      {count ? (
        <div
          ref={summaryRef}
          role="alert"
          style={{ borderTop: "1px solid var(--color-bad)", paddingTop: 10, fontSize: 15, maxWidth: 760 }}
        >
          {capitalise(numberWord(count))} {count === 1 ? "detail needs" : "details need"} attention before you continue.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 24, maxWidth: 760 }}>
        <div className="sm:col-span-2">
          <label className="lbl" htmlFor={`${uid}-name`}>
            {LABEL.name}
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            className="inp"
            autoComplete="name"
            maxLength={120}
            defaultValue={v.name}
            aria-invalid={state.errors.name ? true : undefined}
            aria-describedby={ids("name")}
            style={inputStyle("name")}
          />
          {err("name")}
        </div>
        <div>
          <label className="lbl" htmlFor={`${uid}-phone`}>
            {LABEL.phone}
          </label>
          <input
            id={`${uid}-phone`}
            name="phone"
            className="inp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            defaultValue={v.phone}
            aria-invalid={state.errors.phone ? true : undefined}
            aria-describedby={ids("phone", true)}
            style={inputStyle("phone")}
          />
          {help("phone", "We send updates here.")}
          {err("phone")}
        </div>
        <div>
          <label className="lbl" htmlFor={`${uid}-email`}>
            {LABEL.email}
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            className="inp"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={200}
            defaultValue={v.email}
            aria-invalid={state.errors.email ? true : undefined}
            aria-describedby={ids("email", true)}
            style={inputStyle("email")}
          />
          {help("email", "Your reservation link arrives by email.")}
          {err("email")}
        </div>
        <div>
          <label className="lbl" htmlFor={`${uid}-arrival`}>
            {LABEL.arrivalTime}
          </label>
          <select
            key={`arrival-${state.attempt}`}
            id={`${uid}-arrival`}
            name="arrivalTime"
            className="inp"
            defaultValue={v.arrivalTime}
            aria-invalid={state.errors.arrivalTime ? true : undefined}
            aria-describedby={ids("arrivalTime", true)}
            style={inputStyle("arrivalTime")}
          >
            <option value="">Choose a time</option>
            {allOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {help(
            "arrivalTime",
            <>
              Check-in from <Ph value={checkIn} />.
            </>,
          )}
          {err("arrivalTime")}
        </div>
        <div>
          <p className="lbl">Identity on arrival</p>
          <p
            className="inp m-0 flex items-center"
            style={{ background: "transparent", borderStyle: "dashed", fontSize: 15, color: "var(--color-ink-2)", height: "auto", minHeight: 52 }}
          >
            CNIC or passport for each adult
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="lbl" htmlFor={`${uid}-requests`}>
            {LABEL.requests}{" "}
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--color-ink-2)" }}>(optional)</span>
          </label>
          <textarea
            id={`${uid}-requests`}
            name="requests"
            className="inp"
            maxLength={1000}
            defaultValue={v.requests}
            aria-invalid={state.errors.requests ? true : undefined}
            aria-describedby={ids("requests")}
            style={{ height: 120, minHeight: 120, resize: "vertical", ...inputStyle("requests") }}
          />
          {err("requests")}
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start" style={{ gap: 14, fontSize: 15, minHeight: 44 }}>
            <input
              key={`rules-${state.attempt}`}
              type="checkbox"
              name="acceptRules"
              defaultChecked={v.acceptRules}
              aria-invalid={state.errors.acceptRules ? true : undefined}
              aria-describedby={ids("acceptRules")}
              style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0, accentColor: "var(--color-ink)" }}
            />
            <span>
              I have read the{" "}
              <a href="/house-rules" target="_blank" rel="noopener" className="underline" style={{ color: "var(--color-bronze)" }}>
                house rules
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              and understand that a valid CNIC or passport is shown at check-in.
            </span>
          </label>
          {err("acceptRules")}
        </div>
        <p
          className="m-0 sm:col-span-2"
          style={{ fontSize: 13, color: "var(--color-ink-2)", borderTop: "1px solid var(--color-taupe)", paddingTop: 16 }}
        >
          We use your details only to manage your stay. See our{" "}
          <a href="/privacy" target="_blank" rel="noopener" className="underline" style={{ color: "var(--color-bronze)" }}>
            privacy notice
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center max-lg:hidden" style={{ gap: 16 }}>
        <PendingSubmit className="btn-light" style={{ padding: "0 32px" }}>
          Continue to review
        </PendingSubmit>
        <Link href={stepHref(slug, 2, choices)} className="underline" style={{ fontSize: 15, color: "var(--color-bronze)" }}>
          Back
        </Link>
      </div>
    </div>
  );

  return (
    <form ref={formRef} action={formAction} noValidate>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="arrive" value={choices.arrive} />
      <input type="hidden" name="depart" value={choices.depart} />
      <input type="hidden" name="adults" value={choices.adults} />
      <input type="hidden" name="children" value={choices.children} />
      <input type="hidden" name="am" value={choices.am} />
      <ReserveFrame
        main={main}
        spine={spine}
        bar={
          <MobileStayBar {...bar}>
            <PendingSubmit className="btn-gold w-full" style={{ padding: "0 20px" }}>
              Continue to review
            </PendingSubmit>
          </MobileStayBar>
        }
      />
    </form>
  );
}
