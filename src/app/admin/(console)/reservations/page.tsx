import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { listReservations, listTypesWithUnits, parseReservationFilter, type ReservationRow } from "@/lib/db/admin-queries";
import {
  AdminPage,
  AdminStatusPill,
  ButtonLink,
  DataTable,
  PageHeader,
  TextLink,
  TypeMarker,
  buttonClass,
  fmtNights,
  fmtParty,
  fmtPKR,
  fmtStay,
  type Column,
} from "@/components/admin/ui";
import { FilterBar } from "@/components/admin/reservations/filter-bar";
import { filterQuery, type FilterValues } from "@/components/admin/reservations/shared";

// Reservations: the canvas filter bar (search by reference, phone or name; status; apartment; unit; arrival range)
// as a GET form, the matching reservations newest arrival first in the dense canvas table, and "Export CSV" with
// the same filter.

export const metadata: Metadata = { title: "Reservations" };

const LIMIT = 500;
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ReservationsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const filter = parseReservationFilter(await searchParams);
  const [rows, types] = await Promise.all([listReservations(filter, LIMIT), listTypesWithUnits()]);

  const values: FilterValues = {
    q: filter.q,
    status: filter.status,
    type: filter.typeId,
    unit: filter.unitId,
    from: filter.from,
    to: filter.to,
  };
  const query = filterQuery(values);
  const filtered = query !== "";
  const multiUnit = types.some((t) => t.units.length > 1);
  const count = rows.length;
  const eyebrow =
    count === 0
      ? filtered
        ? "No matches"
        : "None yet"
      : `${count === LIMIT ? `Latest ${LIMIT}` : count} reservation${count === 1 ? "" : "s"}${filtered ? " · filtered" : ""}`;

  const columns: Column<ReservationRow>[] = [
    {
      key: "ref",
      header: "Reference",
      rowHeader: true,
      cell: (r) => (
        <>
          <span className="num whitespace-nowrap">{r.reference}</span>
          <span className="block text-[13px] font-normal text-ink-2">{r.source === "admin" ? "manual" : "online"}</span>
        </>
      ),
    },
    {
      key: "guest",
      header: "Guest",
      cell: (r) => (
        <>
          <span className="break-words">{r.guest_name}</span>
          <span className="num block text-[13px] font-normal text-ink-2">{r.guest_phone}</span>
        </>
      ),
    },
    {
      key: "stay",
      header: "Stay",
      cell: (r) => (
        <>
          <span className="whitespace-nowrap">{fmtStay(r.check_in, r.check_out)}</span>
          <span className="block text-[13px] text-ink-2">
            {fmtNights(r.nights)} · {fmtParty(r.adults, r.children)}
          </span>
        </>
      ),
    },
    {
      key: "type",
      header: "Apartment",
      cell: (r) => (
        <TypeMarker slug={r.type_slug} className="whitespace-nowrap">
          {r.type_short_name}
        </TypeMarker>
      ),
    },
    ...(multiUnit ? [{ key: "unit", header: "Unit", cell: (r: ReservationRow) => r.unit_name }] : []),
    {
      key: "total",
      header: "Total",
      align: "right",
      num: true,
      cell: (r) => (
        <>
          <span className="whitespace-nowrap">{fmtPKR(r.total)}</span>
          {r.amount_paid > 0 ? (
            <span className="block whitespace-nowrap text-[13px] font-normal text-ink-2">received {fmtPKR(r.amount_paid)}</span>
          ) : null}
        </>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <AdminStatusPill status={r.status} /> },
    {
      key: "open",
      header: "Action",
      srOnlyHeader: true,
      align: "right",
      cell: (r) => (
        <TextLink href={`/admin/reservations/${r.id}`} cell>
          Open<span className="sr-only"> {r.reference}</span>
        </TextLink>
      ),
    },
  ];

  return (
    <AdminPage gap={28}>
      <PageHeader
        eyebrow={eyebrow}
        title="Reservations"
        actions={
          <>
            {/* A download from a route handler, so a plain link rather than client navigation. */}
            <a href={`/api/admin/export${query ? `?${query}` : ""}`} className={buttonClass("secondary")} download>
              Export CSV
            </a>
            <ButtonLink href="/admin/reservations/new">Add a phone reservation</ButtonLink>
          </>
        }
      />
      <FilterBar
        values={values}
        options={{
          types: types.map((t) => ({ id: t.id, label: t.short_name })),
          units: types.flatMap((t) => t.units.map((u) => ({ id: u.id, label: `${t.short_name} · ${u.name}` }))),
        }}
      />
      <DataTable
        label={filtered ? "Reservations matching the filters" : "All reservations"}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        minWidth={multiUnit ? 1000 : 900}
        empty={filtered ? "No reservations match these filters." : "No reservations yet."}
      />
    </AdminPage>
  );
}
