import type { Metadata } from "next";
import { checkThrough2, loadSettings, loadType, redirectToProblem, reservableType, stayChoices } from "@/components/reserve/flow";
import { DetailsStep } from "@/components/reserve/details-step";
import { EMPTY_DETAILS } from "@/components/reserve/details-types";
import { FolioSpine } from "@/components/reserve/folio-spine";
import { childFee, choicesFrom, guestsWords, nightsWords, partyWords, stayRange } from "@/components/reserve/shared";
import { readDraft } from "@/lib/draft";
import { formatNumber } from "@/lib/money";
import { saveDetails } from "../actions";

// Step 3 · Your details. Steps 1 and 2 are checked again first. Details saved earlier (in the signed draft cookie)
// fill the form, so "Change" from the review never asks twice.

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = await loadType((await params).slug);
  return { title: `Your details · Reserve · ${type?.name ?? "Crystal Royal Apartment"}` };
}

export default async function DetailsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const type = await reservableType(slug);
  const settings = await loadSettings();
  const c = choicesFrom(sp);
  const through = await checkThrough2(type, settings, c);
  if (!through.ok) redirectToProblem(type.slug, c, through.problem);
  const { stay, am, breakdown } = through;
  const draft = await readDraft();
  const g = draft?.guest;
  const nights = breakdown.nights;
  const fees = { extraAdultFee: stay.rate.extra_adult_per_night, extraChildFee: childFee(settings, stay.rate) };

  const spine = (
    <FolioSpine
      typeName={type.name}
      stayLine={`${stayRange(stay.arrive, stay.depart)} · ${nightsWords(nights)} · ${partyWords(stay.adults, stay.children)}`}
      breakdown={breakdown}
      taxLabel={settings.tax_label}
      {...fees}
      note={
        breakdown.depositPolicy === "50" ? (
          <p className="m-0">The balance is settled at check-in.</p>
        ) : (
          <div className="flex flex-col" style={{ gap: 10 }}>
            <p className="m-0 flex justify-between" style={{ gap: 16, fontSize: 15, color: "var(--color-on-dark)" }}>
              <span style={{ color: "var(--color-on-dark-2)" }}>Due to confirm · full payment</span>
              <span className="num whitespace-nowrap">PKR {formatNumber(breakdown.amountDue)}</span>
            </p>
            <p className="m-0">PKR. Nothing is charged now.</p>
          </div>
        )
      }
    />
  );

  return (
    <DetailsStep
      slug={type.slug}
      typeName={type.name}
      choices={stayChoices(stay, am)}
      initialValues={
        g
          ? {
              name: g.name,
              phone: g.phone,
              email: g.email,
              arrivalTime: g.arrivalTime,
              requests: g.requests,
              acceptRules: true,
            }
          : EMPTY_DETAILS
      }
      checkIn={settings.check_in}
      notice={sp.error === "details" ? (g ? "Some of your details need attention." : "Add your details to continue.") : null}
      action={saveDetails}
      spine={spine}
      bar={{
        summary: `${nightsWords(nights)} · ${guestsWords(stay.adults + stay.children)}`,
        breakdown,
        taxLabel: settings.tax_label,
        ...fees,
      }}
    />
  );
}
