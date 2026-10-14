import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { spokenDate } from "@/components/calendar-logic";
import { Ph, PhText } from "@/components/ph";
import { Turnstile } from "@/components/turnstile";
import {
  checkGuest,
  checkThrough2,
  draftFingerprint,
  draftFor,
  fingerprintKey,
  loadSettings,
  loadType,
  payHref,
  recentReservation,
  redirectToProblem,
  reservableType,
  stayChoices,
} from "@/components/reserve/flow";
import { FocusOnMount } from "@/components/reserve/focus-on-mount";
import { FolioSpine } from "@/components/reserve/folio-spine";
import { ReserveFrame, StepHeading } from "@/components/reserve/frame";
import { MobileStayBar } from "@/components/reserve/mobile-bar";
import { PendingSubmit } from "@/components/reserve/pending-submit";
import { childFee, choicesFrom, guestsWords, nightsWords, partyWords, stepHref } from "@/components/reserve/shared";
import { StateCard } from "@/components/reserve/state-card";
import { readDraft } from "@/lib/draft";
import { formatPKR } from "@/lib/money";
import { reserve } from "../actions";

// Step 4 · Review (canvas Reserve4). Everything on one screen with "Change" links, the hold line and the
// cancellation terms; "Reserve and continue to payment" runs the reserve action, which prices the stay again from
// the database and creates the reservation.

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = await loadType((await params).slug);
  return { title: `Review · Reserve · ${type?.name ?? "Crystal Royal Apartment"}` };
}

const ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  padding: "14px 0",
  borderBottom: "1px solid var(--color-taupe)",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={ROW} className="max-sm:flex-col max-sm:gap-1!">
      <dt style={{ color: "var(--color-ink-2)" }}>{label}</dt>
      <dd className="m-0 sm:text-right" style={{ overflowWrap: "anywhere" }}>
        {children}
      </dd>
    </div>
  );
}

function Section({
  id,
  title,
  change,
  changeLabel,
  children,
}: {
  id: string;
  title: string;
  change: string;
  changeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="flex items-baseline justify-between" style={{ gap: 16 }}>
        <h2 id={id} className="eyebrow" style={{ color: "var(--color-bronze)", marginBottom: 8 }}>
          {title}
        </h2>
        <Link
          href={change}
          aria-label={changeLabel}
          className="inline-flex items-center underline"
          style={{ fontSize: 14, color: "var(--color-bronze)", minHeight: 44 }}
        >
          Change
        </Link>
      </div>
      <dl className="m-0" style={{ borderTop: "1px solid var(--color-bronze)" }}>
        {children}
      </dl>
    </section>
  );
}

const MESSAGES: Record<string, string> = {
  verify: "We could not confirm this request. Please try again.",
  busy: "We have received several requests from this connection in a short time. Please wait a few minutes and try again, or write to us on WhatsApp.",
  failed: "We could not complete your reservation just now. Nothing has been reserved. Please try again in a moment.",
  changed: "Your details changed in another window. Please check them here before you reserve.",
};

export default async function ReviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const type = await reservableType(slug);
  const settings = await loadSettings();
  const c = choicesFrom(sp);
  const draft = await readDraft();
  // Back on this page just after reserving (the details are cleared then): go to that reservation. Checked before
  // availability, which that reservation now takes.
  const recent = recentReservation(draft);
  const prefix = [type.slug, c.arrive, c.depart, c.adults, c.children, c.am].join("|") + "|";
  if (!draft?.guest && recent && recent.fingerprint.startsWith(prefix)) redirect(payHref(recent));

  const through = await checkThrough2(type, settings, c);
  if (!through.ok) redirectToProblem(type.slug, c, through.problem);
  const { stay, am, breakdown } = through;
  const choices = stayChoices(stay, am);

  const g = checkGuest(draft);
  if (!g.ok) redirectToProblem(type.slug, choices, g.problem);
  const guest = g.guest;
  const key = fingerprintKey(draftFingerprint(draftFor(type.slug, stay, am, guest)));

  const errorCode = typeof sp.error === "string" ? sp.error : "";
  const was = Number(typeof sp.was === "string" ? sp.was : "");
  const fees = { extraAdultFee: stay.rate.extra_adult_per_night, extraChildFee: childFee(settings, stay.rate) };
  const services = breakdown.amenityLines.map((l) =>
    l.lineTotal === null ? `${l.name} × ${l.quantity}, quoted separately` : `${l.name} × ${l.quantity}, ${formatPKR(l.lineTotal)}`,
  );

  const notice =
    errorCode === "price" && Number.isInteger(was) && was !== breakdown.total ? (
      <FocusOnMount>
        <StateCard tone="wait" pill="Price changed" heading="The amount was recalculated" alert>
          <p className="m-0">A price for your stay changed since the last page was shown. Please review the updated total before you reserve.</p>
          <p className="num m-0" style={{ marginTop: 10, color: "var(--color-ink)" }}>
            <span style={{ textDecoration: "line-through", color: "var(--color-ink-2)" }}>{formatPKR(was)}</span> →{" "}
            {formatPKR(breakdown.total)}
          </p>
        </StateCard>
      </FocusOnMount>
    ) : MESSAGES[errorCode] ? (
      <FocusOnMount>
        <p role="alert" className="m-0" style={{ borderTop: "1px solid var(--color-bad)", paddingTop: 10, fontSize: 15 }}>
          {MESSAGES[errorCode]}
        </p>
      </FocusOnMount>
    ) : null;

  const reserveButton = (className: string, style: React.CSSProperties) => (
    <PendingSubmit className={className} style={style}>
      Reserve and continue to payment
    </PendingSubmit>
  );

  const main = (
    <div className="flex flex-col" style={{ gap: 40 }}>
      <StepHeading step={4} typeName={type.name} title="Review your reservation" />
      {notice}

      <Section id="review-stay" title="The stay" change={stepHref(type.slug, 1, choices)} changeLabel="Change the stay">
        <Row label="Apartment">{type.name}</Row>
        <Row label="Arrival">
          {spokenDate(stay.arrive)}, from <Ph value={settings.check_in} />
        </Row>
        <Row label="Departure">
          {spokenDate(stay.depart)}, by <Ph value={settings.check_out} />
        </Row>
        <Row label="Party">{partyWords(stay.adults, stay.children)}</Row>
        <Row label="At your service">
          {services.length ? (
            <span className="flex flex-col">
              {services.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </span>
          ) : (
            "Nothing added"
          )}
        </Row>
      </Section>

      <Section
        id="review-details"
        title="Your details"
        change={stepHref(type.slug, 3, choices)}
        changeLabel="Change your details"
      >
        <Row label="Name">{guest.name}</Row>
        <Row label="Mobile number (WhatsApp)">
          <span className="num">{guest.phone}</span>
        </Row>
        <Row label="Email">{guest.email}</Row>
        <Row label="Arrival time">{guest.arrivalTime || "Not given"}</Row>
        <Row label="Requests">{guest.requests || "None"}</Row>
      </Section>

      <section
        aria-labelledby="review-before"
        className="flex flex-col"
        style={{ background: "var(--color-ivory-2)", padding: 28, gap: 10 }}
      >
        <h2 id="review-before" className="eyebrow" style={{ color: "var(--color-bronze)" }}>
          Before you reserve
        </h2>
        <p className="m-0">We hold these dates for {settings.hold_hours} hours while you make the transfer.</p>
        <p className="m-0" style={{ color: "var(--color-ink-2)", fontSize: 15 }}>
          Your stay is confirmed once we verify the transfer to our Meezan Bank account.{" "}
          <PhText text={settings.cancellation_text} /> See the{" "}
          <a href="/terms" target="_blank" rel="noopener" className="underline" style={{ color: "var(--color-bronze)" }}>
            terms
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </p>
      </section>

      <Turnstile tone="ivory" action="reserve" />
    </div>
  );

  const spine = (
    <FolioSpine
      variant="settle"
      typeName={type.name}
      breakdown={breakdown}
      taxLabel={settings.tax_label}
      {...fees}
      note={
        <p className="m-0">
          The amount is recalculated by our system when you reserve. If anything has changed, we show you before you pay.
        </p>
      }
    >
      {reserveButton("btn-dark w-full", { minHeight: 60, padding: "0 24px", textAlign: "center" })}
    </FolioSpine>
  );

  return (
    <form action={reserve}>
      <input type="hidden" name="slug" value={type.slug} />
      <input type="hidden" name="arrive" value={choices.arrive} />
      <input type="hidden" name="depart" value={choices.depart} />
      <input type="hidden" name="adults" value={choices.adults} />
      <input type="hidden" name="children" value={choices.children} />
      <input type="hidden" name="am" value={choices.am} />
      <input type="hidden" name="key" value={key} />
      <input type="hidden" name="shown_total" value={breakdown.total} />
      <ReserveFrame
        main={main}
        spine={spine}
        bar={
          <MobileStayBar
            summary={`${nightsWords(breakdown.nights)} · ${guestsWords(stay.adults + stay.children)}`}
            breakdown={breakdown}
            taxLabel={settings.tax_label}
            {...fees}
            amountKind="due"
          >
            {reserveButton("btn-gold w-full", { padding: "0 16px", fontSize: 12 })}
          </MobileStayBar>
        }
      />
    </form>
  );
}
