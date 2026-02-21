/**
 * Unit tests for government-role-mapper pure functions
 */

import { describe, it, expect } from "vitest";
import {
  mapPersonToPositionToGovernmentRole,
  MINISTER_POSITION_IDS,
  MINISTER_POSITION_LABELS,
  type RawPersonToPosition,
} from "../mappers/government-role-mapper.js";

const BASE_RAW: RawPersonToPosition = {
  PersonToPositionID: 30679,
  PersonID: 965,
  PositionID: 45,
  KnessetNum: 25,
  StartDate: "2022-12-29T00:00:00",
  FinishDate: null,
  GovMinistryID: 568,
  GovMinistryName: "משרד ראש הממשלה",
  DutyDesc: "ראש הממשלה",
  FactionID: null,
  FactionName: null,
  GovernmentNum: 37,
  CommitteeID: null,
  CommitteeName: null,
  IsCurrent: true,
  LastUpdatedDate: "2023-01-19T17:47:09.477",
};

// ──────────────────────────────────────────────────────────────────
// MINISTER_POSITION_IDS
// ──────────────────────────────────────────────────────────────────

describe("MINISTER_POSITION_IDS", () => {
  it("includes PM position (45)", () => {
    expect(MINISTER_POSITION_IDS).toContain(45);
  });

  it("includes male minister position (39)", () => {
    expect(MINISTER_POSITION_IDS).toContain(39);
  });

  it("includes female minister position (57)", () => {
    expect(MINISTER_POSITION_IDS).toContain(57);
  });

  it("includes deputy minister (40)", () => {
    expect(MINISTER_POSITION_IDS).toContain(40);
  });
});

// ──────────────────────────────────────────────────────────────────
// MINISTER_POSITION_LABELS
// ──────────────────────────────────────────────────────────────────

describe("MINISTER_POSITION_LABELS", () => {
  it("maps PM position (45) to ראש הממשלה", () => {
    expect(MINISTER_POSITION_LABELS[45]).toBe("ראש הממשלה");
  });

  it("maps minister (39) to שר", () => {
    expect(MINISTER_POSITION_LABELS[39]).toBe("שר");
  });

  it("maps female minister (57) to שרה", () => {
    expect(MINISTER_POSITION_LABELS[57]).toBe("שרה");
  });

  it("maps deputy minister (40) to סגן שר", () => {
    expect(MINISTER_POSITION_LABELS[40]).toBe("סגן שר");
  });
});

// ──────────────────────────────────────────────────────────────────
// mapPersonToPositionToGovernmentRole
// ──────────────────────────────────────────────────────────────────

describe("mapPersonToPositionToGovernmentRole", () => {
  const FAKE_MK_DB_ID = "cuid_mk_123";

  it("maps PM record correctly", () => {
    const result = mapPersonToPositionToGovernmentRole(BASE_RAW, FAKE_MK_DB_ID);

    expect(result.external_id).toBe("30679");
    expect(result.external_source).toBe("knesset_odata");
    expect(result.mk_id).toBe(FAKE_MK_DB_ID);
    expect(result.position_id).toBe(45);
    expect(result.position_label).toBe("ראש הממשלה");
    expect(result.gov_ministry_id).toBe(568);
    expect(result.ministry_name).toBe("משרד ראש הממשלה");
    expect(result.duty_desc).toBe("ראש הממשלה");
    expect(result.government_num).toBe(37);
    expect(result.knesset_num).toBe(25);
    expect(result.is_current).toBe(true);
  });

  it("sets start_date from StartDate", () => {
    const result = mapPersonToPositionToGovernmentRole(BASE_RAW, FAKE_MK_DB_ID);
    expect(result.start_date).toBeInstanceOf(Date);
    expect((result.start_date as Date).getFullYear()).toBe(2022);
  });

  it("sets end_date to null when FinishDate is null", () => {
    const result = mapPersonToPositionToGovernmentRole(BASE_RAW, FAKE_MK_DB_ID);
    expect(result.end_date).toBeNull();
  });

  it("sets end_date when FinishDate is provided", () => {
    const raw = { ...BASE_RAW, FinishDate: "2023-12-31T00:00:00", IsCurrent: false };
    const result = mapPersonToPositionToGovernmentRole(raw, FAKE_MK_DB_ID);
    expect(result.end_date).toBeInstanceOf(Date);
    expect((result.end_date as Date).getFullYear()).toBe(2023);
    expect(result.is_current).toBe(false);
  });

  it("handles null GovMinistryID gracefully", () => {
    const raw = { ...BASE_RAW, GovMinistryID: null, GovMinistryName: null };
    const result = mapPersonToPositionToGovernmentRole(raw, FAKE_MK_DB_ID);
    expect(result.gov_ministry_id).toBeNull();
    expect(result.ministry_name).toBeNull();
  });

  it("uses fallback label for unknown PositionID", () => {
    const raw = { ...BASE_RAW, PositionID: 9999 };
    const result = mapPersonToPositionToGovernmentRole(raw, FAKE_MK_DB_ID);
    expect(result.position_label).toBe("תפקיד 9999");
  });

  it("maps female minister (PositionID=57) correctly", () => {
    const raw: RawPersonToPosition = {
      ...BASE_RAW,
      PersonToPositionID: 99001,
      PersonID: 12345,
      PositionID: 57,
      GovMinistryID: 1004,
      GovMinistryName: "משרד החינוך",
      DutyDesc: "שרת החינוך",
    };
    const result = mapPersonToPositionToGovernmentRole(raw, FAKE_MK_DB_ID);
    expect(result.position_label).toBe("שרה");
    expect(result.ministry_name).toBe("משרד החינוך");
  });

  it("sets source_url based on external_id", () => {
    const result = mapPersonToPositionToGovernmentRole(BASE_RAW, FAKE_MK_DB_ID);
    expect(result.source_url).toContain("30679");
    expect(result.source_url).toContain("KNS_PersonToPosition");
  });

  it("sets last_seen_at to current datetime", () => {
    const before = new Date();
    const result = mapPersonToPositionToGovernmentRole(BASE_RAW, FAKE_MK_DB_ID);
    const after = new Date();
    const lastSeen = result.last_seen_at as Date;
    expect(lastSeen.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(lastSeen.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
