import type { OnboardingStepDefinition } from "../onboarding/index";

export const auditOnboardingStepIds = [
  "project_created",
  "api_key_created",
  "first_event_ingested",
  "member_invited"
] as const;

export type AuditOnboardingStepId = (typeof auditOnboardingStepIds)[number];

export const auditOnboardingSteps: readonly OnboardingStepDefinition<AuditOnboardingStepId>[] =
  [
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
  ];

export interface AuditOnboardingMilestones {
  apiKeyCreatedAt?: string;
  firstEventIngestedAt?: string;
  memberInvitedAt?: string;
  projectCreatedAt?: string;
}

export function toAuditOnboardingCompletedAtByStep(
  milestones: AuditOnboardingMilestones
): Partial<Record<AuditOnboardingStepId, string>> {
  return {
    api_key_created: milestones.apiKeyCreatedAt,
    first_event_ingested: milestones.firstEventIngestedAt,
    member_invited: milestones.memberInvitedAt,
    project_created: milestones.projectCreatedAt
  };
}
