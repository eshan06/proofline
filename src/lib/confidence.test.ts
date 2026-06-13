import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_AMBER,
  CONFIDENCE_GREEN,
  CONFIDENCE_RED,
  confidenceColor,
  confidencePercent,
  isLowConfidence,
} from "./confidence";

describe("confidence color scale", () => {
  it("is green at and above 0.80", () => {
    expect(confidenceColor(0.8)).toBe(CONFIDENCE_GREEN);
    expect(confidenceColor(0.92)).toBe(CONFIDENCE_GREEN);
    expect(confidenceColor(1)).toBe(CONFIDENCE_GREEN);
  });

  it("is amber in 0.65–0.79", () => {
    expect(confidenceColor(0.65)).toBe(CONFIDENCE_AMBER);
    expect(confidenceColor(0.71)).toBe(CONFIDENCE_AMBER);
    expect(confidenceColor(0.799)).toBe(CONFIDENCE_AMBER);
  });

  it("is red below 0.65", () => {
    expect(confidenceColor(0.649)).toBe(CONFIDENCE_RED);
    expect(confidenceColor(0.58)).toBe(CONFIDENCE_RED);
    expect(confidenceColor(0)).toBe(CONFIDENCE_RED);
  });

  it("treats the exact boundaries per spec (0.80 green, 0.65 amber)", () => {
    expect(confidenceColor(0.8)).toBe(CONFIDENCE_GREEN);
    expect(confidenceColor(0.65)).toBe(CONFIDENCE_AMBER);
  });
});

describe("low-confidence flag", () => {
  it("flags drafts below 0.70 (pairs with the warning box)", () => {
    expect(isLowConfidence(0.58)).toBe(true);
    expect(isLowConfidence(0.69)).toBe(true);
    expect(isLowConfidence(0.7)).toBe(false);
    expect(isLowConfidence(0.92)).toBe(false);
  });
});

describe("confidence percent formatting", () => {
  it("rounds to a whole percent", () => {
    expect(confidencePercent(0.92)).toBe("92%");
    expect(confidencePercent(0.584)).toBe("58%");
    expect(confidencePercent(0.965)).toBe("97%");
  });
});
