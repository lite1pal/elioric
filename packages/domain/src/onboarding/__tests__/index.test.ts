import { describe, expect, it } from "vitest";

import {
  isRequiredOnboardingStep,
  summarizeOnboardingProgress
} from "../index";

const auditSteps = [
  {
    id: "project_created",
    required: true
  },
  {
    id: "api_key_created",
    required: true
  },
  {
    id: "first_event_ingested",
    required: true
  },
  {
    id: "member_invited",
    required: false
  }
] as const;

describe("summarizeOnboardingProgress", () => {
  it("counts required progress without treating optional steps as blocking", () => {
    expect(
      summarizeOnboardingProgress({
        completedAtByStep: {
          api_key_created: "2026-06-25T12:01:00.000Z",
          first_event_ingested: "2026-06-25T12:02:00.000Z",
          project_created: "2026-06-25T12:00:00.000Z"
        },
        steps: auditSteps
      })
    ).toEqual({
      completedRequiredSteps: 3,
      dismissedAt: undefined,
      isComplete: true,
      isDismissed: false,
      steps: [
        {
          completedAt: "2026-06-25T12:00:00.000Z",
          id: "project_created",
          required: true,
          status: "complete"
        },
        {
          completedAt: "2026-06-25T12:01:00.000Z",
          id: "api_key_created",
          required: true,
          status: "complete"
        },
        {
          completedAt: "2026-06-25T12:02:00.000Z",
          id: "first_event_ingested",
          required: true,
          status: "complete"
        },
        {
          completedAt: undefined,
          id: "member_invited",
          required: false,
          status: "pending"
        }
      ],
      totalRequiredSteps: 3
    });
  });

  it("surfaces dismissal state separately from completion", () => {
    expect(
      summarizeOnboardingProgress({
        dismissedAt: "2026-06-25T13:00:00.000Z",
        completedAtByStep: {
          project_created: "2026-06-25T12:00:00.000Z"
        },
        steps: auditSteps
      })
    ).toMatchObject({
      completedRequiredSteps: 1,
      dismissedAt: "2026-06-25T13:00:00.000Z",
      isComplete: false,
      isDismissed: true
    });
  });
});

describe("isRequiredOnboardingStep", () => {
  it("marks only invite as optional", () => {
    expect(isRequiredOnboardingStep("project_created", auditSteps)).toBe(true);
    expect(isRequiredOnboardingStep("api_key_created", auditSteps)).toBe(true);
    expect(isRequiredOnboardingStep("first_event_ingested", auditSteps)).toBe(true);
    expect(isRequiredOnboardingStep("member_invited", auditSteps)).toBe(false);
  });
});
