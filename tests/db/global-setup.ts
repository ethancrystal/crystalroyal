import { execFileSync } from "node:child_process";
import path from "node:path";
import type { TestProject } from "vitest/node";

// Starts the database tests' own throwaway cluster with tests/db/pg-up.sh (migrations + seed) and stops it afterwards.
// Port and folder: DBTEST_PORT / DBTEST_DIR, default 54330 and /tmp/crystalroyal-pgtest-ops. pg-up.sh wipes its
// folder first, so the development database (54329, /tmp/crystalroyal-pgtest, used by `npm run db:up`) is refused.

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const ROOT = path.resolve(__dirname, "../..");
const PGBIN = process.env.PGBIN ?? "/usr/lib/postgresql/16/bin";
const DEV_PORT = "54329";
const DEV_DIR = "/tmp/crystalroyal-pgtest";

export default async function setup(project: TestProject) {
  const port = process.env.DBTEST_PORT ?? "54330";
  const dir = path.resolve(process.env.DBTEST_DIR ?? "/tmp/crystalroyal-pgtest-ops");
  if (port === DEV_PORT || dir === DEV_DIR) {
    throw new Error(`Refusing to use the development database (${DEV_PORT}, ${DEV_DIR}) for the database tests.`);
  }

  const out = execFileSync("bash", [path.join(ROOT, "tests/db/pg-up.sh")], {
    env: { ...process.env, PGTEST_PORT: port, PGTEST_DIR: dir, PGBIN },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 120_000,
  });
  const url = out.trim().split("\n").filter(Boolean).pop() ?? "";
  if (!/^postgres:\/\//.test(url)) throw new Error(`pg-up.sh did not print a connection URL:\n${out}`);

  // Workers inherit this too, so no test can reach the development database through .env values.
  process.env.DATABASE_URL = url;
  project.provide("databaseUrl", url);

  return () => {
    const asPostgres = process.getuid?.() === 0;
    const cmd = asPostgres ? "runuser" : path.join(PGBIN, "pg_ctl");
    const args = ["-D", path.join(dir, "data"), "-m", "fast", "-w", "stop"];
    try {
      execFileSync(cmd, asPostgres ? ["-u", "postgres", "--", path.join(PGBIN, "pg_ctl"), ...args] : args, {
        stdio: "ignore",
        timeout: 60_000,
      });
    } catch {
      /* already stopped */
    }
  };
}
