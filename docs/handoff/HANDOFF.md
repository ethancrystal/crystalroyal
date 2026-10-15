# Handoff: booking audit (paused 2026-10-15, to be continued on Kali Linux)

Repo `ethancrystal/crystalroyal`. Work branch: `claude/booking-audit-fixes` (cut from base `claude/ecstatic-albattani-o6826l`
at the merge of PR #1). Nothing on this branch changes app code yet: the audit was stopped before any agent finished.

## Where things stand

| Item | State |
|---|---|
| PR #1 (photos on home, cards, galleries) | Merged into `claude/ecstatic-albattani-o6826l`. |
| Booking audit (6 area agents + 1 integration reviewer) | **Stopped, nothing applied.** Re-run it: see below. |
| Live site | https://crystalroyal.vercel.app (Vercel project `crystalroyal`, team `laviezahgmailcoms-projects`). Loads, reads Supabase. |
| Duplicate Vercel project `crystalroyal-n9jx` | Has no env vars; safe to delete (owner's call). |
| Supabase project | `bakjmdhpnbflvjgjpuku` (https://bakjmdhpnbflvjgjpuku.supabase.co). Schema, RLS, `receipts` private bucket all correct. |
| Admin seed | **Done**: `moizj00@gmail.com` ("Moiz Jamil", stored in auth user metadata) is an active row in `public.admins` and exists in `auth.users`/`auth.identities` with no password. Sign-in is the email link at `/admin/login`. |
| Booking logic on the live DB | Verified in a rolled-back transaction: normal booking OK (12 h hold), same nights refused (`not_available`), overlap refused, arrive-on-checkout-day OK, zero nights refused (`bad_dates`). Reservations table left empty. |

## Blocked: Vercel env vars still missing (needs the owner)

Writing to Vercel's secret store was denied by the permission classifier, so these were NOT added. Without the first two,
guest booking and admin sign-in do not work in production:

1. `DRAFT_COOKIE_SECRET`: random string (`openssl rand -hex 32`), Production + Preview, sensitive. The reserve flow throws without it.
2. `SITE_URL`: `https://crystalroyal.vercel.app`, Production. Otherwise admin magic links point to `http://localhost:3000`.
3. `CRON_SECRET`: random string, Production. The hold-expiry cron fails closed without it.
4. Also still unset: `RESEND_API_KEY`, `EMAIL_FROM` (no confirmation emails), `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`, Upstash keys (rate limits fall back to in-memory).
5. Supabase dashboard > Authentication > URL Configuration: Site URL = the live URL, and allow `https://crystalroyal.vercel.app/admin/auth/callback`. Not checkable through the MCP.
6. Several Supabase vars exist for Production only (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), so Preview deploys have no admin sign-in and no receipt storage. Add them to Preview if previews need those.

Env changes only take effect on the next deploy.

## Findings so far (read-only, from the Supabase MCP)

- `anon` holds table grants on every `public` table (Supabase default). RLS with admin-only policies makes this safe today; revoking `anon` grants would be defence in depth. Not applied.
- Advisor notes are INFO/WARN on the archived `legacy_v2` schema only, plus `public.reference_counters` having RLS and no policy (intentional: only SECURITY DEFINER functions touch it).
- The site Supabase connection must use the transaction pooler (`...pooler.supabase.com:6543`); the direct `db.<ref>.supabase.co` host is IPv6-only and fails from Vercel. The owner already fixed `DATABASE_URL`.

## Resume on Kali

```bash
git clone https://github.com/ethancrystal/crystalroyal.git && cd crystalroyal
git fetch origin && git checkout claude/booking-audit-fixes
npm ci
npx tsc --noEmit && npx vitest run        # baseline: 181 tests pass
```

Local database (Kali can run the DB tests and e2e that Windows could not):

```bash
sudo apt install postgresql-16 postgresql-client-16   # or set PGBIN to your postgres bin dir
bash tests/db/pg-up.sh                                # prints the DATABASE_URL to use
export DATABASE_URL=postgres://postgres@127.0.0.1:54329/crtest
npm run test:db                                       # concurrency, constraints, transitions, cron, expire-holds
```

For e2e: create `.env.local` with `DATABASE_URL`, `LOCAL_ADMIN_PASSWORD`, `DRAFT_COOKIE_SECRET` (any dev string), start
`npm run dev -- -p 3100`, then `npx playwright install chromium && npm run test:e2e`.

Note for Windows-origin files: if `git status` shows every file modified on Kali, it is line endings (CRLF). Run
`git config core.autocrlf input` and re-checkout.

### Re-run the audit

The multi-agent audit is saved at `docs/handoff/booking-audit-workflow.js`. In Claude Code on Kali, run the Workflow tool
with that script (`/workflow-authoring` first), or just tell Claude: "run docs/handoff/booking-audit-workflow.js". It has
6 area agents (availability-pricing, reserve-flow, payment-receipts, guest-reservation, admin-console,
holds-cron-db-emails), each limited to its own files and told to write a failing test before each fix, then one
integration reviewer that re-checks every change and runs tsc, vitest and `NODE_ENV=production npm run build`.
With a local Postgres available, add to each agent's instructions that `npm run test:db` and e2e can now run.

Windows-only quirk: this machine's shell exports `NODE_ENV=development`, which breaks `next build` (`<Html>` error on
/404). Always build with `NODE_ENV=production`. Not an issue on a clean Kali shell.

### After the audit

Review the diff, then open a new PR from `claude/booking-audit-fixes` into `claude/ecstatic-albattani-o6826l`.

## Still wanted by the owner

- Real photos of the apartments (bedroom, lounge, kitchen/dining, second bedroom per type) to replace the "Sample photo"
  stock images: edit `INTERIORS` in `src/lib/photos.ts` and drop `sample: true`.
- Bracketed placeholders on the site (`[Neighbourhood]`, `[Street address]`, check-in times, phone, email) come from the
  `settings` row and `src/lib/site.ts`, filled in via the admin console once the owner supplies them.
