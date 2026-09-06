import { describe, expect, it } from "vitest";
import { formatArabicDate, formatShortDate, inputDate, parseDate, shortDate } from "./study";

describe("Study Date Utilities & Safety", () => {
  it("safely parses epoch ms and legacy float timestamp strings", () => {
    const fromFloatStr = parseDate("1786579200000.0");
    expect(fromFloatStr).not.toBeNull();
    expect(fromFloatStr?.toISOString()).toContain("2026-08-13");

    const fromNum = parseDate(1786579200000);
    expect(fromNum?.toISOString()).toContain("2026-08-13");

    const fromIntStr = parseDate("1786579200000");
    expect(fromIntStr?.toISOString()).toContain("2026-08-13");
  });

  it("safely parses YYYY-MM-DD strings and ISO strings", () => {
    const fromYMD = parseDate("2026-09-06");
    expect(fromYMD).not.toBeNull();
    expect(fromYMD?.getFullYear()).toBe(2026);

    const fromISO = parseDate("2026-09-06T12:00:00.000Z");
    expect(fromISO).not.toBeNull();
  });

  it("returns null on invalid values without throwing RangeError", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("not-a-real-date")).toBeNull();
    expect(parseDate(new Date("invalid"))).toBeNull();
  });

  it("shortDate.format never throws RangeError: Invalid time value", () => {
    // Legacy timestamp float string
    expect(() => shortDate.format("1786579200000.0")).not.toThrow();
    expect(shortDate.format("1786579200000.0")).not.toBe("—");

    // Invalid time values
    expect(() => shortDate.format(new Date("invalid"))).not.toThrow();
    expect(shortDate.format(new Date("invalid"))).toBe("—");

    expect(() => shortDate.format("corrupt-date")).not.toThrow();
    expect(shortDate.format("corrupt-date")).toBe("—");

    expect(() => shortDate.format(null)).not.toThrow();
    expect(shortDate.format(null)).toBe("—");
  });

  it("formatShortDate and formatArabicDate handle safe fallbacks", () => {
    expect(formatShortDate("2026-09-06")).not.toBe("—");
    expect(formatArabicDate("2026-09-06")).not.toBe("—");
    expect(formatShortDate("invalid", "غير محدد")).toBe("غير محدد");
  });

  it("inputDate produces standard YYYY-MM-DD or empty string", () => {
    expect(inputDate("1786579200000.0")).toBe("2026-08-13");
    expect(inputDate("2026-09-06")).toBe("2026-09-06");
    expect(inputDate(null)).toBe("");
    expect(inputDate("invalid")).toBe("");
  });
});
