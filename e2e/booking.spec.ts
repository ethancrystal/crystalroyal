import { rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

// The brief's end-to-end scenarios, run in the desktop and the mobile project (playwright.config.ts):
//  1. Reserve the three-bedroom for 2 adults and 4 children with one amenity, reach the payment page with the
//     Meezan Bank card and the reference, upload a PNG receipt ("Receipt received"); as admin, verify it; the status
//     page and the voucher then show the stay as confirmed.
//  2. The same dates again show "Not available" with the nearest free stay.
//  3. A party of nine is refused with the exact message.
//  4. An expired hold shows "Hold ended" with the reserve-again link (the hold is expired through SQL).
//  5. The two-bedroom, whose occupancy is not yet confirmed, offers "Ask on WhatsApp" instead of reserving.
//  6. Each apartment page carries its stone: data-stone="lapis" (three-bedroom) and "jade" (two-bedroom).
// Rows the tests create carry guest emails e2e+…@example.com (and blocks the note 'e2e'); they are removed before
// each run, so the suite can be repeated against the same database.

const DATABASE_URL = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "e2e-owner@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.LOCAL_ADMIN_PASSWORD;

const PARTY_TOO_LARGE =
  "This apartment accommodates up to 8 guests. For a larger party, write to us and we will suggest an arrangement.";

/** Karachi "today" (YYYY-MM-DD). */
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** The brief's dates while they are still ahead; afterwards the same pattern three weeks out. */
const ARRIVE = today < "2026-11-02" ? "2026-11-02" : addDays(today, 21);
const DEPART = addDays(ARRIVE, 3);
const HOLD_ARRIVE = addDays(ARRIVE, 8);
const BIG_PARTY_ARRIVE = addDays(ARRIVE, 18);

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

let sql: postgres.Sql | null = null;

function db(): postgres.Sql {
  if (!sql) throw new Error("Set DATABASE_URL (or E2E_DATABASE_URL) to the database the server under test uses.");
  return sql;
}

test.beforeAll(async () => {
  if (DATABASE_URL) sql = postgres(DATABASE_URL, { max: 2, prepare: false, onnotice: () => undefined });
});

test.afterAll(async () => {
  // E2E_KEEP=1 leaves the rows in place to look at; the next run removes them either way.
  if (sql && process.env.E2E_KEEP !== "1") await tidy();
  await sql?.end({ timeout: 5 });
});

async function tidy() {
  const mine = await db()<{ id: string }[]>`select id from reservations where guest_email like 'e2e+%@example.com'`;
  const ids = mine.map((r) => r.id);
  if (ids.length > 0) {
    // activity_log keeps its rows when a reservation goes (on delete set null): remove them with it.
    await db()`delete from activity_log where reservation_id in ${db()(ids)}`;
    await db()`delete from reservations where id in ${db()(ids)}`;
    // Receipts uploaded to a development server are files under .data/receipts/{reservation id}/.
    await Promise.all(ids.map((id) => rm(path.join(__dirname, "..", ".data", "receipts", id), { recursive: true, force: true })));
  }
  await db()`delete from unit_blocks where note = 'e2e'`;
}

async function threeBedroomId(): Promise<string> {
  const [t] = await db()<{ id: string }[]>`select id from apartment_types where slug = 'three-bedroom'`;
  return t.id;
}

/** The visible one of a pair of buttons (the reserve steps render one in the page and one in the mobile bar). */
const visibleButton = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).filter({ visible: true }).first();

test.describe("reserve, pay, verify", () => {
  test.describe.configure({ mode: "serial" });

  let reference = "";
  let token = "";

  test.beforeAll(async () => {
    await tidy();
    const typeId = await threeBedroomId();
    const [busy] = await db()<{ n: number }[]>`
      select count(*)::int as n from units u
      where u.apartment_type_id = ${typeId} and u.active and not unit_is_free(u.id, ${ARRIVE}::date, ${DEPART}::date)`;
    const [units] = await db()<{ n: number }[]>`select count(*)::int as n from units where apartment_type_id = ${typeId} and active`;
    expect(busy.n, `The three-bedroom must be free ${ARRIVE} to ${DEPART} in this database before the run.`).toBeLessThan(units.n);
  });

  test("a guest reserves the three-bedroom, reaches the payment page and uploads a receipt", async ({ page, browserName }, info) => {
    const email = `e2e+${info.project.name}-${browserName}@example.com`;

    await test.step("dates and guests", async () => {
      await page.goto(`/reserve/three-bedroom?arrive=${ARRIVE}&depart=${DEPART}&adults=2&children=4`);
      await visibleButton(page, "Continue").click();
      await page.waitForURL(/\/reserve\/three-bedroom\/amenities/);
    });

    await test.step("one amenity", async () => {
      await page.getByRole("button", { name: /^Add airport transfer/i }).click();
      await expect(page).toHaveURL(/am=/);
      await visibleButton(page, "Continue").click();
      await page.waitForURL(/\/reserve\/three-bedroom\/details/);
    });

    await test.step("details", async () => {
      await page.getByLabel("Full name").fill("E2E Guest");
      await page.getByLabel("Mobile number (WhatsApp)").fill("+92 300 1234567");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Expected arrival time").selectOption({ index: 1 });
      await page.getByRole("checkbox", { name: /house rules/i }).check();
      await visibleButton(page, "Continue to review").click();
      await page.waitForURL(/\/reserve\/three-bedroom\/review/);
    });

    await test.step("review and reserve", async () => {
      await expect(page.getByText("Review your reservation").filter({ visible: true }).first()).toBeVisible();
      await visibleButton(page, "Reserve and continue to payment").click();
      await page.waitForURL(/\/reservation\/CRA-\d{4}-\d{4}\/pay\?t=/);
      const url = new URL(page.url());
      reference = url.pathname.split("/")[2];
      token = url.searchParams.get("t") ?? "";
      expect(reference).toMatch(/^CRA-\d{4}-\d{4}$/);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    await test.step("payment page: the Meezan Bank card and the reference", async () => {
      await expect(page.getByText("Meezan Bank Limited").first()).toBeVisible();
      await expect(page.getByText(reference).first()).toBeVisible();
      const [row] = await db()<{ status: string; adults: number; children: number; amenities: number }[]>`
        select r.status, r.adults, r.children,
          (select count(*)::int from reservation_amenities a where a.reservation_id = r.id) as amenities
        from reservations r where r.reference = ${reference}`;
      expect(row).toEqual({ status: "reserved", adults: 2, children: 4, amenities: 1 });
    });

    await test.step("upload a PNG receipt", async () => {
      await page.locator('input[type="file"]').first().setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG_1X1 });
      await expect(page.getByText("Receipt received").first()).toBeVisible();
      await expect
        .poll(async () => (await db()<{ status: string }[]>`select status from reservations where reference = ${reference}`)[0].status)
        .toBe("payment_submitted");
    });
  });

  test("the owner verifies the receipt; the status page and the voucher show the stay confirmed", async ({ page }) => {
    test.skip(!ADMIN_PASSWORD, "Set LOCAL_ADMIN_PASSWORD (development sign-in) to run the admin steps.");
    expect(reference, "the reservation from the previous test").not.toBe("");
    const [r] = await db()<{ id: string }[]>`select id from reservations where reference = ${reference}`;

    await test.step("sign in", async () => {
      await page.goto("/admin/login");
      await page.getByLabel("Email").fill(ADMIN_EMAIL);
      await page.getByLabel("Password").fill(ADMIN_PASSWORD!);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      // Signed in (the console), or sent back to the form with an error code.
      await page.waitForURL((u) => u.pathname.startsWith("/admin") && (!u.pathname.startsWith("/admin/login") || u.searchParams.has("error")));
      expect(
        new URL(page.url()).searchParams.get("error"),
        "Admin sign-in was refused. After five attempts in 15 minutes the console says 'rate': restart the server (the counter is in memory) or wait.",
      ).toBeNull();
    });

    await test.step("verify and confirm", async () => {
      await page.goto(`/admin/reservations/${r.id}`);
      await expect(page.getByText(reference).first()).toBeVisible();
      await page.getByRole("button", { name: "Verify and confirm" }).click();
      await expect
        .poll(async () => (await db()<{ status: string }[]>`select status from reservations where id = ${r.id}`)[0].status)
        .toBe("confirmed");
    });

    await test.step("the guest's status page", async () => {
      await page.goto(`/reservation/${reference}?t=${token}`);
      await expect(page.getByRole("heading", { level: 1, name: "Your stay is confirmed." })).toBeVisible();
      // The status in words beside the reference ("CRA-2611-0042 · confirmed").
      await expect(page.getByText(new RegExp(`${reference}\\s*·\\s*confirmed`, "i")).first()).toBeVisible();
    });

    await test.step("the voucher", async () => {
      await page.goto(`/reservation/${reference}/voucher?t=${token}`);
      await expect(page.getByText(reference).first()).toBeVisible();
      await expect(page.getByText("Three-Bedroom Apartment with Lounge").first()).toBeVisible();
    });
  });

  test("the same dates again: not available, with the nearest free stay", async ({ page }) => {
    // Every active three-bedroom unit must be taken for these nights; extra units (if the owner added some) are blocked.
    const typeId = await threeBedroomId();
    await db()`
      insert into unit_blocks (unit_id, starts_on, ends_on, reason, note)
      select u.id, ${ARRIVE}::date, ${DEPART}::date, 'other', 'e2e' from units u
      where u.apartment_type_id = ${typeId} and u.active and unit_is_free(u.id, ${ARRIVE}::date, ${DEPART}::date)`;

    await page.goto(`/availability?arrive=${ARRIVE}&depart=${DEPART}&adults=2&children=4`);
    await expect(page.getByText("Not available for these dates.").first()).toBeVisible();
    await expect(page.getByText(/^Free from [A-Z][a-z]+day \d{1,2} [A-Z][a-z]+( \d{4})?\.$/).first()).toBeVisible();
  });
});

test.describe("refusals and states", () => {
  test.beforeAll(async () => {
    if (sql) await db()`delete from reservations where guest_email like 'e2e+hold%@example.com'`;
  });

  test("a party of nine is refused with the exact message", async ({ page }) => {
    const depart = addDays(BIG_PARTY_ARRIVE, 3);
    await page.goto(`/availability?arrive=${BIG_PARTY_ARRIVE}&depart=${depart}&adults=5&children=4`);
    await expect(page.getByText(PARTY_TOO_LARGE, { exact: true }).first()).toBeVisible();

    await page.goto(`/reserve/three-bedroom?arrive=${BIG_PARTY_ARRIVE}&depart=${depart}&adults=5&children=4`);
    await expect(page.getByText(PARTY_TOO_LARGE, { exact: true }).first()).toBeVisible();
  });

  test("an expired hold shows 'Hold ended' and the link to reserve again", async ({ page }, info) => {
    const typeId = await threeBedroomId();
    const depart = addDays(HOLD_ARRIVE, 2);
    const payload = {
      apartment_type_id: typeId,
      check_in: HOLD_ARRIVE,
      check_out: depart,
      adults: 2,
      children: 0,
      guest_name: "E2E Hold Guest",
      guest_phone: "+923001234567",
      guest_email: `e2e+hold-${info.project.name}@example.com`,
      arrival_time: "",
      requests: "",
      nightly_rate: 25000,
      nights: 2,
      subtotal_nights: 50000,
      extra_adults: 0,
      extra_adults_amount: 0,
      amenities_amount: 0,
      tax_rate_percent: null,
      tax_label: "",
      tax_amount: 0,
      total: 50000,
      amount_due: 50000,
      amenities: [],
    };
    const [{ r }] = await db()<{ r: { ok: boolean; id: string; reference: string; access_token: string; error?: string } }[]>`
      select create_reservation(${db().json(payload)}) as r`;
    expect(r.ok, `create_reservation: ${r.error ?? ""}`).toBe(true);

    // The hold runs out; expire just this one, the way the cron does.
    await db()`update reservations set hold_expires_at = now() - interval '1 minute' where id = ${r.id}`;
    await db()`select transition_reservation(${r.id}, 'expired', 'system', null, '{}'::jsonb)`;

    await page.goto(`/reservation/${r.reference}?t=${r.access_token}`);
    await expect(page.getByText("Hold ended", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Your hold has ended. The dates may still be free; reserve again to hold them.").first()).toBeVisible();
    const again = page.getByRole("link", { name: "Reserve again" }).first();
    await expect(again).toBeVisible();
    await expect(again).toHaveAttribute(
      "href",
      `/reserve/three-bedroom?arrive=${HOLD_ARRIVE}&depart=${depart}&adults=2&children=0`,
    );
  });

  test("the two-bedroom offers 'Ask on WhatsApp' instead of online reservation", async ({ page }) => {
    await page.goto("/apartments/two-bedroom");
    await expect(page.getByText("Ask on WhatsApp").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Reserve this stay" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reserve this stay" })).toHaveCount(0);
  });

  test("each apartment page carries its stone", async ({ page }) => {
    await page.goto("/apartments/three-bedroom");
    await expect(page.locator("main[data-stone]")).toHaveAttribute("data-stone", "lapis");
    await page.goto("/apartments/two-bedroom");
    await expect(page.locator("main[data-stone]")).toHaveAttribute("data-stone", "jade");
  });
});
