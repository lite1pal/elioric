import { describe, expect, it } from "vitest";

import {
  canAccessSupportTools,
  canPerformSupportLookup,
  getInternalSupportRole,
  isInternalSupportUser
} from "../index";

describe("internal support role helpers", () => {
  it("defaults missing users to no support access", () => {
    expect(getInternalSupportRole(undefined)).toBe("none");
    expect(isInternalSupportUser(undefined)).toBe(false);
    expect(canAccessSupportTools(undefined)).toBe(false);
    expect(canPerformSupportLookup(undefined)).toBe(false);
  });

  it("treats support users as support-capable", () => {
    const user = { internalRole: "support" as const };

    expect(getInternalSupportRole(user)).toBe("support");
    expect(isInternalSupportUser(user)).toBe(true);
    expect(canAccessSupportTools(user)).toBe(true);
    expect(canPerformSupportLookup(user)).toBe(true);
  });

  it("treats admin users as support-capable", () => {
    const user = { internalRole: "admin" as const };

    expect(getInternalSupportRole(user)).toBe("admin");
    expect(isInternalSupportUser(user)).toBe(true);
    expect(canAccessSupportTools(user)).toBe(true);
    expect(canPerformSupportLookup(user)).toBe(true);
  });

  it("treats unknown internal roles as none", () => {
    const user = { internalRole: "customer-success" as never };

    expect(getInternalSupportRole(user)).toBe("none");
    expect(isInternalSupportUser(user)).toBe(false);
    expect(canAccessSupportTools(user)).toBe(false);
    expect(canPerformSupportLookup(user)).toBe(false);
  });
});
