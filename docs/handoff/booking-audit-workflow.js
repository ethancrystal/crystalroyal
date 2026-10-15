export const meta = {
  name: 'booking-audit-and-fix',
  description: 'Audit, test and fix every area of the Crystal Royal booking flow, then adversarially review the combined diff',
  phases: [
    { title: 'Audit and fix', detail: '6 area owners: find real bugs, add tests, fix within owned files' },
    { title: 'Integrate', detail: 'one reviewer checks the combined diff, runs tsc/vitest/build' },
  ],
}

const COMMON = `
You are working in the Next.js 15 + Supabase booking site in the current directory (a git worktree; do NOT cd elsewhere).
Read README.md, docs/BOOKING-SITE-BRIEF.md (the product spec) and ARCHITECTURE.md if present before judging behaviour.
No local Postgres or Docker exists, so tests/db and e2e cannot run; review SQL in supabase/migrations by reading it, and
run only: npx tsc --noEmit  and  npx vitest run  (unit tests, ~10 s). Use NODE_ENV=production for any next build.

YOUR JOB for your area: (1) read every file in it carefully, end to end; (2) hunt real bugs: wrong dates/time zones
(property is Asia/Karachi), off-by-one nights, price/tax/extra-adult/min-stay mistakes, double-booking or race
conditions, wrong status transitions, missing server-side validation or authorization, token/URL leaks, unhandled
errors that show the generic error page, broken edge cases (empty, past dates, same-day, huge party, unicode names),
accessibility problems in forms, mobile layout bugs, copy that contradicts the brief; (3) for each CONFIRMED bug,
write a failing vitest test first when the logic is unit-testable (new file under tests/unit/ named for your area, e.g.
tests/unit/<area>-audit.test.ts, so you never collide with other agents), then fix it with the smallest change;
(4) run tsc and vitest and make them pass.

RULES: Only EDIT files in your owned paths (listed below) plus your own new test file. If you find a bug in a file you do
not own, do NOT edit it: report it under crossArea with file, line and the exact fix. Do not refactor, rename, reformat,
or change behaviour the brief specifies. Do not touch .env files, package.json/lock files, Vercel or Supabase (no network
writes, no remote database, no deploys). Do not commit or push; leave changes in the working tree. Do not invent bugs:
a finding needs a concrete trace (file:line, input, wrong output). If something is a judgement call, put it in
needsOwnerDecision instead of changing it. Bracketed [placeholders] and "Sample photo" tags are intentional.
Return the structured result only.`

const RESULT = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    fixed: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, bug: { type: 'string' }, fix: { type: 'string' }, test: { type: 'string' } }, required: ['file', 'bug', 'fix'] } },
    crossArea: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'number' }, bug: { type: 'string' }, suggestedFix: { type: 'string' } }, required: ['file', 'bug', 'suggestedFix'] } },
    needsOwnerDecision: { type: 'array', items: { type: 'string' } },
    checked: { type: 'array', items: { type: 'string' } },
    testsAdded: { type: 'array', items: { type: 'string' } },
    tscAndVitestPass: { type: 'boolean' },
  },
  required: ['area', 'fixed', 'crossArea', 'needsOwnerDecision', 'checked', 'tscAndVitestPass'],
}

const AREAS = [
  {
    key: 'availability-pricing',
    owns: 'src/lib/{availability,dates,money,pricing,quote}.ts, src/lib/db/availability-queries.ts, src/app/availability/**, src/app/api/availability/**, src/components/{calendar,calendar-logic,price-summary,rates-band,stay-card}.ts(x), src/components/home/availability-bar.tsx, src/components/apartment/rate-ladder.tsx, existing tests it touches (tests/pricing.test.ts, tests/unit/{quote,dates,money}.test.ts, tests/components-logic.test.ts)',
    focus: 'Availability search, nightly rate and extra-adult maths, taxes, min stay, the calendar (past dates, unavailable, range selection, keyboard), the availability page and its API route, Karachi-time date handling. Verify the occupancy and rates wording the brief says must appear verbatim.',
  },
  {
    key: 'reserve-flow',
    owns: 'src/app/reserve/**, src/components/reserve/**, src/lib/{draft,validation,protect}.ts, src/components/turnstile.tsx, src/components/stepper.tsx',
    focus: 'The guest reserve flow: dates step, amenities step, details step, review, the server actions (create reservation), draft cookie signing/expiry/tampering, zod validation, Turnstile and rate limiting, double-submit, back/forward navigation, deep links with bad slugs or missing draft, what happens when dates became unavailable between steps.',
  },
  {
    key: 'payment-receipts',
    owns: 'src/app/reservation/[reference]/pay/**, src/app/api/admin/receipt/**, src/components/reservation/{bank-card,upload-zone,hold-line,what-next}.tsx, src/lib/{storage,storage-retention}.ts, tests/unit/storage.test.ts',
    focus: 'Payment page and receipt upload: file type/size validation (server side, magic bytes), private bucket access, signed URL handling, retention, hold countdown and expiry display, bank details and copy buttons, the WhatsApp link, upload states (idle, uploading, done, rejected), what happens after the hold ends.',
  },
  {
    key: 'guest-reservation',
    owns: 'src/app/reservation/[reference]/{actions.ts,page.tsx,layout.tsx,not-found.tsx,voucher/**,calendar.ics/**}, src/components/reservation/{cancel-request,confirmed-hero,format,link-not-valid,load,notice,print-button,shell,summary,timeline,voucher}.ts(x), src/lib/{security,status,notify}.ts, tests/unit/security.test.ts',
    focus: 'The guest status page by reference + access token: token comparison (constant time), enumeration resistance, noindex/no-referrer, status wording for every status, cancel request, voucher printing, the .ics file (RFC 5545 correctness, time zones, escaping, line folding, UID stability), what is shown in each state, links that no longer work.',
  },
  {
    key: 'admin-console',
    owns: 'src/app/admin/**, src/components/admin/**, src/lib/admin-auth.ts, src/lib/db/admin-queries.ts',
    focus: 'The admin console: login (rate limiting, session cookie flags, local-dev password only in development), authorization on EVERY server action and route (a missing check is a critical bug), reservation list filters and pagination, reservation detail actions (verify payment, confirm, cancel, check in/out, status transitions allowed/forbidden), new manual reservation, calendar blocks, rates with effective dates, units, amenities, bank details review step, CSV export (formula injection), email previews.',
  },
  {
    key: 'holds-cron-db-emails',
    owns: 'supabase/migrations/** (read; edit ONLY by adding a NEW migration file with a later timestamp if a schema/function bug is confirmed, never edit the two existing ones), src/app/api/cron/**, src/lib/emails.ts, src/lib/db/{queries,sql}.ts, tests/unit/{emails,cron-auth}.test.ts, tests/db/**.test.ts (read-only, cannot run)',
    focus: 'Reservation creation and double-booking protection in SQL (exclusion constraints, advisory locks, transaction boundaries, the create_reservation function), hold expiry and release, the status machine and its guards, RLS: no guest data exposed to anon, cron authorization (Bearer CRON_SECRET, timing-safe compare, fails closed when unset), idempotent cron runs, the nine email templates (subjects match the brief, no unescaped user input in HTML, reference + status link + WhatsApp number present).',
  },
]

phase('Audit and fix')
const results = await parallel(
  AREAS.map((a) => () =>
    agent(
      `${COMMON}\n\nAREA: ${a.key}\nOWNED PATHS: ${a.owns}\nFOCUS: ${a.focus}`,
      { label: `audit:${a.key}`, phase: 'Audit and fix', schema: RESULT },
    ),
  ),
)
const done = results.filter(Boolean)
log(`${done.length}/${AREAS.length} area owners finished; ${done.reduce((n, r) => n + r.fixed.length, 0)} fixes, ${done.reduce((n, r) => n + r.crossArea.length, 0)} cross-area reports`)

phase('Integrate')
const integration = await agent(
  `You are the integration reviewer for a booking-site audit. Six area owners just edited the working tree in the current
directory (git worktree, branch claude/booking-audit-fixes) in parallel, each limited to their own files. Their reports:

${JSON.stringify(done, null, 1)}

DO THIS:
1. Run: git status --short && git diff --stat, then read the FULL diff (git diff, and new untracked files). Judge each
   change adversarially: is the bug real (re-derive it yourself from the code), is the fix correct and minimal, does it
   change behaviour the brief (docs/BOOKING-SITE-BRIEF.md) specifies, does it break another area or a caller? Revert
   (git checkout -- <file> or edit back) any change that is wrong, speculative, a refactor, or unrelated. Delete tests that
   assert wrong behaviour.
2. Apply the crossArea suggested fixes that are confirmed real by your own reading, with the smallest edit. Skip the rest.
3. Run npx tsc --noEmit, npx vitest run, and NODE_ENV=production npm run build. Fix whatever fails until all three pass.
4. Do not commit or push. Do not touch .env, package.json, lock files, Vercel or Supabase.
Return structured data only.`,
  {
    label: 'integration-review',
    phase: 'Integrate',
    schema: {
      type: 'object',
      properties: {
        kept: { type: 'array', items: { type: 'string' } },
        reverted: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, why: { type: 'string' } }, required: ['what', 'why'] } },
        crossAreaApplied: { type: 'array', items: { type: 'string' } },
        tscPass: { type: 'boolean' },
        vitestPass: { type: 'boolean' },
        buildPass: { type: 'boolean' },
        testCount: { type: 'number' },
        remainingRisks: { type: 'array', items: { type: 'string' } },
      },
      required: ['kept', 'reverted', 'tscPass', 'vitestPass', 'buildPass', 'remainingRisks'],
    },
  },
)

return {
  ownerDecisions: done.flatMap((r) => r.needsOwnerDecision.map((d) => `[${r.area}] ${d}`)),
  checkedByArea: Object.fromEntries(done.map((r) => [r.area, r.checked])),
  integration,
}