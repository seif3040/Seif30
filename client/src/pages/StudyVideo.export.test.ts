import { describe, expect, it } from "vitest";
import {
  BLOCK_SECONDS,
  BREAK_SECONDS,
  calculateActiveNow,
  calculateBreakRemaining,
  formatVideoNotesText,
} from "./StudyVideo";

describe("formatVideoNotesText", () => {
  it("includes the video URL, watch metrics, Arabic note content, and timestamp", () => {
    const text = formatVideoNotesText({
      id: 7,
      videoUrl: "https://www.youtube.com/watch?v=abc1234",
      activeSeconds: 3723,
      completedBlocks: 2,
      phase: "completed",
      updatedAt: new Date("2026-08-18T00:00:00.000Z"),
      notes: [{ id: 1, title: "قانون مهم", content: "راجع هذه النقطة قبل الامتحان", timestampSeconds: 95, updatedAt: new Date("2026-08-18T00:00:00.000Z") }],
    });

    expect(text).toContain("https://www.youtube.com/watch?v=abc1234");
    expect(text).toContain("01:02:03");
    expect(text).toContain("قانون مهم");
    expect(text).toContain("راجع هذه النقطة قبل الامتحان");
    expect(text).toContain("عند 00:01:35");
  });
});

describe("Study Video Timer & Break Cycle (45m study / 15m break)", () => {
  it("enforces 45 minutes study blocks and 15 minutes breaks", () => {
    expect(BLOCK_SECONDS).toBe(45 * 60); // 2700s
    expect(BREAK_SECONDS).toBe(15 * 60); // 900s
  });

  it("calculates live active seconds when running and holds during pause or break", () => {
    const baseTime = 1000000;
    const runningSession = {
      phase: "watching",
      timerRunning: true,
      activeSeconds: 2600,
      lastPlaybackAt: new Date(baseTime),
    };

    // 50 seconds later
    const activeAt50s = calculateActiveNow(runningSession, baseTime + 50 * 1000);
    expect(activeAt50s).toBe(2650);

    // During break phase, activeSeconds remains frozen
    const breakSession = {
      phase: "break",
      timerRunning: false,
      activeSeconds: 2700,
      lastPlaybackAt: null,
    };
    expect(calculateActiveNow(breakSession, baseTime + 60 * 1000)).toBe(2700);
  });

  it("calculates remaining break countdown accurately until 0", () => {
    const now = Date.now();
    const breakEndsAt = new Date(now + 900 * 1000); // 15 minutes ahead

    // Initial 15 minutes
    expect(calculateBreakRemaining(breakEndsAt, now)).toBe(900);

    // 5 minutes later -> 10 minutes remaining (600s)
    expect(calculateBreakRemaining(breakEndsAt, now + 300 * 1000)).toBe(600);

    // 15 minutes later -> 0 seconds remaining
    expect(calculateBreakRemaining(breakEndsAt, now + 900 * 1000)).toBe(0);

    // Past the break time -> clamps to 0
    expect(calculateBreakRemaining(breakEndsAt, now + 1000 * 1000)).toBe(0);

    // Fallback if breakEndsAt is missing
    expect(calculateBreakRemaining(null, now)).toBe(900);
  });
});
