/**
 * Unit tests for knesset-urls helpers.
 * Pure functions — no DOM, no network.
 *
 * Run with: pnpm --filter @knesset-vote/web test:unit
 * (or via the ETL vitest config since web has no vitest setup;
 *  these tests are imported by the ETL test suite via alias below)
 */
import { describe, it, expect } from "vitest";
import {
  mkOfficialUrl,
  billOfficialUrl,
  factionOfficialUrl,
  KNESSET_HOME_URL,
  KNESSET_ODATA_BASE_URL,
} from "../knesset-urls.js";

describe("mkOfficialUrl", () => {
  it("returns the correct deep-link URL for a numeric string externalId", () => {
    expect(mkOfficialUrl("903")).toBe(
      "https://main.knesset.gov.il/mk/apps/mk/mk-personal-details/903",
    );
  });

  it("returns the correct URL for a numeric externalId", () => {
    expect(mkOfficialUrl(1234)).toBe(
      "https://main.knesset.gov.il/mk/apps/mk/mk-personal-details/1234",
    );
  });

  it("returns null for null externalId", () => {
    expect(mkOfficialUrl(null)).toBeNull();
  });

  it("returns null for undefined externalId", () => {
    expect(mkOfficialUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(mkOfficialUrl("")).toBeNull();
  });

  it("returns null for 0 (falsy number)", () => {
    expect(mkOfficialUrl(0)).toBeNull();
  });
});

describe("billOfficialUrl", () => {
  it("returns the correct deep-link for a bill externalId", () => {
    expect(billOfficialUrl("552772")).toBe(
      "https://main.knesset.gov.il/activity/legislation/laws/pages/billdetails.aspx?t=lawsuggestionssearch&lawitemid=552772",
    );
  });

  it("returns null for null", () => {
    expect(billOfficialUrl(null)).toBeNull();
  });
});

describe("factionOfficialUrl", () => {
  it("returns the correct deep-link for a faction externalId", () => {
    expect(factionOfficialUrl("1096")).toBe(
      "https://main.knesset.gov.il/mk/apps/mk/faction-details/1096",
    );
  });

  it("returns null for null", () => {
    expect(factionOfficialUrl(null)).toBeNull();
  });
});

describe("constants", () => {
  it("KNESSET_HOME_URL points to the official site", () => {
    expect(KNESSET_HOME_URL).toBe("https://www.knesset.gov.il");
  });

  it("KNESSET_ODATA_BASE_URL points to the OData endpoint", () => {
    expect(KNESSET_ODATA_BASE_URL).toContain("knesset.gov.il");
    expect(KNESSET_ODATA_BASE_URL).toContain("Odata");
  });
});
