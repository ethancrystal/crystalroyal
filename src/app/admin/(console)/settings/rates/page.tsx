import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { listRates, listTypesWithUnits, type RateRow, type TypeWithUnits } from "@/lib/db/admin-queries";
import { todayInKarachi } from "@/lib/dates";
import { isReservable } from "@/lib/quote";
import {
  DataTable,
  Notice,
  Panel,
  Ph,
  Section,
  TypeMarker,
  fmtDay,
  fmtNum,
  type Column,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/shell";
import { ActionForm, FormField } from "@/components/admin/settings/form-kit";
import { addRateAction, saveOccupancyAction } from "./actions";

// Rates (canvas AdminSettings "Rates" table: Apartment, Nightly rate, Extra adult per night, Standard / max guests,
// Effective from; the note under it). Per type: the rate history with effective dates, "Schedule a new rate", and
// the occupancy fields. Setting the standard and maximum guests is what opens a type to online reservations.

export const metadata: Metadata = { title: "Rates" };

const GRID = "grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]";

function rateStatus(r: RateRow, today: string): string {
  if (r.in_force) return "In force";
  return r.effective_from > today ? "Scheduled" : "Earlier";
}

function money(v: number | null, empty = "None") {
  return v === null ? <span className="font-normal text-ink-2">{empty}</span> : fmtNum(v);
}

function TypeSection({ type, rates, today }: { type: TypeWithUnits; rates: RateRow[]; today: string }) {
  const reservable = isReservable(type);
  const slug = type.slug;
  const columns: Column<RateRow>[] = [
    { key: "from", header: "Effective from", rowHeader: true, cell: (r) => <span className="num whitespace-nowrap">{fmtDay(r.effective_from)}</span> },
    { key: "rate", header: "Nightly rate, PKR", num: true, cell: (r) => fmtNum(r.nightly_rate) },
    { key: "extra", header: "Extra adult per night, PKR", num: true, cell: (r) => money(r.extra_adult_per_night) },
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        const s = rateStatus(r, today);
        return <span className={s === "In force" ? "font-medium" : s === "Scheduled" ? "text-bronze" : "text-ink-2"}>{s}</span>;
      },
    },
  ];

  return (
    <Section
      id={`type-${slug}`}
      title={<TypeMarker slug={slug}>{type.name}</TypeMarker>}
      gap={16}
      description={`${type.short_name} · ${type.units.length} ${type.units.length === 1 ? "unit" : "units"}`}
    >
      {reservable ? (
        <Notice tone="ok" title="Reservable online.">
          Sleeps {type.standard_guests} as standard, up to {type.max_guests}.
        </Notice>
      ) : (
        <Notice tone="wait" title="Not reservable online yet.">
          Until its standard and maximum guests are set below, guests are asked to confirm occupancy directly with the
          property.
        </Notice>
      )}

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        <Panel as="section" aria-labelledby={`rate-${slug}-h`} className="gap-4">
          <h3 id={`rate-${slug}-h`} className="eyebrow text-bronze">
            Schedule a new rate
          </h3>
          <ActionForm action={addRateAction} className="flex flex-col gap-4">
            <input type="hidden" name="typeId" value={type.id} />
            <div className={GRID}>
              <FormField
                id={`rate-${slug}-nightly`}
                label="Nightly rate, PKR"
                name="nightlyRate"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={type.rate?.nightly_rate ?? ""}
              />
              <FormField
                id={`rate-${slug}-extra`}
                label="Extra adult per night, PKR"
                name="extraAdultPerNight"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="None"
                defaultValue={type.rate?.extra_adult_per_night ?? ""}
                hint="Leave empty for no extra-guest charge."
              />
              <FormField
                id={`rate-${slug}-from`}
                label="Effective from"
                name="effectiveFrom"
                type="date"
                min={today}
                defaultValue={today}
                hint="Today or later. A second rate on the same date replaces the first."
              />
            </div>
            <div>
              <SubmitButton pendingText="Scheduling">Schedule a new rate</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel as="section" aria-labelledby={`occ-${slug}-h`} className="gap-4">
          <h3 id={`occ-${slug}-h`} className="eyebrow text-bronze">
            Occupancy and details
          </h3>
          <p className="m-0 text-[14px] text-ink-2">
            Setting the standard and maximum guests is what makes this apartment reservable online. Leave both empty to
            keep it reserved directly with the property.
          </p>
          <ActionForm action={saveOccupancyAction} className="flex flex-col gap-4">
            <input type="hidden" name="typeId" value={type.id} />
            <div className={GRID}>
              <FormField
                id={`occ-${slug}-standard`}
                label="Standard guests"
                name="standard_guests"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                placeholder="[__]"
                defaultValue={type.standard_guests ?? ""}
                placeholderValue={type.standard_guests === null}
              />
              <FormField
                id={`occ-${slug}-max`}
                label="Maximum guests"
                name="max_guests"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                placeholder="[__]"
                defaultValue={type.max_guests ?? ""}
                placeholderValue={type.max_guests === null}
              />
              <FormField
                id={`occ-${slug}-min`}
                label="Shortest stay, nights"
                name="min_nights"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                defaultValue={type.min_nights}
              />
              <FormField
                id={`occ-${slug}-bath`}
                label="Bathrooms"
                name="bathrooms"
                placeholder="[__]"
                defaultValue={type.bathrooms ?? ""}
                placeholderValue={!type.bathrooms}
              />
              <FormField
                id={`occ-${slug}-size`}
                label="Size, sq ft"
                name="size_sqft"
                type="number"
                inputMode="numeric"
                min={100}
                placeholder="[__]"
                defaultValue={type.size_sqft ?? ""}
                placeholderValue={type.size_sqft === null}
              />
              <FormField
                id={`occ-${slug}-beds`}
                label="Bed configuration"
                name="bed_configuration"
                placeholder="[e.g. 1 king, 1 queen, 2 singles]"
                defaultValue={type.bed_configuration ?? ""}
                placeholderValue={!type.bed_configuration}
                className="[grid-column:1/-1]"
              />
            </div>
            <div>
              <SubmitButton pendingText="Saving">Save occupancy</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <DataTable
        label={`Rate history, ${type.short_name}`}
        columns={columns}
        rows={rates}
        rowKey={(r) => r.id}
        minWidth={560}
        empty="No rate yet. Schedule one above; until then this apartment cannot be priced."
      />
    </Section>
  );
}

export default async function RatesPage() {
  await requireAdmin();
  const today = todayInKarachi();
  const types = await listTypesWithUnits();
  const histories = await Promise.all(types.map((t) => listRates(t.id)));
  const unconfirmed = types.filter((t) => t.active && !isReservable(t));

  const overview: Column<TypeWithUnits>[] = [
    { key: "apt", header: "Apartment", rowHeader: true, cell: (t) => <TypeMarker slug={t.slug} className="font-normal">{t.short_name}</TypeMarker> },
    { key: "rate", header: "Nightly rate", num: true, cell: (t) => (t.rate ? fmtNum(t.rate.nightly_rate) : <Ph value={null} className="text-bad" />) },
    {
      key: "extra",
      header: "Extra adult per night",
      num: true,
      cell: (t) =>
        t.rate?.extra_adult_per_night != null ? (
          fmtNum(t.rate.extra_adult_per_night)
        ) : isReservable(t) ? (
          <span className="font-normal text-ink-2">None</span>
        ) : (
          <Ph value="[__ or none]" className="text-bad" />
        ),
    },
    {
      key: "occ",
      header: "Standard / max guests",
      num: true,
      cell: (t) => (
        <>
          <Ph value={t.standard_guests} className={t.standard_guests === null ? "text-bad" : ""} /> /{" "}
          <Ph value={t.max_guests} className={t.max_guests === null ? "text-bad" : ""} />
        </>
      ),
    },
    {
      key: "from",
      header: "Effective from",
      num: true,
      cell: (t) => (t.rate ? <span className="whitespace-nowrap">{fmtDay(t.rate.effective_from, { weekday: undefined })}</span> : "—"),
    },
  ];

  return (
    <div className="flex flex-col gap-12">
      <Section id="rates" title="Rates" variant="display" gap={14}>
        <DataTable label="Rates in force today" columns={overview} rows={types} rowKey={(t) => t.id} minWidth={720} />
        <p className="m-0 text-[13px] text-ink-2">
          A stay is priced at the latest rate effective on its arrival date.
          {unconfirmed.length > 0
            ? ` Until the ${unconfirmed.map((t) => t.slug).join(" and ")} occupancy is set, ${
                unconfirmed.length === 1 ? "it is" : "they are"
              } reserved directly with the property.`
            : null}
        </p>
      </Section>
      {types.map((t, i) => (
        <TypeSection key={t.id} type={t} rates={histories[i]} today={today} />
      ))}
    </div>
  );
}
