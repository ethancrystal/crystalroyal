#!/usr/bin/env node
// Manual backup: every reservation as CSV, written to standard output (or to the file named as the first argument).
//
//   npm run -s export:reservations > reservations-2026-10-14.csv
//   node scripts/export-reservations.mjs backups/reservations.csv
//
// Reads DATABASE_URL from the environment, or from .env.local / .env in the project folder. Read-only.
// The first 31 columns match the console's "Export CSV"; then the amenities, the payments and the owner's notes, so
// the file stands on its own as a record. Times are Karachi time. Cells a spreadsheet would treat as a formula are
// prefixed with an apostrophe.

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (existsSync(file)) {
      process.loadEnvFile(file);
      if (process.env.DATABASE_URL) return;
    }
  }
}

const STATUS_WORD = {
  reserved: "Reserved",
  payment_submitted: "Payment received",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const HEADER = [
  "Reference",
  "Status",
  "Source",
  "Apartment",
  "Unit",
  "Arrival",
  "Departure",
  "Nights",
  "Adults",
  "Children",
  "Guest",
  "Phone",
  "Email",
  "Arrival time",
  "Requests",
  "Nightly rate",
  "Nights subtotal",
  "Extra adults",
  "Extra adults amount",
  "Amenities amount",
  "Tax label",
  "Tax rate percent",
  "Tax amount",
  "Total",
  "Amount due",
  "Amount paid",
  "Currency",
  "Created (PKT)",
  "Confirmed (PKT)",
  "Cancelled (PKT)",
  "Cancellation reason",
  "Amenities",
  "Payments",
  "Owner notes",
];

function cell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  // Spreadsheet formula injection: neutralise cells a spreadsheet would evaluate (phone numbers stay as they are).
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s]+$/.test(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const karachi = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function stamp(value) {
  if (!value) return "";
  const p = karachi.formatToParts(new Date(value));
  const g = (t) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Set it, or put it in .env.local, then run this again.");
    process.exit(1);
  }
  const out = process.argv[2];

  const sql = postgres(url, {
    max: 1,
    prepare: false, // works through the Supabase transaction pooler
    onnotice: () => undefined,
    types: { date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x } },
  });

  try {
    const rows = await sql`
      select r.*, t.name as type_name, u.name as unit_name,
        coalesce((select sum(p.amount) from payments p where p.reservation_id = r.id and p.receipt_status = 'verified'), 0)::int
          as amount_paid,
        coalesce((select string_agg(a.name_snapshot || ' x' || a.quantity
                    || coalesce(' = PKR ' || a.line_total, ' (quoted separately)'), '; ' order by a.name_snapshot)
                  from reservation_amenities a where a.reservation_id = r.id), '') as amenities,
        coalesce((select string_agg(p.method || ' ' || coalesce('PKR ' || p.amount, 'amount not stated') || ' '
                    || p.receipt_status || coalesce(' ref ' || p.bank_reference, '')
                    || ' ' || to_char(p.created_at at time zone 'Asia/Karachi', 'YYYY-MM-DD HH24:MI'), '; ' order by p.created_at)
                  from payments p where p.reservation_id = r.id), '') as payments
      from reservations r
      join apartment_types t on t.id = r.apartment_type_id
      join units u on u.id = r.unit_id
      order by r.check_in, r.created_at`;

    const lines = [HEADER.map(cell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.reference,
          STATUS_WORD[r.status] ?? r.status,
          r.source,
          r.type_name,
          r.unit_name,
          r.check_in,
          r.check_out,
          r.nights,
          r.adults,
          r.children,
          r.guest_name,
          r.guest_phone,
          r.guest_email,
          r.arrival_time,
          r.requests,
          r.nightly_rate,
          r.subtotal_nights,
          r.extra_adults,
          r.extra_adults_amount,
          r.amenities_amount,
          r.tax_label,
          r.tax_rate_percent ?? "",
          r.tax_amount,
          r.total,
          r.amount_due,
          r.amount_paid,
          r.currency,
          stamp(r.created_at),
          stamp(r.confirmed_at),
          stamp(r.cancelled_at),
          r.cancel_reason ?? "",
          r.amenities,
          r.payments,
          r.admin_notes,
        ]
          .map(cell)
          .join(","),
      );
    }
    const csv = lines.join("\r\n") + "\r\n";

    if (out) {
      // A byte-order mark so Excel opens the UTF-8 file with names intact.
      await writeFile(out, `﻿${csv}`);
      console.error(`Wrote ${rows.length} reservation${rows.length === 1 ? "" : "s"} to ${out}.`);
    } else {
      process.stdout.write(csv);
      console.error(`Exported ${rows.length} reservation${rows.length === 1 ? "" : "s"}.`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("The export failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
