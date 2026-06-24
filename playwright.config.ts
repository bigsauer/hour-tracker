import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.test") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const hasE2eCreds =
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.E2E_TEST_EMAIL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  globalSetup: hasE2eCreds ? "./e2e/global-setup.ts" : undefined,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    storageState: hasE2eCreds ? "e2e/.auth/user.json" : undefined,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: hasE2eCreds
    ? [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
    : [
        {
          name: "skipped",
          testMatch: "nothing.spec.ts",
        },
      ],
});
