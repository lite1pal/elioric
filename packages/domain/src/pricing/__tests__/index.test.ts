import { describe, expect, it } from "vitest";

import {
  getPricingPlan,
  getUtcMonthWindow,
  summarizePricingUsage
} from "../index";

describe("pricing domain", () => {
  it("looks up plans from the code-defined catalog", () => {
    expect(getPricingPlan("growth")).toEqual({
      id: "growth",
      includedEvents: 1_000_000,
      name: "Growth"
    });
  });

  it("builds UTC calendar month windows", () => {
    expect(getUtcMonthWindow(new Date("2026-06-25T13:45:12.000Z"))).toEqual({
      periodEnd: "2026-07-01T00:00:00.000Z",
      periodStart: "2026-06-01T00:00:00.000Z"
    });
  });

  it("caps remaining events at zero", () => {
    expect(
      summarizePricingUsage({
        now: new Date("2026-06-25T13:45:12.000Z"),
        planId: "starter",
        usedEvents: 100_500
      })
    ).toMatchObject({
      id: "starter",
      includedEvents: 100_000,
      name: "Starter",
      remainingEvents: 0,
      usedEvents: 100_500
    });
  });
});
