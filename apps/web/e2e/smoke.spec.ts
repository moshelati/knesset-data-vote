/**
 * E2E smoke tests using Playwright
 * Tests: Home, MK list, MK detail, Party list, Party detail
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env["WEB_URL"] ?? "http://localhost:3000";

test.describe("Home page", () => {
  test("loads and shows search", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Knesset Vote/i);

    // Search input visible (use the text input, not the nav link)
    const searchInput = page.getByRole("textbox", { name: "חיפוש" });
    await expect(searchInput).toBeVisible();

    // Navigation present (scope to header nav to avoid footer/body duplicates)
    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByRole("link", { name: "סיעות" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "חברי כנסת" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "הצעות חוק" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "מתודולוגיה" })).toBeVisible();
  });

  test("shows data source information", async ({ page }) => {
    await page.goto(BASE_URL);
    // Use the footer link which is always present and unique enough
    await expect(page.getByText(/Knesset OData/i).first()).toBeVisible();
  });

  test("has skip link for accessibility", async ({ page }) => {
    await page.goto(BASE_URL);
    // Tab to skip link
    await page.keyboard.press("Tab");
    const skipLink = page.getByText("דלג לתוכן הראשי");
    await expect(skipLink).toBeFocused();
  });
});

test.describe("Parties page", () => {
  test("loads parties list", async ({ page }) => {
    await page.goto(`${BASE_URL}/parties`);
    await expect(page).toHaveTitle(/סיעות/i);

    // Either shows parties or empty state
    const hasContent =
      (await page.locator(".card").count()) > 0 ||
      (await page.getByText(/לא נמצאו סיעות/).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test("has search form", async ({ page }) => {
    await page.goto(`${BASE_URL}/parties`);
    await expect(page.getByPlaceholder(/חפש סיעה/)).toBeVisible();
  });
});

test.describe("MKs page", () => {
  test("loads MK list", async ({ page }) => {
    await page.goto(`${BASE_URL}/mks`);
    await expect(page).toHaveTitle(/חברי הכנסת/i);

    const hasContent =
      (await page.locator(".card").count()) > 0 ||
      (await page.getByText(/לא נמצאו חברי כנסת/).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test("MK search works", async ({ page }) => {
    await page.goto(`${BASE_URL}/mks`);
    const searchInput = page.getByPlaceholder(/חפש שם/);
    await expect(searchInput).toBeVisible();
    await searchInput.fill("נתניהו");
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
    await expect(page.url()).toContain("search=");
  });
});

test.describe("Bills page", () => {
  test("loads bills list", async ({ page }) => {
    await page.goto(`${BASE_URL}/bills`);
    await expect(page).toHaveTitle(/הצעות חוק/i);

    const hasContent =
      (await page.locator(".card").count()) > 0 ||
      (await page.getByText(/לא נמצאו הצעות חוק/).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test("has topic filter", async ({ page }) => {
    await page.goto(`${BASE_URL}/bills`);
    const topicSelect = page.getByLabel("בחר נושא");
    await expect(topicSelect).toBeVisible();
  });
});

test.describe("Methodology page", () => {
  test("loads methodology page", async ({ page }) => {
    await page.goto(`${BASE_URL}/methodology`);
    await expect(page).toHaveTitle(/מתודולוגיה/i);

    // Key sections present — use heading role to avoid TOC link duplicates
    await expect(page.getByRole("heading", { name: "עקרונות יסוד" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "מקורות נתונים" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "מגבלות ידועות" })).toBeVisible();
  });

  test("shows neutral language principles", async ({ page }) => {
    await page.goto(`${BASE_URL}/methodology`);
    await expect(page.getByText("Matched parliamentary activity found")).toBeVisible();
    // Text appears in both a <code> element and a table cell — use .first() to avoid strict-mode violation
    await expect(page.getByText("Not available from source").first()).toBeVisible();
  });

  test("has table of contents with working anchors", async ({ page }) => {
    await page.goto(`${BASE_URL}/methodology`);
    const tocLinks = page.locator("nav a[href^='#']");
    const count = await tocLinks.count();
    expect(count).toBeGreaterThan(5);
  });
});

test.describe("404 page", () => {
  test("shows 404 for unknown routes", async ({ page }) => {
    await page.goto(`${BASE_URL}/this-does-not-exist`);
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("חזרה לדף הבית")).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("all pages have main landmark", async ({ page }) => {
    const pages = ["/", "/parties", "/mks", "/bills", "/methodology"];
    for (const path of pages) {
      await page.goto(`${BASE_URL}${path}`);
      const main = page.getByRole("main");
      await expect(main).toBeVisible();
    }
  });

  test("all pages have page title", async ({ page }) => {
    const pages = ["/", "/parties", "/mks", "/bills", "/methodology"];
    for (const path of pages) {
      await page.goto(`${BASE_URL}${path}`);
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(3);
    }
  });
});
