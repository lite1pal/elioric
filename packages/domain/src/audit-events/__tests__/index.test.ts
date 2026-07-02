import { describe, expect, it } from "vitest";

import {
  productDefinitionSchema,
  productModuleManifestSchema
} from "../../product/index";

import {
  auditTrailProduct,
  auditOnboardingSteps,
  ingestAuditEventSchema,
  toAuditOnboardingCompletedAtByStep
} from "../index";

describe("audit event schemas", () => {
  it("accepts the MVP ingestion shape", () => {
    expect(
      ingestAuditEventSchema.parse({
        event: "user.deleted",
        actor: "admin_123",
        target: "user_456",
        metadata: {
          reason: "GDPR request"
        }
      })
    ).toEqual({
      event: "user.deleted",
      actor: "admin_123",
      target: "user_456",
      metadata: {
        reason: "GDPR request"
      }
    });
  });

  it("defaults metadata to an empty object", () => {
    expect(
      ingestAuditEventSchema.parse({
        event: "login.succeeded"
      })
    ).toEqual({
      event: "login.succeeded",
      metadata: {}
    });
  });

  it("rejects blank event names", () => {
    expect(() =>
      ingestAuditEventSchema.parse({
        event: " "
      })
    ).toThrow();
  });

  it("exposes the audit onboarding milestone catalog", () => {
    expect(auditOnboardingSteps).toEqual([
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
    ]);
  });

  it("maps audit milestones into generic onboarding facts", () => {
    expect(
      toAuditOnboardingCompletedAtByStep({
        apiKeyCreatedAt: "2026-06-25T12:01:00.000Z",
        firstEventIngestedAt: "2026-06-25T12:02:00.000Z",
        memberInvitedAt: "2026-06-25T12:03:00.000Z",
        projectCreatedAt: "2026-06-25T12:00:00.000Z"
      })
    ).toEqual({
      api_key_created: "2026-06-25T12:01:00.000Z",
      first_event_ingested: "2026-06-25T12:02:00.000Z",
      member_invited: "2026-06-25T12:03:00.000Z",
      project_created: "2026-06-25T12:00:00.000Z"
    });
  });

  it("exposes an explicit AuditTrail product definition", () => {
    expect(productDefinitionSchema.parse(auditTrailProduct)).toEqual(
      {
        emptyStateCopy: {
          emptyStateDescription:
            "No organization is available yet. Create a workspace first, then come back here for the guided setup flow.",
          emptyStateTitle: "Getting started",
          primaryCtaHref: "/settings",
          primaryCtaLabel: "Open settings"
        },
        id: "audit-events",
        name: "AuditTrail",
        navItems: [
          {
            href: "/",
            id: "events",
            label: "Events"
          }
        ],
        onboardingSteps: auditOnboardingSteps,
        usageMeters: [
          {
            key: "events",
            label: "Events"
          }
        ]
      }
    );

    expect(auditTrailProduct).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-event-ingest",
          kind: "api"
        })
      ]),
      chrome: {
        errorHeading: "Unable to load AuditTrail",
        loadingLabel: "Loading AuditTrail...",
        metadataDescription: "AuditTrail event monitoring workspace",
        metadataTitle: "AuditTrail"
      },
      id: "audit-events",
      name: "AuditTrail",
      navItems: [
        {
          href: "/",
          id: "events",
          label: "Events"
        }
      ],
      onboardingSteps: auditOnboardingSteps,
      usageMeters: [
        {
          key: "events",
          label: "Events"
        }
      ],
      onboarding: {
        steps: {
          api_key_created: {
            action: {
              href: "api-keys",
              label: "Create first API key"
            }
          },
          first_event_ingested: {
            action: {
              href: "selected-project-settings",
              label: "Send first event"
            },
            showsIngestCommand: true
          }
        }
      },
      onboardingContent: {
        stepContent: expect.arrayContaining([
          expect.objectContaining({
            action: {
              label: "Create first project",
              target: "project-settings"
            },
            stepId: "project_created"
          }),
          expect.objectContaining({
            action: {
              label: "Send first event",
              target: "selected-project-settings"
            },
            showsIngestCommand: true,
            stepId: "first_event_ingested"
          })
        ])
      },
      resources: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-event",
          navigationId: "events",
          ownership: "organization",
          routeBasePath: "/api/v1/events"
        })
      ]),
      runtime: {
        registrations: expect.arrayContaining([
          expect.objectContaining({
            id: "audit-api-routes",
            surface: "api",
            target: "audit-events-routes"
          })
        ])
      },
      appChrome: {
        errorHeading: "Unable to load AuditTrail",
        loadingLabel: "Loading AuditTrail...",
        metadataDescription: "AuditTrail event monitoring workspace",
        metadataTitle: "AuditTrail"
      },
      auditEvents: {
        chartDescription: "Daily counts for the selected workspace and filters.",
        chartEyebrow: "Audit events",
        chartEmptyStateLabel: "No event volume yet.",
        chartSeriesLabel: "Events",
        chartTitle: "Event volume",
        detailCloseLabel: "Close",
        detailDescription:
          "Inspect the selected event without leaving the dashboard.",
        detailTitle: "Event details",
        emptyStateCtaLabel: "Open getting started",
        emptyStateLabel:
          "No audit events yet. Create a project key in Settings, send one test event, and come back to see the stream and metrics fill in.",
        inspectActionLabel: "Inspect",
        inspectingActionLabel: "Inspecting",
        listDescription:
          "Track the active project, inspect one event on demand, and filter the stream without leaving this page.",
        listEyebrow: "Audit events",
        listTitle: "Event stream",
        nextPageLabel: "Next page",
        tableEmptyLabel: "No audit events match these filters.",
        tooltipCountSuffix: "events",
        topEventTypesLabel: "Top event types",
        totalEventsLabel: "Total events"
      },
      workspaceSettings: {
        planUsage: {
          emptyStateDescription:
            "Select an organization to review its current plan and monthly event usage.",
          navDescription: "Review monthly quota usage and switch the active plan.",
          navLabel: "Plan & usage",
          noPermissionDescription:
            "Only organization owners and admins can change plans.",
          resetDatePrefix: "Resets on",
          sectionDescription:
            "Review the current monthly quota, the UTC reset window, and switch plans when your workspace needs more capacity.",
          sectionTitle: "Plan & usage",
          selectedPlanSuffix: "selected",
          switchToPlanPrefix: "Switch to",
          usageWindowPrefix: "Usage is tracked by UTC calendar month from"
        }
      }
    });

    expect(productModuleManifestSchema.parse(auditTrailProduct)).toMatchObject({
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-event-ingest",
          kind: "api"
        })
      ]),
      id: "audit-events",
      resources: expect.arrayContaining([
        expect.objectContaining({
          id: "audit-event",
          ownership: "organization"
        })
      ]),
      runtime: {
        registrations: expect.arrayContaining([
          expect.objectContaining({
            id: "audit-shell-navigation",
            surface: "web"
          })
        ])
      }
    });
  });
});
