/**
 * Unit tests for aggregate-party-topics scoring pure functions
 */

import { describe, it, expect } from "vitest";
import {
  computeBillPoints,
  applyRoleMultiplier,
  normalizePartyScores,
  type RawAggRow,
} from "../aggregate/aggregate-party-topics.js";

// ──────────────────────────────────────────────────────────────────
// computeBillPoints
// ──────────────────────────────────────────────────────────────────

describe("computeBillPoints", () => {
  it("passed → 5", () => expect(computeBillPoints("passed")).toBe(5));
  it("second_reading → 3", () => expect(computeBillPoints("second_reading")).toBe(3));
  it("third_reading → 3", () => expect(computeBillPoints("third_reading")).toBe(3));
  it("committee_review → 2", () => expect(computeBillPoints("committee_review")).toBe(2));
  it("first_reading → 2", () => expect(computeBillPoints("first_reading")).toBe(2));
  it("submitted → 1", () => expect(computeBillPoints("submitted")).toBe(1));
  it("rejected → 0", () => expect(computeBillPoints("rejected")).toBe(0));
  it("draft → 0", () => expect(computeBillPoints("draft")).toBe(0));
  it("withdrawn → 0", () => expect(computeBillPoints("withdrawn")).toBe(0));
  it("expired → 0", () => expect(computeBillPoints("expired")).toBe(0));
  it("unknown → 0", () => expect(computeBillPoints("unknown")).toBe(0));
  it("arbitrary string → 0", () => expect(computeBillPoints("whatever")).toBe(0));
});

// ──────────────────────────────────────────────────────────────────
// applyRoleMultiplier
// ──────────────────────────────────────────────────────────────────

describe("applyRoleMultiplier", () => {
  it("initiator multiplied by 1.0", () => {
    expect(applyRoleMultiplier(5, "initiator")).toBe(5);
    expect(applyRoleMultiplier(2, "initiator")).toBe(2);
  });

  it("cosponsor multiplied by 0.5", () => {
    expect(applyRoleMultiplier(4, "cosponsor")).toBe(2);
    expect(applyRoleMultiplier(1, "cosponsor")).toBe(0.5);
  });

  it("committee → 0 (not counted)", () => {
    expect(applyRoleMultiplier(5, "committee")).toBe(0);
  });

  it("other → 0 (not counted)", () => {
    expect(applyRoleMultiplier(3, "other")).toBe(0);
    expect(applyRoleMultiplier(10, "anything_else")).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// normalizePartyScores
// ──────────────────────────────────────────────────────────────────

describe("normalizePartyScores", () => {
  const topicKeys = ["economy", "housing"];

  it("normalizes standard case: highest gets 1, lowest gets 0", () => {
    const rows: RawAggRow[] = [
      { party_id: "p1", topic: "economy", raw_score: 10, bill_count: 5 },
      { party_id: "p2", topic: "economy", raw_score: 5, bill_count: 3 },
      { party_id: "p3", topic: "economy", raw_score: 0, bill_count: 0 },
    ];
    const result = normalizePartyScores(rows, topicKeys);
    expect(result.get("p1")?.get("economy")).toBeCloseTo(1.0);
    expect(result.get("p2")?.get("economy")).toBeCloseTo(0.5);
    expect(result.get("p3")?.get("economy")).toBeCloseTo(0.0);
  });

  it("all-zero case: all parties get 0", () => {
    const rows: RawAggRow[] = [
      { party_id: "p1", topic: "housing", raw_score: 0, bill_count: 0 },
      { party_id: "p2", topic: "housing", raw_score: 0, bill_count: 0 },
    ];
    const result = normalizePartyScores(rows, topicKeys);
    expect(result.get("p1")?.get("housing")).toBe(0);
    expect(result.get("p2")?.get("housing")).toBe(0);
  });

  it("all-same-value (non-zero) case: all parties get 1", () => {
    const rows: RawAggRow[] = [
      { party_id: "p1", topic: "economy", raw_score: 7, bill_count: 2 },
      { party_id: "p2", topic: "economy", raw_score: 7, bill_count: 2 },
      { party_id: "p3", topic: "economy", raw_score: 7, bill_count: 2 },
    ];
    const result = normalizePartyScores(rows, topicKeys);
    expect(result.get("p1")?.get("economy")).toBe(1);
    expect(result.get("p2")?.get("economy")).toBe(1);
    expect(result.get("p3")?.get("economy")).toBe(1);
  });

  it("topics not in topicKeys are ignored", () => {
    const rows: RawAggRow[] = [
      { party_id: "p1", topic: "education", raw_score: 10, bill_count: 3 },
    ];
    const result = normalizePartyScores(rows, topicKeys);
    // "education" is not in topicKeys = ["economy", "housing"]
    expect(result.get("p1")).toBeUndefined();
  });

  it("handles multiple topics independently", () => {
    const rows: RawAggRow[] = [
      { party_id: "p1", topic: "economy", raw_score: 10, bill_count: 5 },
      { party_id: "p2", topic: "economy", raw_score: 0, bill_count: 0 },
      { party_id: "p1", topic: "housing", raw_score: 2, bill_count: 1 },
      { party_id: "p2", topic: "housing", raw_score: 8, bill_count: 3 },
    ];
    const result = normalizePartyScores(rows, topicKeys);
    expect(result.get("p1")?.get("economy")).toBeCloseTo(1.0);
    expect(result.get("p2")?.get("economy")).toBeCloseTo(0.0);
    expect(result.get("p1")?.get("housing")).toBeCloseTo(0.0); // min
    expect(result.get("p2")?.get("housing")).toBeCloseTo(1.0); // max
  });
});
