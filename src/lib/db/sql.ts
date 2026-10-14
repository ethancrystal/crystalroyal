import "server-only";
import postgres from "postgres";
import { env } from "../env";

// One pooled connection per server instance. All database access is server-side; the connecting role
// bypasses RLS, so every public read goes through the functions in queries.ts, which expose no guest data.

declare global {
  // eslint-disable-next-line no-var
  var __crSql: postgres.Sql | undefined;
}

function connect(): postgres.Sql {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Run `npm run db:up` for a local database, or see README.");
  }
  return postgres(env.databaseUrl, {
    max: env.isProduction ? 5 : 10,
    prepare: false, // required by the Supabase transaction pooler
    idle_timeout: 20,
    types: {
      // Return `date` columns as plain "YYYY-MM-DD" strings, never JS Dates (no time-zone drift).
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      // Instants as ISO strings, so rows are plain serialisable objects.
      timestamptz: {
        to: 1184,
        from: [1184],
        serialize: (x: string | Date) => (x instanceof Date ? x.toISOString() : x),
        parse: (x: string) => new Date(x).toISOString(),
      },
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
}

export function db(): postgres.Sql {
  if (!globalThis.__crSql) globalThis.__crSql = connect();
  return globalThis.__crSql;
}
