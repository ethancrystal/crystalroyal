import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin-auth";
import { dashboard, type AwaitingVerification, type DashboardStay, type HoldEnding } from "@/lib/db/admin-queries";
import {
  AdminPage,
  AdminStatusPill,
  ButtonLink,
  DataTable,
  Kpi,
  KpiGrid,
  PageHeader,
  Section,
  TextLink,
  TypeMarker,
  fmtAgo,
  fmtIn,
  fmtLongDate,
  fmtMonthName,
  fmtNum,
  fmtParty,
  fmtPKR,
  fmtStay,
  fmtTime,
  greeting,
  type Column,
} from "@/components/admin/ui";
import { OccupancyStrip } from "@/components/admin/reservations/occupancy-strip";

// Dashboard (canvas AdminDashboard): greeting, four tiles (awaiting verification on midnight, arrivals, departures,
// revenue this month before tax), holds ending within two hours, today's arrivals and departures with their units,
// receipts awaiting verification oldest first, and the next 30 nights per unit.

export const metadata: Metadata = { title: "Dashboard" };

function shortNames(stays: { type_short_name: string }[]): string {
  if (stays.length === 0) return "None";
  const counts = new Map<string, number>();
  for (const s of stays) counts.set(s.type_short_name, (counts.get(s.type_short_name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} × ${n}` : name)).join(", ");
}

function openLink(id: string, reference: string) {
  return (
    <TextLink href={`/admin/reservations/${id}`} cell>
      Open<span className="sr-only"> {reference}</span>
    </TextLink>
  );
}

function stayCell(checkIn: string, checkOut: string, slug: string, shortName: string) {
  return (
    <span className="whitespace-nowrap">
      {fmtStay(checkIn, checkOut)}
      <span className="sr-only">, </span>
      <TypeMarker slug={slug} className="ml-3">
        {shortName}
      </TypeMarker>
    </span>
  );
}

export default async function DashboardPage() {
  await requireAdmin();
  const d = await dashboard();
  const oldest = d.awaiting[0];

  type TodayRow = DashboardStay & { movement: "Arriving" | "Departing" };
  const today: TodayRow[] = [
    ...d.arrivals.map((s) => ({ ...s, movement: "Arriving" as const })),
    ...d.departures.map((s) => ({ ...s, movement: "Departing" as const })),
  ];

  const awaitingColumns: Column<AwaitingVerification>[] = [
    { key: "ref", header: "Reference", rowHeader: true, cell: (r) => <span className="num whitespace-nowrap">{r.reference}</span> },
    { key: "guest", header: "Guest", cell: (r) => r.guest_name },
    { key: "stay", header: "Stay", cell: (r) => stayCell(r.check_in, r.check_out, r.type_slug, r.type_short_name) },
    {
      key: "amount",
      header: "Amount due",
      num: true,
      cell: (r) => (
        <>
          <span className="whitespace-nowrap">{fmtPKR(r.amount_due)}</span>
          {r.stated_amount !== null && r.stated_amount !== r.amount_due ? (
            <span className="block whitespace-nowrap text-[13px] font-normal text-ink-2">guest states {fmtPKR(r.stated_amount)}</span>
          ) : null}
        </>
      ),
    },
    { key: "since", header: "Uploaded", cell: (r) => <span className="whitespace-nowrap">{fmtAgo(r.minutes_since_upload)}</span> },
    {
      key: "status",
      header: "Status",
      cell: () => <AdminStatusPill status="payment_submitted" word="Receipt uploaded" />,
    },
    { key: "open", header: "Action", srOnlyHeader: true, align: "right", cell: (r) => openLink(r.id, r.reference) },
  ];

  const holdColumns: Column<HoldEnding>[] = [
    { key: "ref", header: "Reference", rowHeader: true, cell: (r) => <span className="num whitespace-nowrap">{r.reference}</span> },
    {
      key: "guest",
      header: "Guest",
      cell: (r) => (
        <>
          {r.guest_name}
          <span className="num block text-[13px] font-normal text-ink-2">{r.guest_phone}</span>
        </>
      ),
    },
    { key: "stay", header: "Stay", cell: (r) => stayCell(r.check_in, r.check_out, r.type_slug, r.type_short_name) },
    { key: "amount", header: "Amount due", num: true, cell: (r) => <span className="whitespace-nowrap">{fmtPKR(r.amount_due)}</span> },
    {
      key: "ends",
      header: "Hold ends",
      cell: (r) => (
        <span className="whitespace-nowrap">
          {fmtTime(r.hold_expires_at)} PKT
          <span className="block text-[13px] text-ink-2">{fmtIn(r.minutes_left)}</span>
        </span>
      ),
    },
    { key: "open", header: "Action", srOnlyHeader: true, align: "right", cell: (r) => openLink(r.id, r.reference) },
  ];

  const todayColumns: Column<TodayRow>[] = [
    { key: "ref", header: "Reference", rowHeader: true, cell: (r) => <span className="num whitespace-nowrap">{r.reference}</span> },
    { key: "move", header: "Today", cell: (r) => r.movement },
    {
      key: "guest",
      header: "Guest",
      cell: (r) => (
        <>
          {r.guest_name}
          <span className="block text-[13px] text-ink-2">
            {fmtParty(r.adults, r.children)}
            {r.movement === "Arriving" && r.arrival_time ? ` · arriving ${r.arrival_time}` : ""}
          </span>
        </>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      cell: (r) => (
        <TypeMarker slug={r.type_slug}>
          {r.unit_name}
          <span className="block text-[13px] text-ink-2">{r.type_short_name}</span>
        </TypeMarker>
      ),
    },
    { key: "stay", header: "Stay", cell: (r) => <span className="whitespace-nowrap">{fmtStay(r.check_in, r.check_out)}</span> },
    { key: "status", header: "Status", cell: (r) => <AdminStatusPill status={r.status} /> },
    { key: "open", header: "Action", srOnlyHeader: true, align: "right", cell: (r) => openLink(r.id, r.reference) },
  ];

  return (
    <AdminPage gap={36}>
      <PageHeader
        eyebrow={fmtLongDate(d.today)}
        title={greeting()}
        size={48}
        actions={<ButtonLink href="/admin/reservations/new">Add a phone reservation</ButtonLink>}
      />

      <KpiGrid>
        <Kpi
          tone="dark"
          label="Awaiting verification"
          value={d.awaiting.length}
          sub={oldest ? `Oldest ${fmtAgo(oldest.minutes_since_upload)}` : "Nothing waiting"}
          href="/admin/reservations?status=payment_submitted"
        />
        <Kpi label="Arrivals today" value={d.arrivals.length} sub={shortNames(d.arrivals)} />
        <Kpi label="Departures today" value={d.departures.length} sub={shortNames(d.departures)} />
        <Kpi label={`${fmtMonthName(d.month)} revenue, before tax`} value={fmtNum(d.revenueThisMonth)} sub="PKR · confirmed stays" />
      </KpiGrid>

      <Section title="Awaiting verification · oldest first" id="awaiting">
        <DataTable
          label="Receipts awaiting verification, oldest first"
          columns={awaitingColumns}
          rows={d.awaiting}
          rowKey={(r) => r.id}
          minWidth={760}
          empty="No receipts are waiting."
        />
      </Section>

      {d.holdsEndingSoon.length > 0 ? (
        <Section title="Holds ending within two hours" id="holds">
          <DataTable label="Holds ending within two hours" columns={holdColumns} rows={d.holdsEndingSoon} rowKey={(r) => r.id} minWidth={760} />
        </Section>
      ) : null}

      <Section title="Arrivals and departures · today" id="today">
        <DataTable
          label="Arrivals and departures today"
          columns={todayColumns}
          rows={today}
          rowKey={(r) => `${r.movement}-${r.id}`}
          minWidth={760}
          empty="No arrivals or departures today."
        />
      </Section>

      <Section title="Next 30 days" id="next-30">
        <OccupancyStrip rows={d.occupancy} today={d.today} />
      </Section>
    </AdminPage>
  );
}
