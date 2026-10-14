import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { formatDate, todayInKarachi } from "@/lib/dates";
import { formatNumber, formatPKR } from "@/lib/money";
import { STATUS_TONE, type ReservationStatus } from "@/lib/status";
import type { ActivityEntry, BlockReason, PaymentMethod, PricingType, ReceiptStatus } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Ph, PhText } from "@/components/ph";

// Admin console primitives, drawn from the canvas artboards AdminDashboard / AdminReservation / AdminCalendar /
// AdminSettings: ivory work surface, charcoal sidebar (shell.tsx), admin type scale 14/1.5, dense tables with a
// bronze header rule, 44px controls, no crystal motif. No hooks here: usable from Server and Client Components.
// Colours come only from the --color-* tokens (Tailwind: bg-ivory-2, text-ink-2, border-taupe, ...).

export { StatusPill, Ph, PhText };

// ---------------------------------------------------------------- layout

/** Vertical stack for a console page. The canvas uses 36px (dashboard), 28px (detail), 24px (calendar), 48px (settings). */
export function AdminPage({ children, gap = 36, className = "" }: { children: ReactNode; gap?: number; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`} style={{ gap }}>
      {children}
    </div>
  );
}

/** Eyebrow (bronze) over a Cormorant title, with an optional action slot on the right. */
export function PageHeader({
  eyebrow,
  title,
  size = 44,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** desktop size in px; the canvas uses 48 on the dashboard and 44 elsewhere */
  size?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow num text-bronze">{eyebrow}</p> : null}
        <h1 className="display break-words text-ink" style={{ fontSize: `clamp(32px, 7vw, ${size}px)` }}>
          {title}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

function slugId(s: ReactNode): string {
  return typeof s === "string" ? s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "section";
}

/**
 * A titled section. "eyebrow" headings (bronze caps, 12px) are the dashboard/detail style; "display" headings
 * (Cormorant 36px) are the settings style. Pass `id` when the title is not plain text or repeats on a page.
 */
export function Section({
  id,
  title,
  variant = "eyebrow",
  actions,
  description,
  children,
  gap = 12,
  className = "",
  style,
}: {
  id?: string;
  title: ReactNode;
  variant?: "eyebrow" | "display";
  actions?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const hid = `${id ?? slugId(title)}-h`;
  return (
    <section id={id} aria-labelledby={hid} className={`flex min-w-0 flex-col ${className}`} style={{ gap, ...style }}>
      {actions || variant === "display" ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading id={hid} variant={variant}>
            {title}
          </SectionHeading>
          {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
        </div>
      ) : (
        <SectionHeading id={hid} variant={variant}>
          {title}
        </SectionHeading>
      )}
      {description ? <p className="m-0 text-[13px] text-ink-2">{description}</p> : null}
      {children}
    </section>
  );
}

function SectionHeading({ id, variant, children }: { id: string; variant: "eyebrow" | "display"; children: ReactNode }) {
  return variant === "display" ? (
    <h2 id={id} className="display text-ink" style={{ fontSize: "clamp(28px, 5vw, 36px)" }}>
      {children}
    </h2>
  ) : (
    <h2 id={id} className="eyebrow text-bronze">
      {children}
    </h2>
  );
}

/** The ivory-2 panel used for the receipt, "Block nights" and "Manual reservation" boxes. */
export function Panel({
  children,
  className = "",
  tone = "light",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
  as?: "div" | "section" | "aside";
} & Omit<ComponentProps<"div">, "className" | "children">) {
  const toneClass = tone === "dark" ? "bg-midnight text-on-dark" : "bg-ivory-2 text-ink";
  return (
    <Tag className={`flex flex-col gap-3 p-5 ${toneClass} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------- KPI tiles

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">{children}</div>;
}

/** Dashboard tile: label in caps, a Cormorant 52px figure, a short line. "dark" is the one that needs attention. */
export function Kpi({
  label,
  value,
  sub,
  tone = "light",
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "light" | "dark";
  href?: string;
}) {
  const dark = tone === "dark";
  const body = (
    <>
      <p className={`eyebrow ${dark ? "text-on-dark-2" : "text-ink-2"}`} style={{ fontSize: 11 }}>
        {label}
      </p>
      <p
        className={`num m-0 mt-1.5 ${dark ? "text-gold" : "text-ink"}`}
        style={{ fontFamily: "var(--font-display)", fontSize: 52, lineHeight: 1, fontWeight: 400 }}
      >
        {value}
      </p>
      {sub ? <p className={`m-0 mt-1.5 text-[13px] ${dark ? "text-on-dark-2" : "text-ink-2"}`}>{sub}</p> : null}
    </>
  );
  const cls = `block p-6 no-underline ${dark ? "bg-midnight text-on-dark!" : "bg-ivory-2 text-ink!"}`;
  return href ? (
    <Link href={href} className={`${cls} hover:outline hover:outline-1 hover:outline-bronze`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---------------------------------------------------------------- tables

export const thClass =
  "px-3 py-2.5 text-left align-bottom text-[11px] font-medium uppercase tracking-[.16em] text-ink-2 border-b border-bronze whitespace-nowrap";
export const tdClass = "px-3 py-3.5 align-middle text-[15px] border-b border-taupe";
export const tdDenseClass = "px-3 py-2.5 align-middle text-[14px] border-b border-taupe";

export function Th({ children, className = "", srOnly, ...rest }: ComponentProps<"th"> & { srOnly?: boolean }) {
  return (
    <th scope="col" className={`${thClass} ${className}`} {...rest}>
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

export function Td({ children, className = "", dense, num, ...rest }: ComponentProps<"td"> & { dense?: boolean; num?: boolean }) {
  return (
    <td className={`${dense ? tdDenseClass : tdClass} ${num ? "num" : ""} ${className}`} {...rest}>
      {children}
    </td>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** tabular numerals, weight 500 */
  num?: boolean;
  /** header text for screen readers only (e.g. "Action") */
  srOnlyHeader?: boolean;
  width?: number | string;
  /** rendered as <th scope="row"> (use for the reference/name column) */
  rowHeader?: boolean;
}

/**
 * Dense data table from the canvas: 11px caps header over a bronze rule, 15px cells over taupe rules. Wide tables
 * scroll inside their own focusable region so the page never scrolls sideways at 320px.
 */
export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  empty = "Nothing to show.",
  minWidth = 720,
  dense = false,
}: {
  /** accessible name for the table and its scroll region */
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  minWidth?: number;
  dense?: boolean;
}) {
  const align = (a?: "left" | "right" | "center") => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  return (
    // "relative" keeps the visually hidden headers (position: absolute) inside the scroll box, so they cannot
    // widen the page at 320px.
    <div className="relative overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`${thClass} ${align(c.align)}`} style={c.width ? { width: c.width } : undefined}>
                {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${dense ? tdDenseClass : tdClass} text-ink-2`}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => {
                  const cls = `${dense ? tdDenseClass : tdClass} ${align(c.align)} ${c.num ? "num" : ""}`;
                  return c.rowHeader ? (
                    <th key={c.key} scope="row" className={`${cls} font-medium`}>
                      {c.cell(row, i)}
                    </th>
                  ) : (
                    <td key={c.key} className={cls}>
                      {c.cell(row, i)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** "Guest and stay" rows: a 150px term column over taupe rules. */
export function DetailList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`m-0 ${className}`}>{children}</dl>;
}

export function DetailRow({ term, children, num }: { term: ReactNode; children: ReactNode; num?: boolean }) {
  return (
    <div className="grid gap-4 border-b border-taupe py-2.5 text-[15px] [grid-template-columns:minmax(0,150px)_minmax(0,1fr)] max-[480px]:[grid-template-columns:minmax(0,110px)_minmax(0,1fr)] max-[480px]:gap-3">
      <dt className="text-ink-2">{term}</dt>
      <dd className={`m-0 min-w-0 break-words ${num ? "num" : ""}`}>{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- fields

export const labelClass = "block mb-1.5 text-[11px] font-medium uppercase tracking-[.16em] text-ink-2";
export const inputClass =
  "w-full min-h-[44px] border border-taupe bg-paper px-3 py-2 font-sans text-[15px] text-ink placeholder:text-ink-2 aria-[invalid=true]:border-bad";

type FieldCommon = {
  label: ReactNode;
  name: string;
  id?: string;
  hint?: ReactNode;
  error?: string | null;
  /** visually hidden label (the canvas filter bar) */
  labelHidden?: boolean;
  className?: string;
  inputClassName?: string;
};
type InputFieldProps = FieldCommon & { as?: "input" } & Omit<ComponentProps<"input">, "name" | "id" | "className">;
type SelectFieldProps = FieldCommon & {
  as: "select";
  options: { value: string; label: string; disabled?: boolean }[];
} & Omit<ComponentProps<"select">, "name" | "id" | "className" | "children">;
type TextareaFieldProps = FieldCommon & { as: "textarea" } & Omit<ComponentProps<"textarea">, "name" | "id" | "className">;

/**
 * Label + input/select/textarea + hint + error. The error is linked with aria-describedby and sets aria-invalid.
 * <Field label="Hold, hours" name="hold_hours" type="number" defaultValue={12} error={errors.hold_hours} />
 * <Field as="select" label="Deposit policy" name="deposit_policy" options={[...]} defaultValue="full" />
 */
export function Field(props: InputFieldProps | SelectFieldProps | TextareaFieldProps) {
  const { label, name, id: idProp, hint, error, labelHidden, className = "", inputClassName = "" } = props;
  const id = idProp ?? `f-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const a11y = { id, name, "aria-describedby": describedBy, "aria-invalid": error ? (true as const) : undefined };
  let control: ReactNode;
  if (props.as === "select") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { as, label: _l, name: _n, id: _i, hint: _h, error: _e, labelHidden: _lh, className: _c, inputClassName: _ic, options, ...rest } = props;
    control = (
      <select {...rest} {...a11y} className={`${inputClass} ${inputClassName}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (props.as === "textarea") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { as, label: _l, name: _n, id: _i, hint: _h, error: _e, labelHidden: _lh, className: _c, inputClassName: _ic, ...rest } = props;
    control = <textarea rows={3} {...rest} {...a11y} className={`${inputClass} min-h-[80px] ${inputClassName}`} />;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { as, label: _l, name: _n, id: _i, hint: _h, error: _e, labelHidden: _lh, className: _c, inputClassName: _ic, ...rest } = props;
    control = <input {...rest} {...a11y} className={`${inputClass} ${rest.type === "number" ? "num" : ""} ${inputClassName}`} />;
  }
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className={labelHidden ? "sr-only" : labelClass}>
        {label}
      </label>
      {control}
      {hint ? (
        <p id={`${id}-hint`} className="m-0 mt-1.5 text-[13px] text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="err">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A checkbox with its label as a 44px target. */
export function CheckboxField({
  label,
  name,
  id: idProp,
  hint,
  error,
  className = "",
  ...rest
}: {
  label: ReactNode;
  name: string;
  id?: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
} & Omit<ComponentProps<"input">, "name" | "id" | "className" | "type">) {
  const id = idProp ?? `f-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          id={id}
          name={name}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="h-5 w-5 accent-[var(--color-ink)]"
          {...rest}
        />
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 text-[13px] text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="err">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- buttons and links

export type ButtonVariant = "primary" | "secondary" | "confirm" | "danger" | "gold";

// Text colours on links carry "!" because globals.css sets an unlayered `a { color: inherit }`, which otherwise
// wins over Tailwind's layered utilities.
const BUTTON_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 border px-[18px] text-center font-sans text-[12px] font-medium uppercase tracking-[.14em] no-underline cursor-pointer transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-35 aria-disabled:cursor-not-allowed aria-disabled:opacity-35";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // charcoal fill: "Add a phone reservation", "Save bank details", "Block selected nights"
  primary: "border-ink bg-ink text-ivory! hover:border-midnight hover:bg-midnight",
  // charcoal hairline: "Reject receipt", "Save note", "Add an amenity"
  secondary: "border-ink bg-transparent text-ink! hover:bg-ink hover:text-ivory!",
  // green fill: "Confirm stay" / "Verify and confirm"
  confirm: "border-ok bg-ok text-paper! hover:border-ink hover:bg-ink",
  // red hairline: "Cancel"
  danger: "border-bad bg-transparent text-bad! hover:bg-bad hover:text-paper!",
  // gold fill on midnight: "Yes, save these details"
  gold: "border-gold bg-gold text-midnight! hover:border-facet hover:bg-facet",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...rest} />;
}

/** Bronze underlined link ("Open", "Edit", "WhatsApp"). `cell` gives it a 44px target inside table rows. */
export function TextLink({ className = "", cell, ...rest }: ComponentProps<typeof Link> & { cell?: boolean }) {
  return (
    <Link
      className={`text-bronze! underline underline-offset-2 hover:text-ink! ${cell ? "-my-2.5 inline-flex min-h-[44px] items-center px-1" : ""} ${className}`}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------- status, markers, notices

/** Admin status words (canvas: "Payment received" in the filter and on the detail). Tone from lib/status.ts. */
export const ADMIN_STATUS_WORD: Record<ReservationStatus, string> = {
  reserved: "Reserved",
  payment_submitted: "Payment received",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

/** Status pill with its word, reusing the shared .pill-* tones. "sm" is the dense table size. */
export function AdminStatusPill({ status, size = "sm", word }: { status: ReservationStatus; size?: "sm" | "md"; word?: string }) {
  const style: CSSProperties =
    size === "sm"
      ? { padding: "2px 10px", fontSize: 11, letterSpacing: ".12em", whiteSpace: "nowrap" }
      : { padding: "6px 14px", fontSize: 12, letterSpacing: ".14em", whiteSpace: "nowrap" };
  return (
    <span className={`pill pill-${STATUS_TONE[status]}`} style={style}>
      {word ?? ADMIN_STATUS_WORD[status]}
    </span>
  );
}

/**
 * The 3px marker beside a type name (brief: stones appear in admin only as a 3px marker). The stone colours are
 * not used (ARCHITECTURE.md), so the marker is gold for the three-bedroom and bronze for the two-bedroom; the
 * name is always written, so colour never carries the meaning alone.
 */
export function TypeMarker({ slug, children, className = "" }: { slug: string; children: ReactNode; className?: string }) {
  return (
    <span className={className}>
      <span
        aria-hidden="true"
        className="mr-2 inline-block"
        style={{ width: 3, height: "1.15em", verticalAlign: "-0.2em", background: typeMarkerColor(slug) }}
      />
      {children}
    </span>
  );
}

export function typeMarkerColor(slug: string): string {
  if (slug === "three-bedroom") return "var(--color-gold)";
  if (slug === "two-bedroom") return "var(--color-bronze)";
  return "var(--color-ink-2)";
}

export type NoticeTone = "ok" | "wait" | "bad";
const NOTICE_WORD: Record<NoticeTone, string> = { ok: "Saved.", wait: "Note.", bad: "Not saved." };

/**
 * A notice band (canvas: the "11 values still need the owner." banner). The leading word states the status, so
 * colour is never the only signal. "bad" is announced as an alert, the others politely.
 */
export function Notice({
  tone = "wait",
  title,
  children,
  className = "",
}: {
  tone?: NoticeTone;
  /** the leading word or sentence, in medium weight; defaults to Saved. / Note. / Not saved. */
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const color = tone === "ok" ? "var(--color-ok)" : tone === "bad" ? "var(--color-bad)" : "var(--color-wait)";
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={`px-[18px] py-3.5 text-[15px] text-ink ${className}`}
      style={{ background: `color-mix(in srgb, ${color} 18%, var(--color-paper))`, border: `1px solid ${color}` }}
    >
      <strong className="font-medium">{title ?? NOTICE_WORD[tone]}</strong>
      {children ? <> {children}</> : null}
    </div>
  );
}

// ---------------------------------------------------------------- occupancy colours (dashboard strip, calendar)

export type OccupancyState = "free" | "reserved" | "confirmed" | "blocked";

export const OCCUPANCY_STYLE: Record<OccupancyState, { label: string; background: string; border?: string; pale: string }> = {
  confirmed: { label: "Confirmed", background: "var(--color-ok)", pale: "color-mix(in srgb, var(--color-ok) 18%, var(--color-paper))" },
  reserved: {
    label: "Held, awaiting transfer",
    background: "var(--color-wait)",
    pale: "color-mix(in srgb, var(--color-wait) 22%, var(--color-paper))",
  },
  blocked: { label: "Blocked", background: "var(--color-ink-2)", pale: "var(--color-taupe)" },
  free: { label: "Free", background: "var(--color-ivory-2)", border: "1px solid var(--color-taupe)", pale: "transparent" },
};

/** The legend under the 30-day strip. */
export function OccupancyLegend({ states = ["confirmed", "reserved", "blocked", "free"] }: { states?: OccupancyState[] }) {
  return (
    <p className="m-0 flex flex-wrap gap-5 text-[13px] text-ink-2">
      {states.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3.5 w-3.5" style={{ background: OCCUPANCY_STYLE[s].background, border: OCCUPANCY_STYLE[s].border }} />
          {OCCUPANCY_STYLE[s].label}
        </span>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------- formatting helpers

export const fmtPKR = formatPKR;
export const fmtNum = formatNumber;

const KARACHI = "Asia/Karachi";

/** "Mon 2 Nov 2026" (en-GB adds a comma after the weekday in some runtimes; the canvas has none) */
export function fmtDay(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return formatDate(iso, opts).replace(",", "");
}

/** "2 Nov" */
export function fmtShortDay(iso: string): string {
  return formatDate(iso, { weekday: undefined, year: undefined });
}

/** Canvas stay ranges: "21 – 23 Oct", "30 Oct – 2 Nov", "30 Dec 2026 – 2 Jan 2027". */
export function fmtStay(checkIn: string, checkOut: string): string {
  const [y1, m1] = checkIn.split("-");
  const [y2, m2] = checkOut.split("-");
  const d1 = Number(checkIn.slice(8));
  if (y1 !== y2) return `${formatDate(checkIn, { weekday: undefined })} – ${formatDate(checkOut, { weekday: undefined })}`;
  if (m1 !== m2) return `${fmtShortDay(checkIn)} – ${fmtShortDay(checkOut)}`;
  return `${d1} – ${fmtShortDay(checkOut)}`;
}

/** Detail header range: "Mon 2 – Thu 5 Nov 2026". */
export function fmtStayLong(checkIn: string, checkOut: string): string {
  const sameMonth = checkIn.slice(0, 7) === checkOut.slice(0, 7);
  const first = sameMonth
    ? fmtDay(checkIn, { month: undefined, year: undefined })
    : checkIn.slice(0, 4) === checkOut.slice(0, 4)
      ? fmtDay(checkIn, { year: undefined })
      : fmtDay(checkIn);
  return `${first} – ${fmtDay(checkOut)}`;
}

/** Activity times: "13 Oct 14:05" in Karachi time. */
export function fmtWhen(isoInstant: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KARACHI,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoInstant));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("hour")}:${get("minute")}`;
}

/** "14:05" in Karachi time. */
export function fmtTime(isoInstant: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: KARACHI, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(isoInstant),
  );
}

/** "just now", "12 minutes ago", "5 hours ago", "2 days ago" */
export function fmtAgo(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}

/** "in 45 minutes", "in 1 hour 30 minutes" */
export function fmtIn(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `in ${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `in ${h} hour${h === 1 ? "" : "s"}${r ? ` ${r} minute${r === 1 ? "" : "s"}` : ""}`;
}

export function fmtNights(n: number): string {
  return `${n} night${n === 1 ? "" : "s"}`;
}

/** "2 adults, 4 children" */
export function fmtParty(adults: number, children: number): string {
  const a = `${adults} adult${adults === 1 ? "" : "s"}`;
  return children > 0 ? `${a}, ${children} child${children === 1 ? "" : "ren"}` : a;
}

/** "Tuesday 13 October 2026" */
export function fmtLongDate(iso: string = todayInKarachi()): string {
  return fmtDay(iso, { weekday: "long", month: "long" });
}

/** "October" */
export function fmtMonthName(iso: string): string {
  return formatDate(iso, { weekday: undefined, day: undefined, year: undefined, month: "long" });
}

/** "November 2026" */
export function fmtMonthYear(iso: string): string {
  return formatDate(iso, { weekday: undefined, day: undefined, month: "long" });
}

/** Good morning / afternoon / evening, by the hour in Karachi. */
export function greeting(now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: KARACHI, hour: "2-digit", hour12: false }).format(now)) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const PRICING_LABEL: Record<PricingType, string> = {
  per_stay: "per stay",
  per_night: "per night",
  per_guest_per_night: "per guest per night",
  per_trip: "per trip",
  per_day: "per day",
};

export const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  maintenance: "Maintenance",
  owner_use: "Owner use",
  other: "Other",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

export const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  submitted: "Awaiting verification",
  verified: "Verified",
  rejected: "Rejected",
  none: "No receipt",
};

const EMAIL_LABEL: Record<string, string> = {
  reservation_received: "Reservation received",
  hold_reminder: "Hold reminder",
  receipt_received: "Receipt received",
  owner_receipt_uploaded: "Receipt uploaded, to owner",
  confirmed: "Stay confirmed",
  receipt_rejected: "Receipt not matched",
  hold_ended: "Hold ended",
  cancelled: "Reservation cancelled",
  owner_new_reservation: "New reservation, to owner",
  owner_cancellation_requested: "Cancellation requested, to owner",
};

function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

/** One line for an activity_log entry, in the canvas voice ("Receipt uploaded by guest."). */
export function describeActivity(e: Pick<ActivityEntry, "actor" | "action" | "detail">): string {
  const d = e.detail ?? {};
  const reason = str(d.reason);
  const [kind, sub, extra] = e.action.split(":");
  if (kind === "email") {
    const name = EMAIL_LABEL[sub] ?? sub;
    if (extra === "skipped") return `Email not sent (${name}): no address set.`;
    if (extra === "failed") return `Email failed to send: ${name}.`;
    return `Email sent: ${name}.`;
  }
  if (kind === "status") {
    switch (sub) {
      case "payment_submitted":
        return "Receipt uploaded by guest.";
      case "confirmed":
        return "Payment verified, stay confirmed.";
      case "reserved":
        return reason ? `Receipt rejected: ${reason} Returned to Reserved.` : "Returned to Reserved.";
      case "cancelled":
        return `Cancelled${e.actor === "admin" ? " by admin" : ""}${reason ? `: ${reason}` : "."}`;
      case "expired":
        return "Hold ended.";
      case "checked_in":
        return "Guest checked in.";
      case "completed":
        return "Guest checked out. Stay completed.";
      default:
        return `Status changed to ${sub}.`;
    }
  }
  switch (e.action) {
    case "created":
      return e.actor === "admin" ? "Reservation added by admin." : "Reserved online.";
    case "cancellation_requested":
      return "Guest asked to cancel.";
    case "unit_moved":
      return `Moved from ${str(d.from_name) || "another unit"} to ${str(d.to_name) || "another unit"}.`;
    case "note_added":
      return "Note added.";
    case "payment:recorded":
      return `Payment recorded: ${PAYMENT_METHOD_LABEL[str(d.method) as PaymentMethod] ?? "payment"}${
        typeof d.amount === "number" ? `, ${formatPKR(d.amount)}` : ""
      }.`;
    case "payment:verified":
      return "Receipt verified.";
    case "payment:rejected":
      return `Receipt rejected${reason ? `: ${reason}` : "."}`;
    default:
      return e.action.replace(/[_:]/g, " ");
  }
}
