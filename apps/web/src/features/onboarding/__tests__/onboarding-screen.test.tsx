import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildOnboardingStepViews } from "@/app/product-module";
import { OnboardingScreen } from "@/src/features/onboarding/components/onboarding-screen";
import type {
  OnboardingScreenCopy,
  OnboardingStepView
} from "@/src/features/onboarding/domain/onboarding-screen";

const onboardingCopy: OnboardingScreenCopy = {
  completeSummaryDescription: "Required setup is complete.",
  dismissFromSidebarLabel: "Dismiss from sidebar",
  emptyStateDescription:
    "No organization is available yet. Create a workspace first, then come back here for the guided setup flow.",
  emptyStatePrimaryCtaHref: "/settings",
  emptyStatePrimaryCtaLabel: "Open settings",
  eyebrow: "Workspace setup",
  incompleteSummaryDescription:
    "Finish the required steps to complete the initial workspace setup.",
  showInSidebarLabel: "Show in sidebar",
  title: "Getting started"
};

describe("OnboardingScreen", () => {
  it("renders the no-organization state", () => {
    render(
      <OnboardingScreen
        onboardingCopy={onboardingCopy}
        updateOnboardingStateAction={noopAction}
      />
    );

    expect(screen.getByRole("heading", { name: "Getting started" })).toBeTruthy();
    expect(screen.getAllByText(/No organization is available yet/)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open settings" }).getAttribute("href")).toBe(
      "/settings"
    );
  });

  it("renders checklist items, cta links, and the ingest command", () => {
    const onboardingStepViews: OnboardingStepView[] = [
      {
        completedAt: "2026-06-25T10:00:00.000Z",
        ctaHref: "/settings?organizationId=org-1#project-settings",
        ctaLabel: "Create first project",
        description:
          "Create the first project for this organization in workspace settings.",
        id: "project_created",
        required: true,
        showsIngestCommand: false,
        status: "complete",
        title: "Create a project"
      },
      {
        ctaHref: "/api-keys?organizationId=org-1&projectId=project-1",
        ctaLabel: "Create first API key",
        description: "Generate a machine credential in the existing API keys flow.",
        id: "api_key_created",
        required: true,
        showsIngestCommand: false,
        status: "pending",
        title: "Create an API key"
      },
      {
        ctaHref: "/settings?organizationId=org-1&projectId=project-1",
        ctaLabel: "Send first event",
        description:
          "Send one test event through the selected project to validate the full ingest path.",
        id: "first_event_ingested",
        required: true,
        showsIngestCommand: true,
        status: "pending",
        title: "Send the first event"
      },
      {
        ctaHref: "/settings?organizationId=org-1#access-settings",
        ctaLabel: "Invite teammate",
        description:
          "Add another member from the workspace access settings when you are ready.",
        id: "member_invited",
        required: false,
        showsIngestCommand: false,
        status: "pending",
        title: "Invite a teammate"
      }
    ];

    render(
      <OnboardingScreen
        activeOnboarding={{
          completedRequiredSteps: 1,
          isComplete: false,
          isDismissed: false,
          steps: [
            {
              completedAt: "2026-06-25T10:00:00.000Z",
              id: "project_created",
              required: true,
              status: "complete"
            },
            {
              id: "api_key_created",
              required: true,
              status: "pending"
            },
            {
              id: "first_event_ingested",
              required: true,
              status: "pending"
            },
            {
              id: "member_invited",
              required: false,
              status: "pending"
            }
          ],
          totalRequiredSteps: 3
        }}
        activeOrganizationId="org-1"
        activeOrganizationName="Acme"
        activeProjectId="project-1"
        activeProjectName="Production"
        ingestCommand={"curl https://api.example.com"}
        onboardingCopy={onboardingCopy}
        onboardingStepViews={onboardingStepViews}
        updateOnboardingStateAction={noopAction}
      />
    );

    expect(screen.getByText("1 / 3 required")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create first project" }).getAttribute("href")).toBe(
      "/settings?organizationId=org-1#project-settings"
    );
    expect(screen.getByRole("link", { name: "Create first API key" }).getAttribute("href")).toBe(
      "/api-keys?organizationId=org-1&projectId=project-1"
    );
    expect(screen.getByRole("link", { name: "Send first event" }).getAttribute("href")).toBe(
      "/settings?organizationId=org-1&projectId=project-1"
    );
    expect(screen.getByRole("link", { name: "Invite teammate" }).getAttribute("href")).toBe(
      "/settings?organizationId=org-1#access-settings"
    );
    expect(screen.getByText("curl https://api.example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss from sidebar" })).toBeTruthy();
  });

  it("renders readable no-project guidance through the onboarding checklist", () => {
    const activeOnboarding = {
      completedRequiredSteps: 0,
      isComplete: false,
      isDismissed: false,
      steps: [
        {
          id: "api_key_created" as const,
          required: true,
          status: "pending" as const
        },
        {
          id: "first_event_ingested" as const,
          required: true,
          status: "pending" as const
        }
      ],
      totalRequiredSteps: 2
    };

    render(
      <OnboardingScreen
        activeOnboarding={activeOnboarding}
        activeOrganizationId="org-1"
        activeOrganizationName="Acme"
        onboardingCopy={onboardingCopy}
        onboardingStepViews={buildOnboardingStepViews({
          activeOnboarding,
          activeOrganizationId: "org-1"
        })}
        updateOnboardingStateAction={noopAction}
      />
    );

    expect(screen.getByText("Acme setup progress")).toBeTruthy();
    expect(screen.getByText("Create an API key")).toBeTruthy();
    expect(
      screen.getByText("Generate a machine credential in the existing API keys flow.")
    ).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Create a project first" }).map((link) =>
        link.getAttribute("href")
      )
    ).toEqual([
      "/settings?organizationId=org-1#project-settings",
      "/settings?organizationId=org-1#project-settings"
    ]);
    expect(screen.queryByText("Ingest command")).toBeNull();
  });

  it("renders readable no-key guidance for a selected project before the first event exists", () => {
    const activeOnboarding = {
      completedRequiredSteps: 1,
      isComplete: false,
      isDismissed: false,
      steps: [
        {
          completedAt: "2026-06-25T10:00:00.000Z",
          id: "project_created" as const,
          required: true,
          status: "complete" as const
        },
        {
          id: "api_key_created" as const,
          required: true,
          status: "pending" as const
        },
        {
          id: "first_event_ingested" as const,
          required: true,
          status: "pending" as const
        }
      ],
      totalRequiredSteps: 3
    };

    render(
      <OnboardingScreen
        activeOnboarding={activeOnboarding}
        activeOrganizationId="org-1"
        activeOrganizationName="Acme"
        activeProjectId="project-1"
        activeProjectName="Production"
        ingestCommand={"curl https://api.example.com \\\n  -H 'authorization: Bearer <YOUR_API_KEY>'"}
        onboardingCopy={onboardingCopy}
        onboardingStepViews={buildOnboardingStepViews({
          activeOnboarding,
          activeOrganizationId: "org-1",
          activeProjectId: "project-1"
        })}
        updateOnboardingStateAction={noopAction}
      />
    );

    expect(screen.getByText("Acme / Production")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create first API key" }).getAttribute("href")).toBe(
      "/api-keys?organizationId=org-1&projectId=project-1"
    );
    expect(
      screen.getByText("Generate a machine credential in the existing API keys flow.")
    ).toBeTruthy();
    expect(screen.getByText(/authorization: Bearer <YOUR_API_KEY>/)).toBeTruthy();
  });
});

async function noopAction() {}
