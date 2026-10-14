"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { addDays, isIsoDate, nightsBetween } from "@/lib/dates";
import { Field, Notice, Panel, TypeMarker, buttonClass, fmtStay } from "../ui";
import { EMPTY_FORM_STATE, type FormAction } from "../settings/form-state";
import type { CalCell, CalDay, CalRow, StayTone, UnitOption } from "./types";

// The month board of /admin/calendar (canvas AdminCalendar, laid out as the brief's "one row per unit"): a table
// with a row per unit and a column per night; reservations are bars labelled with the guest's name and the status
// word in its colour, and open the reservation; blocks are dashed with their reason. Free nights can be selected by
// dragging across them (mouse or pen) or by tapping the first and the last night; the selection fills the
// "Block nights" form beside the board, which is also the keyboard path (unit, first night, free-again date,
// reason, note).

const DAY_W = 30;
const HEAD_W = 150;

export const TONE_STYLE: Record<StayTone, { background: string; edge: string }> = {
  ok: { background: "color-mix(in srgb, var(--color-ok) 18%, var(--color-paper))", edge: "var(--color-ok)" },
  wait: { background: "color-mix(in srgb, var(--color-wait) 22%, var(--color-paper))", edge: "var(--color-wait)" },
  bad: { background: "color-mix(in srgb, var(--color-bad) 14%, var(--color-paper))", edge: "var(--color-bad)" },
  neutral: { background: "var(--color-ivory-2)", edge: "var(--color-ink-2)" },
};
export const BLOCK_STYLE = { background: "color-mix(in srgb, var(--color-taupe) 70%, var(--color-paper))", border: "1px dashed var(--color-ink-2)" };
export const SELECTED_STYLE = { background: "color-mix(in srgb, var(--color-gold) 38%, var(--color-paper))", outline: "1px solid var(--color-bronze)" };

const REASONS = [
  { value: "maintenance", label: "Maintenance" },
  { value: "owner_use", label: "Owner use" },
  { value: "other", label: "Other" },
];

interface Sel {
  unitId: string;
  start: string;
  /** exclusive */
  end: string;
}

interface BlockForm {
  unitId: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  note: string;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function CalendarBoard({
  label,
  days,
  rows,
  units,
  createAction,
  children,
}: {
  /** "November 2026" */
  label: string;
  days: CalDay[];
  rows: CalRow[];
  units: UnitOption[];
  createAction: FormAction;
  /** further panels for the aside (the canvas "Manual reservation") */
  children?: ReactNode;
}) {
  const [form, setForm] = useState<BlockForm>({ unitId: "", startsOn: "", endsOn: "", reason: "maintenance", note: "" });
  const [tapAnchor, setTapAnchor] = useState<{ unitId: string; date: string } | null>(null);
  const [state, dispatch, pending] = useActionState(createAction, EMPTY_FORM_STATE);

  // Nights that can be selected: free and not past, per unit.
  const selectable = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      m.set(r.unitId, new Set(r.cells.filter((c): c is Extract<CalCell, { kind: "free" }> => c.kind === "free" && !c.past).map((c) => c.date)));
    }
    return m;
  }, [rows]);

  const sel: Sel | null =
    form.unitId && isIsoDate(form.startsOn) && isIsoDate(form.endsOn) && form.endsOn > form.startsOn
      ? { unitId: form.unitId, start: form.startsOn, end: form.endsOn }
      : null;
  const selNights = sel ? nightsBetween(sel.start, sel.end) : 0;
  const selUnit = sel ? units.find((u) => u.id === sel.unitId) : undefined;

  const select = useCallback((s: Sel | null) => {
    setForm((f) => (s ? { ...f, unitId: s.unitId, startsOn: s.start, endsOn: s.end } : { ...f, startsOn: "", endsOn: "" }));
  }, []);

  /** From the anchor towards the target, as far as the nights stay free (a range never spans a taken night). */
  const freeRun = useCallback(
    (unitId: string, anchor: string, target: string): Sel => {
      const free = selectable.get(unitId) ?? new Set<string>();
      const step = target >= anchor ? 1 : -1;
      let last = anchor;
      for (let d = anchor; free.has(d); d = addDays(d, step)) {
        last = d;
        if (d === target) break;
      }
      return step > 0 ? { unitId, start: anchor, end: addDays(last, 1) } : { unitId, start: last, end: addDays(anchor, 1) };
    },
    [selectable],
  );

  // Dragging (mouse or pen). Touch scrolls the board as usual and selects by tapping.
  const drag = useRef<{ unitId: string; anchor: string; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const freeRunRef = useRef(freeRun);
  useEffect(() => {
    freeRunRef.current = freeRun;
  }, [freeRun]);

  useEffect(() => {
    function move(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-night]");
      if (!el || el.dataset.unit !== d.unitId || !el.dataset.night) return;
      if (el.dataset.night !== d.anchor) d.moved = true;
      if (d.moved) select(freeRunRef.current(d.unitId, d.anchor, el.dataset.night));
    }
    function up() {
      const d = drag.current;
      drag.current = null;
      if (d?.moved) {
        suppressClick.current = true;
        setTapAnchor(null);
        window.setTimeout(() => (suppressClick.current = false), 0);
      }
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [select]);

  function onCellPointerDown(e: ReactPointerEvent<HTMLTableCellElement>, unitId: string, date: string) {
    if (e.pointerType === "touch" || e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    drag.current = { unitId, anchor: date, moved: false };
  }

  function onCellClick(unitId: string, date: string) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (tapAnchor && tapAnchor.unitId === unitId && tapAnchor.date !== date) {
      select(freeRun(unitId, tapAnchor.date, date));
      setTapAnchor(null);
      return;
    }
    if (sel && sel.unitId === unitId && sel.start === date && sel.end === addDays(date, 1)) {
      select(null);
      setTapAnchor(null);
      return;
    }
    select({ unitId, start: date, end: addDays(date, 1) });
    setTapAnchor({ unitId, date });
  }

  // A saved block clears the selection (the board reloads with the block drawn in).
  useEffect(() => {
    if (state.ok) {
      setForm((f) => ({ ...f, startsOn: "", endsOn: "", note: "" }));
      setTapAnchor(null);
    }
  }, [state.ok, state.nonce]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  }

  // On a narrow screen the board scrolls sideways: start it at today rather than the 1st.
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const region = regionRef.current;
    const th = region?.querySelector<HTMLElement>("th[data-today]");
    const head = region?.querySelector<HTMLElement>("thead th");
    if (!region || !th || region.scrollWidth <= region.clientWidth) return;
    region.scrollLeft = Math.max(0, th.offsetLeft - (head?.offsetWidth ?? HEAD_W) - DAY_W);
  }, []);

  const err = state.fieldErrors ?? {};
  const isSelected = (unitId: string, date: string) => Boolean(sel && sel.unitId === unitId && sel.start <= date && date < sel.end);

  return (
    <div className="flex flex-wrap items-start gap-7">
      <div className="flex min-w-0 flex-[999_1_900px] flex-col gap-3">
        <div ref={regionRef} className="relative overflow-x-auto" role="region" aria-label={`${label}, one row per unit`} tabIndex={0}>
          <table
            className="w-full select-none border-separate border-spacing-0 text-[12px]"
            style={{ tableLayout: "fixed", minWidth: HEAD_W + DAY_W * days.length }}
          >
            <caption className="sr-only">
              {label}, one row per unit. Reservations open their page; blocks lead to the list of blocks. To block
              nights, drag across free nights or use the Block nights form.
            </caption>
            <colgroup>
              <col className="w-[112px] min-[600px]:w-[150px]" />
              {days.map((d) => (
                <col key={d.date} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-b border-l border-t border-r border-taupe bg-ivory px-2 py-2 text-left align-bottom text-[11px] font-medium uppercase tracking-[.14em] text-ink-2"
                >
                  Unit
                </th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    scope="col"
                    data-today={d.today ? "" : undefined}
                    className={`border-b border-r border-t border-taupe px-0 py-1.5 text-center align-bottom font-normal ${
                      d.today ? "bg-midnight text-on-dark" : d.past ? "text-ink-2" : "text-ink"
                    }`}
                  >
                    <span aria-hidden="true" className={`block text-[10px] tracking-[.12em] ${d.today ? "text-on-dark-2" : "text-ink-2"}`}>
                      {d.dow}
                    </span>
                    <span aria-hidden="true" className="num block text-[13px]">
                      {d.day}
                    </span>
                    <span className="sr-only">
                      {d.spoken}
                      {d.today ? ", today" : ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 1} className="border-b border-l border-r border-taupe px-3 py-4 text-[14px] text-ink-2">
                    No units to show.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.unitId}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-l border-r border-taupe bg-ivory px-2 py-1.5 text-left align-middle font-normal"
                    >
                      <TypeMarker slug={r.typeSlug} className="block text-[13px] leading-tight text-ink">
                        {r.unitName}
                      </TypeMarker>
                      <span className="mt-0.5 block pl-[11px] text-[11px] leading-tight text-ink-2">
                        {r.typeShortName}
                        {r.active ? "" : " · not active"}
                      </span>
                    </th>
                    {r.cells.map((c) => {
                      if (c.kind === "free") {
                        const on = isSelected(r.unitId, c.date);
                        return (
                          <td
                            key={c.date}
                            data-night={c.past ? undefined : c.date}
                            data-unit={r.unitId}
                            onPointerDown={c.past ? undefined : (e) => onCellPointerDown(e, r.unitId, c.date)}
                            onClick={c.past ? undefined : () => onCellClick(r.unitId, c.date)}
                            className={`h-[56px] border-b border-r border-taupe p-0 ${
                              c.past ? "bg-ivory-2" : "cursor-cell hover:bg-paper"
                            } ${tapAnchor && tapAnchor.unitId === r.unitId && tapAnchor.date === c.date ? "outline-2 -outline-offset-2 outline-bronze" : ""}`}
                            style={on ? { background: SELECTED_STYLE.background, outline: SELECTED_STYLE.outline, outlineOffset: -1 } : undefined}
                          >
                            <span className="sr-only">{c.past ? "" : on ? "Selected" : "Free"}</span>
                          </td>
                        );
                      }
                      if (c.kind === "stay") {
                        const t = TONE_STYLE[c.tone];
                        return (
                          <td key={`${c.id}-${c.start}`} colSpan={c.span} className="h-[56px] border-b border-r border-taupe p-[3px] align-middle">
                            <Link
                              href={`/admin/reservations/${c.id}`}
                              title={`${c.guestName} · ${c.statusWord} · ${c.reference} · ${c.range}`}
                              className="flex h-[48px] min-w-0 flex-col justify-center overflow-hidden px-1.5 leading-tight text-ink! no-underline hover:outline hover:outline-1 hover:outline-ink"
                              style={{ background: t.background, borderLeft: c.startsBefore ? "0" : `3px solid ${t.edge}` }}
                            >
                              <span className="block truncate font-medium">{c.guestName}</span>
                              <span className="block truncate">{c.statusWord}</span>
                              <span className="sr-only">
                                , {c.reference}, {c.range}. Open the reservation.
                              </span>
                            </Link>
                          </td>
                        );
                      }
                      return (
                        <td key={`${c.id}-${c.start}`} colSpan={c.span} className="h-[56px] border-b border-r border-taupe p-[3px] align-middle">
                          <a
                            href={`#block-${c.id}`}
                            title={`Blocked · ${c.reasonLabel} · ${c.range}${c.note ? ` · ${c.note}` : ""}`}
                            className="flex h-[48px] min-w-0 flex-col justify-center overflow-hidden px-1.5 leading-tight text-ink-2! no-underline hover:text-ink!"
                            style={BLOCK_STYLE}
                          >
                            <span className="block truncate font-medium">Blocked</span>
                            <span className="block truncate">{c.reasonLabel}</span>
                            <span className="sr-only">, {c.range}. Go to this block in the list.</span>
                          </a>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Legend />
      </div>

      <aside aria-label="Selection" className="flex min-w-0 flex-[1_1_260px] flex-wrap items-start gap-5">
        <Panel as="section" aria-labelledby="block-nights-h" className="min-w-0 flex-[1_1_260px] gap-3">
          <h2 id="block-nights-h" className="eyebrow text-bronze">
            Block nights
          </h2>
          <p className="num m-0 text-[15px]" aria-live="polite">
            {selNights > 0 ? plural(selNights, "night", "nights") : "No nights"} selected
            {sel ? (
              <span className="block text-[13px] font-normal text-ink-2">
                {selUnit?.label ?? ""}
                {selUnit ? " · " : ""}
                {fmtStay(sel.start, sel.end)}
              </span>
            ) : null}
          </p>
          <p className="m-0 text-[13px] text-ink-2">
            Drag across free nights in a unit’s row, or tap the first night and then the last. Or enter the dates here.
          </p>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
            {state.error ? (
              <Notice key={state.nonce} tone="bad">
                {state.error}
              </Notice>
            ) : state.ok ? (
              <Notice key={state.nonce} tone="ok">
                {state.ok}
              </Notice>
            ) : null}
            <Field
              as="select"
              label="Unit"
              name="unitId"
              id="block-unit"
              value={form.unitId}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              error={err.unitId}
              options={[{ value: "", label: "Choose a unit" }, ...units.map((u) => ({ value: u.id, label: u.label }))]}
            />
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
              <Field
                label="First night"
                name="startsOn"
                id="block-start"
                type="date"
                value={form.startsOn}
                onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
                error={err.startsOn}
              />
              <Field
                label="Free again on"
                name="endsOn"
                id="block-end"
                type="date"
                value={form.endsOn}
                onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
                error={err.endsOn}
                hint="The morning after the last blocked night."
              />
            </div>
            <Field
              as="select"
              label="Reason"
              name="reason"
              id="block-reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              error={err.reason}
              options={REASONS}
            />
            <Field
              label="Note, optional"
              name="note"
              id="block-note"
              maxLength={300}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              error={err.note}
              hint="For your records. Guests only see the nights as unavailable."
            />
            <div className="flex flex-wrap gap-2.5">
              <button type="submit" className={buttonClass("primary")} disabled={pending} aria-disabled={pending || undefined}>
                {pending ? "Blocking" : "Block selected nights"}
              </button>
              {sel || form.startsOn || form.endsOn ? (
                <button
                  type="button"
                  className={buttonClass("secondary")}
                  onClick={() => {
                    select(null);
                    setTapAnchor(null);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </form>
        </Panel>
        {children}
      </aside>
    </div>
  );
}

function Legend() {
  const swatch = (style: CSSProperties) => <span aria-hidden="true" className="inline-block h-3.5 w-5 shrink-0" style={style} />;
  return (
    <p className="m-0 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
      <span className="inline-flex items-center gap-1.5">
        {swatch({ background: TONE_STYLE.ok.background, borderLeft: `3px solid ${TONE_STYLE.ok.edge}` })}
        Confirmed, checked in
      </span>
      <span className="inline-flex items-center gap-1.5">
        {swatch({ background: TONE_STYLE.wait.background, borderLeft: `3px solid ${TONE_STYLE.wait.edge}` })}
        Reserved, payment received
      </span>
      <span className="inline-flex items-center gap-1.5">
        {swatch({ background: TONE_STYLE.neutral.background, borderLeft: `3px solid ${TONE_STYLE.neutral.edge}` })}
        Completed
      </span>
      <span className="inline-flex items-center gap-1.5">
        {swatch(BLOCK_STYLE)}
        Blocked
      </span>
      <span className="inline-flex items-center gap-1.5">
        {swatch({ background: SELECTED_STYLE.background, outline: SELECTED_STYLE.outline, outlineOffset: -1 })}
        Selected
      </span>
    </p>
  );
}
