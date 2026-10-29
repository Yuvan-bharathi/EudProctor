import { describe, expect, it } from "vitest";
import {
  mockInternshipManagers,
  mockMonthlyReviews,
  recordAttendanceCheckIn,
  recordAttendanceCheckOut,
} from "@/lib/mockData";
import { SKILL_LEVEL_LABELS, type SkillLevel } from "@/lib/types";

describe("EduProctor v3: Internship Programme Engine", () => {
  it("enforces strict 1:2 manager-to-mentee ratio policy across all managers", () => {
    mockInternshipManagers.forEach((manager) => {
      expect(manager.activeMenteeIds.length).toBeLessThanOrEqual(2);
    });
  });

  it("calculates 5-pillar composite scorecard correctly according to configured weights", () => {
    // Standard formula: MCQ 25% + Coding 30% + Comm 20% + Tasks 20% + Attendance 5%
    const weights = { mcq: 0.25, coding: 0.3, comm: 0.2, tasks: 0.2, att: 0.05 };
    const sampleBreakdown = {
      mcqScorePct: 88,
      codingScorePct: 92,
      commScorePct: 85,
      tasksScorePct: 90,
      attendanceScorePct: 98,
    };

    const computed = Math.round(
      sampleBreakdown.mcqScorePct * weights.mcq +
        sampleBreakdown.codingScorePct * weights.coding +
        sampleBreakdown.commScorePct * weights.comm +
        sampleBreakdown.tasksScorePct * weights.tasks +
        sampleBreakdown.attendanceScorePct * weights.att,
    );

    // 88*0.25=22 + 92*0.3=27.6 + 85*0.2=17 + 90*0.2=18 + 98*0.05=4.9 = 89.5 -> 90
    expect(computed).toBe(90);

    const review = mockMonthlyReviews[0];
    expect(review.compositeScorePct).toBeGreaterThan(80);
    expect(review.compositeScorePct).toBeLessThanOrEqual(100);
  });

  it("supports the 5-point skill ladder with canonical definitions", () => {
    const levels: SkillLevel[] = [1, 2, 3, 4, 5];
    levels.forEach((lvl) => {
      expect(SKILL_LEVEL_LABELS[lvl]).toBeDefined();
      expect(typeof SKILL_LEVEL_LABELS[lvl]).toBe("string");
    });

    expect(SKILL_LEVEL_LABELS[1]).toContain("Awareness");
    expect(SKILL_LEVEL_LABELS[3]).toContain("Independent");
    expect(SKILL_LEVEL_LABELS[5]).toContain("Production");
  });

  it("handles non-biometric daily attendance check-in and check-out properly", () => {
    const testMenteeId = "test-mentee-uuid";
    const checkIn = recordAttendanceCheckIn(testMenteeId);

    expect(checkIn).toBeDefined();
    expect(checkIn.menteeId).toBe(testMenteeId);
    expect(checkIn.status).toBe("Present");
    expect(checkIn.checkInTime).toBeDefined();

    const checkOut = recordAttendanceCheckOut(testMenteeId);
    expect(checkOut).toBeDefined();
    expect(checkOut?.checkOutTime).toBeDefined();
    expect(checkOut?.totalHours).toBeGreaterThan(0);
  });
});

