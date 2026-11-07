import { describe, expect, it } from "vitest";
import { formatMonthYear, fullName, initials, timeAgo } from "./utils";

describe("utils", () => {
  it("formats names", () => {
    expect(fullName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(initials({ firstName: "ada", lastName: "lovelace" })).toBe("AL");
  });

  it("formats relative times in each language", () => {
    const now = Date.parse("2026-01-10T12:00:00Z");
    expect(timeAgo("2026-01-10T11:59:30Z", now, "en")).toBe("now");
    expect(timeAgo("2026-01-10T11:00:00Z", now, "en")).toBe("1 hr. ago");
    expect(timeAgo("2026-01-08T12:00:00Z", now, "en")).toBe("2 days ago");
    expect(timeAgo("2026-01-10T11:00:00Z", now, "ru")).toBe("1 ч назад");
    // Uzbek uses our own strings (browser ICU data for uz is unreliable).
    expect(timeAgo("2026-01-10T11:59:50Z", now, "uz")).toBe("hozir");
    expect(timeAgo("2026-01-10T11:17:00Z", now, "uz")).toBe("43 daqiqa oldin");
    expect(timeAgo("2026-01-08T12:00:00Z", now, "uz")).toBe("2 kun oldin");
  });

  it("formats month + year, with our own Uzbek month names", () => {
    expect(formatMonthYear("2026-11-07T12:00:00Z", "en")).toBe("Nov 2026");
    expect(formatMonthYear("2026-11-07T12:00:00Z", "uz")).toBe("noy 2026");
  });
});
