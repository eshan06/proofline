import { test, expect } from "@playwright/test";

/**
 * Critical-path smoke tests. These exercise the things a screenshot can't
 * prove on its own: that styles load, the demo session boots, the AI draft
 * loop works, and the refusal/error state appears where it should.
 */

test("health endpoint reports ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.service).toBe("proofline");
});

test("landing renders the hero with styles applied", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /shows its work/i })).toBeVisible();
  // Prove CSS actually loaded: the page background is the dark token, not white.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(7, 9, 15)"); // #07090F
});

test("demo flow: boots a sandbox session into the inbox with the banner", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForURL(/\/inbox\//);
  await expect(page.getByText("Interactive demo")).toBeVisible();
  await expect(page.getByText("Try it yourself")).toBeVisible();
});

test("inbox: accept an AI draft inserts it into the composer", async ({ page }) => {
  await page.goto("/inbox/TKT-1042");
  await expect(page.getByText("AI Copilot")).toBeVisible();
  await expect(page.getByText(/Grounded in 2 sources/)).toBeVisible();

  await page.getByRole("button", { name: "Accept draft" }).click();
  await expect(page.getByText("Inserted ✓")).toBeVisible();

  const composer = page.getByPlaceholder(/Reply to Ava Chen/);
  await expect(composer).toHaveValue(/your payment went through correctly/i);
});

test("inbox: ticket with no grounded source shows the refusal/error state", async ({ page }) => {
  await page.goto("/inbox/TKT-1024");
  await expect(page.getByText("AI draft unavailable")).toBeVisible();
  await expect(page.getByText(/SSO configuration guide\.pdf/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry sync" })).toBeVisible();
});

test("command palette opens with ⌘K and filters", async ({ page }) => {
  await page.goto("/inbox/TKT-1042");
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await page.getByRole("combobox").fill("duplicate");
  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText("Need refund for duplicate charge");
});

test("playground refuses SSO questions (AI never guesses)", async ({ page }) => {
  await page.goto("/copilot");
  await page.getByPlaceholder("Type a fake customer question…").fill("Help me set up SAML SSO with Okta");
  await page.getByRole("button", { name: "Generate draft" }).click();
  await expect(page.getByText(/refuses to guess/i)).toBeVisible({ timeout: 5000 });
});
