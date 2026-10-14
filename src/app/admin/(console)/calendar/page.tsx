import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { nightsBetween, todayInKarachi } from "@/lib/dates";
import {
  AdminPage,
  BLOCK_REASON_LABEL,
  ButtonLink,
  Panel,
  Section,
  Th,
  TypeMarker,
  fmtMonthYear,
  fmtStay,
  tdDenseClass,
} from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/shell";
import { RowActionForm } from "@/components/admin/settings/form-kit";
import { CalendarBoard } from "@/components/admin/calendar/board";
import { monthBoard, parseMonth } from "@/components/admin/calendar/data";
import { createBlockAction, deleteBlockAction } from "./actions";

// Calendar and blocks (canvas AdminCalendar; brief: month view with one row per unit, bars labelled by guest name
// and status colour, drag to block nights with a reason, click a bar to open the reservation, "New reservation" for
// phone bookings). ?month=YYYY-MM picks the month; ?type=<slug> narrows the rows to one apartment type.

export const metadata: Metadata = { title: "Calendar and blocks" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const tabClass = (on: boolean) =>
  `inline-flex min-h-[44px] items-center border border-ink px-[18px] font-sans text-[13px] tracking-[.08em] no-underline transition-colors ${
    on ? "bg-ink text-ivory!" : "bg-transparent text-ink! hover:bg-ivory-2"
  }`;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayInKarachi();
  const month = parseMonth(sp.month) ?? today.slice(0, 7);

  const view = await monthBoard(month, today, one(sp.type));
  const typeSlug = view.type;

  const label = fmtMonthYear(view.from);
  const href = (m: string, t: string | undefined = typeSlug) => {
    const p = new URLSearchParams();
    if (m !== today.slice(0, 7)) p.set("month", m);
    if (t) p.set("type", t);
    const q = p.toString();
    return `/admin/calendar${q ? `?${q}` : ""}`;
  };

  return (
    <AdminPage gap={24}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-ink" style={{ fontSize: "clamp(32px, 7vw, 44px)" }}>
          <span className="sr-only">Calendar and blocks, </span>
          {label}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Month">
            <ul className="m-0 flex list-none flex-wrap p-0 pl-px pt-px">
              <li className="-ml-px -mt-px">
                <Link href={href(view.prev)} className={tabClass(false)}>
                  <span aria-hidden="true">←&nbsp;</span>
                  <span className="sr-only">Previous month, </span>
                  {fmtMonthYear(`${view.prev}-01`).split(" ")[0]}
                </Link>
              </li>
              <li className="-ml-px -mt-px">
                <Link href={href(today.slice(0, 7))} className={tabClass(month === today.slice(0, 7))} aria-current={month === today.slice(0, 7) ? "page" : undefined}>
                  This month
                </Link>
              </li>
              <li className="-ml-px -mt-px">
                <Link href={href(view.next)} className={tabClass(false)}>
                  <span className="sr-only">Next month, </span>
                  {fmtMonthYear(`${view.next}-01`).split(" ")[0]}
                  <span aria-hidden="true">&nbsp;→</span>
                </Link>
              </li>
            </ul>
          </nav>
          {view.types.length > 1 ? (
            <nav aria-label="Apartment">
              <ul className="m-0 flex list-none flex-wrap p-0 pl-px pt-px">
                <li className="-ml-px -mt-px">
                  <Link href={href(month, undefined)} className={tabClass(!typeSlug)} aria-current={!typeSlug ? "true" : undefined}>
                    All
                  </Link>
                </li>
                {view.types.map((t) => (
                  <li key={t.slug} className="-ml-px -mt-px">
                    <Link href={href(month, t.slug)} className={tabClass(typeSlug === t.slug)} aria-current={typeSlug === t.slug ? "true" : undefined}>
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
      <p className="m-0 text-[14px] text-ink-2">
        Select nights to block them for maintenance or owner use. Nights with a reservation cannot be blocked.
      </p>

      <CalendarBoard key={`${month}-${typeSlug ?? "all"}`} label={label} days={view.days} rows={view.rows} units={view.units} createAction={createBlockAction}>
        <Panel as="section" aria-labelledby="manual-h" className="min-w-0 flex-[1_1_260px] gap-2.5">
          <h2 id="manual-h" className="eyebrow text-bronze">
            Manual reservation
          </h2>
          <p className="m-0 text-[14px] text-ink-2">For phone or walk-in bookings. Priced by the same engine as online reservations.</p>
          <div>
            <ButtonLink href="/admin/reservations/new" variant="secondary">
              Add a reservation
            </ButtonLink>
          </div>
        </Panel>
      </CalendarBoard>

      <Section id="blocks" title={`Blocks in ${label}`} gap={10}>
        {view.blocks.length === 0 ? (
          <p className="m-0 text-[14px] text-ink-2">No nights are blocked this month.</p>
        ) : (
          <div className="relative overflow-x-auto" role="region" aria-label={`Blocks in ${label}`} tabIndex={0}>
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <caption className="sr-only">Blocks in {label}</caption>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Nights</Th>
                  <Th>Reason</Th>
                  <Th>Note</Th>
                  <Th srOnly className="text-right">
                    Action
                  </Th>
                </tr>
              </thead>
              <tbody>
                {view.blocks.map((b) => {
                  const n = nightsBetween(b.starts_on, b.ends_on);
                  const unitSlug = view.rows.find((r) => r.unitId === b.unit_id)?.typeSlug ?? "";
                  return (
                    <tr key={b.id} id={`block-${b.id}`} tabIndex={-1} className="scroll-mt-6 focus:bg-ivory-2">
                      <th scope="row" className={`${tdDenseClass} text-left font-normal`}>
                        <TypeMarker slug={unitSlug}>{b.unit_name}</TypeMarker>
                      </th>
                      <td className={`${tdDenseClass} num whitespace-nowrap`}>
                        {fmtStay(b.starts_on, b.ends_on)}
                        <span className="block text-[13px] font-normal text-ink-2">
                          {n} {n === 1 ? "night" : "nights"}
                        </span>
                      </td>
                      <td className={tdDenseClass}>{BLOCK_REASON_LABEL[b.reason]}</td>
                      <td className={`${tdDenseClass} max-w-[280px] break-words text-ink-2`}>{b.note || "—"}</td>
                      <td className={`${tdDenseClass} text-right`}>
                        <RowActionForm action={deleteBlockAction} className="inline-flex flex-col items-end">
                          <input type="hidden" name="blockId" value={b.id} />
                          <SubmitButton
                            variant="danger"
                            className="min-h-[44px] px-3 text-[11px]"
                            pendingText="Removing"
                            confirm={`Remove the block on ${b.unit_name}, ${fmtStay(b.starts_on, b.ends_on)}? Those nights become free again.`}
                          >
                            Delete block<span className="sr-only">, {b.unit_name}, {fmtStay(b.starts_on, b.ends_on)}</span>
                          </SubmitButton>
                        </RowActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </AdminPage>
  );
}
