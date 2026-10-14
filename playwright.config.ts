import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, defineConfig, devices } from "@playwright/test";

// End-to-end tests (`npm run test:e2e`) against a server that is already running at E2E_BASE_URL
// (default http://localhost:3100), with the same database in DATABASE_URL (the tests prepare and tidy their own rows
// through it). Admin steps sign in with LOCAL_ADMIN_PASSWORD (development sign-in). Values not set in the shell are
// read from .env.local / .env. Turnstile must be off (no keys, development) or use Cloudflare's test keys.

for (const name of [".env.local", ".env"]) {
  const file = path.join(__dirname, name);
  // Never overrides a variable already set in the shell.
  if (existsSync(file)) process.loadEnvFile(file);
}

/** Playwright's own Chromium when installed; otherwise a preinstalled one (PW_CHROMIUM_PATH or /opt/pw-browsers). */
function chromiumPath(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  if (existsSync(chromium.executablePath())) return undefined;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const found = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
    .map((d) => path.join(root, d, "chrome-linux", "chrome"))
    .find((p) => existsSync(p));
  return found;
}

const executablePath = chromiumPath();

export default defineConfig({
  testDir: "e2e",
  // The scenarios share one database and the same nights: one at a time, desktop then mobile.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3100",
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
