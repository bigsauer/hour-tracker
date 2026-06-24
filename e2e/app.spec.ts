import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import {
  clearAllEntries,
  getAdminClient,
  getAnonClient,
  getUserId,
  seedEntry,
} from "./helpers";
import { parseExportWorkbook, verifyXlInvariants } from "../src/lib/export";

test.describe("Time Clock e2e", () => {
  test.beforeEach(async () => {
    await clearAllEntries();
  });

  test("lands on Today view when signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("On the Clock")).toBeVisible();
    await expect(page.getByText("Today", { exact: true })).toBeVisible();
  });

  test("clock in creates open entry in Postgres", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Clock In/ }).click();
    await expect(page.getByText("Running")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clock Out" })).toBeVisible();

    const admin = getAdminClient();
    const { data } = await admin.from("entries").select("*").is("end_at", null);
    expect(data?.length).toBe(1);
  });

  test("clock out sets end_at and shows in today list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Clock In/ }).click();
    await page.getByRole("button", { name: "Clock Out" }).click();
    await expect(page.getByText("Not clocked in")).toBeVisible();
    await expect(page.getByRole("button", { name: /Clock In/ })).toBeVisible();

    const admin = getAdminClient();
    const { data } = await admin.from("entries").select("*");
    expect(data?.length).toBe(1);
    expect(data?.[0].end_at).not.toBeNull();
  });

  test("no double clock-in while running", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Clock In/ }).click();
    await expect(page.getByRole("button", { name: /Clock In/ })).toHaveCount(0);
  });

  test("crash safety: reload restores running shift", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Clock In/ }).click();
    await expect(page.getByText("Running")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Running")).toBeVisible();
  });

  test("stale open shift shows amber banner", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const userId = await getUserId(email);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 0, 0, 0);
    await seedEntry(userId, yesterday.toISOString(), null);

    await page.goto("/");
    await expect(page.getByText(/Open shift since/)).toBeVisible();
    await page.getByText(/Open shift since/).click();

    const endLocal = new Date(yesterday);
    endLocal.setHours(17, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const endStr = `${endLocal.getFullYear()}-${pad(endLocal.getMonth() + 1)}-${pad(endLocal.getDate())}T${pad(endLocal.getHours())}:${pad(endLocal.getMinutes())}`;
    await page.locator('input[type="datetime-local"]').nth(1).fill(endStr);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/Open shift since/)).toHaveCount(0);
  });

  test("rejects end before start on edit", async ({ page }) => {
    await page.goto("/");
    await page.getByText("+ Add entry").click();
    const start = page.locator('input[type="datetime-local"]').first();
    const end = page.locator('input[type="datetime-local"]').nth(1);
    await start.fill("2026-06-20T10:00");
    await end.fill("2026-06-20T09:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("End time has to be after the start time.")).toBeVisible();
  });

  test("add past entry appears on correct day", async ({ page }) => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;

    await page.goto("/");
    await page.getByText("+ Add entry").click();
    await page.locator('input[type="datetime-local"]').first().fill(`${dateStr}T09:00`);
    await page.locator('input[type="datetime-local"]').nth(1).fill(`${dateStr}T10:00`);
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page.getByText("1.00 hrs")).toBeVisible();
  });

  test("delete removes entry", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const userId = await getUserId(email);
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    await seedEntry(userId, start.toISOString(), end.toISOString());

    await page.goto("/");
    await page.getByRole("button", { name: /–/ }).first().click();
    await page.getByRole("button", { name: "Delete" }).click();

    const admin = getAdminClient();
    const { data } = await admin.from("entries").select("id");
    expect(data?.length).toBe(0);
  });

  test("week total matches seeded data", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const userId = await getUserId(email);
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow);
    const start = new Date(monday);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600000);
    await seedEntry(userId, start.toISOString(), end.toISOString());

    await page.goto("/");
    await page.getByRole("button", { name: "week", exact: true }).click();
    await expect(page.getByText("2.00")).toBeVisible();
  });

  test("export passes XL bug check invariants", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const userId = await getUserId(email);
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    const dow = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - dow);
    const start = new Date(monday);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 90 * 60000);
    await seedEntry(userId, start.toISOString(), end.toISOString());

    await page.goto("/");
    await page.getByRole("button", { name: "week", exact: true }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export this week" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error("No download path");

    const buf = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of buf) chunks.push(Buffer.from(chunk));
    const workbook = XLSX.read(Buffer.concat(chunks), { type: "buffer" });
    const rows = parseExportWorkbook(workbook);
    const result = verifyXlInvariants(rows);
    expect(result.ok, result.failures.join("; ")).toBe(true);
  });

  test("RLS blocks second user from reading first user rows", async () => {
    const email = process.env.E2E_TEST_EMAIL!;
    const secondEmail = process.env.E2E_SECOND_EMAIL!;
    const userId = await getUserId(email);
    await seedEntry(userId, new Date().toISOString(), new Date().toISOString());

    const admin = getAdminClient();
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: secondEmail,
    });
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) throw new Error("No token");

    const anon = getAnonClient();
    const { data: sessionData } = await anon.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (!sessionData.session) throw new Error("No second session");

    const secondClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    await secondClient.auth.setSession(sessionData.session);

    const { data, error } = await secondClient.from("entries").select("*");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });
});
