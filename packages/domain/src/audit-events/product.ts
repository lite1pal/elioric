import type {
  ProductDefinition,
  ProductModuleManifest
} from "../product/index";

import {
  auditOnboardingStepIds,
  auditOnboardingSteps
} from "./onboarding";

export type AuditTrailOnboardingActionHref =
  | "access-settings"
  | "api-keys"
  | "project-settings"
  | "selected-project-settings";

export interface AuditTrailOnboardingAction {
  href: AuditTrailOnboardingActionHref;
  label: string;
}

export interface AuditTrailOnboardingStepContent {
  action: AuditTrailOnboardingAction;
  description: string;
  missingProjectAction?: AuditTrailOnboardingAction;
  showsIngestCommand?: boolean;
  title: string;
}

export interface AuditTrailOnboardingContent {
  completeSummaryDescription: string;
  dismissFromSidebarLabel: string;
  eyebrow: string;
  incompleteSummaryDescription: string;
  showInSidebarLabel: string;
  steps: Readonly<Record<(typeof auditOnboardingStepIds)[number], AuditTrailOnboardingStepContent>>;
  title: string;
}

export interface AuditTrailAppChromeContent {
  errorHeading: string;
  loadingLabel: string;
  metadataDescription: string;
  metadataTitle: string;
}

export interface AuditTrailAuditEventsContent {
  chartDescription: string;
  chartEmptyStateLabel: string;
  chartEyebrow: string;
  chartSeriesLabel: string;
  chartTitle: string;
  detailCloseLabel: string;
  detailDescription: string;
  detailLabels: {
    actor: string;
    created: string;
    event: string;
    metadata: string;
    target: string;
  };
  detailTitle: string;
  emptyStateCtaLabel: string;
  emptyStateLabel: string;
  inspectActionLabel: string;
  inspectingActionLabel: string;
  listDescription: string;
  listEyebrow: string;
  listTitle: string;
  nextPageLabel: string;
  tableEmptyLabel: string;
  tableHeaders: {
    actor: string;
    created: string;
    event: string;
    inspect: string;
    metadata: string;
    target: string;
  };
  topEventTypesLabel: string;
  totalEventsLabel: string;
  tooltipCountSuffix: string;
}

export interface AuditTrailWorkspaceSettingsPlanUsageContent {
  emptyStateDescription: string;
  metrics: {
    currentPlan: string;
    includedUnits: string;
    remainingUnits: string;
    usedThisMonth: string;
  };
  navDescription: string;
  navLabel: string;
  noPermissionDescription: string;
  resetDatePrefix: string;
  selectedPlanSuffix: string;
  sectionDescription: string;
  sectionTitle: string;
  switchToPlanPrefix: string;
  usageWindowPrefix: string;
}

export interface AuditTrailWorkspaceSettingsContent {
  planUsage: AuditTrailWorkspaceSettingsPlanUsageContent;
}

type AuditTrailProductDefinition = ProductModuleManifest & ProductDefinition & {
  appChrome: AuditTrailAppChromeContent;
  auditEvents: AuditTrailAuditEventsContent;
  onboarding: AuditTrailOnboardingContent;
  workspaceSettings: AuditTrailWorkspaceSettingsContent;
};

export const auditTrailProduct = {
  emptyStateCopy: {
    emptyStateDescription:
      "No organization is available yet. Create a workspace first, then come back here for the guided setup flow.",
    emptyStateTitle: "Getting started",
    primaryCtaHref: "/settings",
    primaryCtaLabel: "Open settings"
  },
  id: "audit-events",
  name: "AuditTrail",
  description:
    "AuditTrail is the reference product module for event ingest, investigation, onboarding, and webhook delivery on top of the shared platform.",
  appChrome: {
    errorHeading: "Unable to load AuditTrail",
    loadingLabel: "Loading AuditTrail...",
    metadataDescription: "AuditTrail event monitoring workspace",
    metadataTitle: "AuditTrail"
  },
  chrome: {
    errorHeading: "Unable to load AuditTrail",
    loadingLabel: "Loading AuditTrail...",
    metadataDescription: "AuditTrail event monitoring workspace",
    metadataTitle: "AuditTrail"
  },
  auditEvents: {
    chartDescription: "Daily counts for the selected workspace and filters.",
    chartEmptyStateLabel: "No event volume yet.",
    chartEyebrow: "Audit events",
    chartSeriesLabel: "Events",
    chartTitle: "Event volume",
    detailCloseLabel: "Close",
    detailDescription: "Inspect the selected event without leaving the dashboard.",
    detailLabels: {
      actor: "Actor",
      created: "Created",
      event: "Event",
      metadata: "Metadata",
      target: "Target"
    },
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
    tableHeaders: {
      actor: "Actor",
      created: "Created",
      event: "Event",
      inspect: "Inspect",
      metadata: "Metadata",
      target: "Target"
    },
    topEventTypesLabel: "Top event types",
    totalEventsLabel: "Total events",
    tooltipCountSuffix: "events"
  },
  navItems: [
    {
      href: "/",
      id: "events",
      label: "Events"
    }
  ],
  onboardingSteps: auditOnboardingSteps,
  onboarding: {
    completeSummaryDescription: "Required setup is complete.",
    dismissFromSidebarLabel: "Dismiss from sidebar",
    eyebrow: "Workspace setup",
    incompleteSummaryDescription:
      "Finish the required steps to complete the initial workspace setup.",
    showInSidebarLabel: "Show in sidebar",
    steps: {
      api_key_created: {
        action: {
          href: "api-keys",
          label: "Create first API key"
        },
        description: "Generate a machine credential in the existing API keys flow.",
        missingProjectAction: {
          href: "project-settings",
          label: "Create a project first"
        },
        title: "Create an API key"
      },
      first_event_ingested: {
        action: {
          href: "selected-project-settings",
          label: "Send first event"
        },
        description:
          "Send one test event through the selected project to validate the full ingest path.",
        missingProjectAction: {
          href: "project-settings",
          label: "Create a project first"
        },
        showsIngestCommand: true,
        title: "Send the first event"
      },
      member_invited: {
        action: {
          href: "access-settings",
          label: "Invite teammate"
        },
        description:
          "Add another member from the workspace access settings when you are ready.",
        title: "Invite a teammate"
      },
      project_created: {
        action: {
          href: "project-settings",
          label: "Create first project"
        },
        description:
          "Create the first project for this organization in workspace settings.",
        title: "Create a project"
      }
    },
    title: "Getting started"
  },
  onboardingContent: {
    completeSummaryDescription: "Required setup is complete.",
    dismissFromSidebarLabel: "Dismiss from sidebar",
    eyebrow: "Workspace setup",
    incompleteSummaryDescription:
      "Finish the required steps to complete the initial workspace setup.",
    showInSidebarLabel: "Show in sidebar",
    stepContent: [
      {
        action: {
          label: "Create first project",
          target: "project-settings"
        },
        description:
          "Create the first project for this organization in workspace settings.",
        stepId: "project_created",
        title: "Create a project"
      },
      {
        action: {
          label: "Create first API key",
          target: "api-keys"
        },
        description: "Generate a machine credential in the existing API keys flow.",
        missingProjectAction: {
          label: "Create a project first",
          target: "project-settings"
        },
        stepId: "api_key_created",
        title: "Create an API key"
      },
      {
        action: {
          label: "Send first event",
          target: "selected-project-settings"
        },
        description:
          "Send one test event through the selected project to validate the full ingest path.",
        missingProjectAction: {
          label: "Create a project first",
          target: "project-settings"
        },
        showsIngestCommand: true,
        stepId: "first_event_ingested",
        title: "Send the first event"
      },
      {
        action: {
          label: "Invite teammate",
          target: "access-settings"
        },
        description:
          "Add another member from the workspace access settings when you are ready.",
        stepId: "member_invited",
        title: "Invite a teammate"
      }
    ],
    title: "Getting started"
  },
  resources: [
    {
      id: "audit-event",
      navigationId: "events",
      ownership: "organization",
      routeBasePath: "/api/v1/events"
    }
  ],
  capabilities: [
    {
      id: "audit-event-ingest",
      kind: "api",
      description: "Accepts organization-scoped audit event ingestion requests."
    },
    {
      id: "audit-event-investigation",
      kind: "ui",
      description: "Exposes dashboard investigation and event-detail surfaces."
    },
    {
      id: "workspace-onboarding",
      kind: "onboarding",
      description: "Provides AuditTrail-specific setup guidance and onboarding milestones."
    },
    {
      id: "project-webhook-delivery",
      kind: "webhook",
      description: "Fans out project audit events to signed outbound webhooks."
    },
    {
      id: "event-metering",
      kind: "meter",
      description: "Tracks included event usage for quota and plan screens."
    }
  ],
  runtime: {
    registrations: [
      {
        id: "audit-api-routes",
        surface: "api",
        target: "audit-events-routes",
        description: "Registers AuditTrail API routes into the shared API runtime."
      },
      {
        id: "audit-shell-navigation",
        surface: "web",
        target: "audit-product-navigation",
        description: "Provides AuditTrail shell navigation for the hosted web app."
      },
      {
        id: "audit-onboarding-screen",
        surface: "web",
        target: "audit-product-onboarding",
        description: "Provides AuditTrail onboarding copy and step mapping."
      },
      {
        id: "audit-worker-webhook-delivery",
        surface: "worker",
        target: "project-webhook-delivery",
        description: "Registers the AuditTrail webhook delivery handler in the worker."
      }
    ]
  },
  workspaceSettings: {
    planUsage: {
      emptyStateDescription:
        "Select an organization to review its current plan and monthly event usage.",
      metrics: {
        currentPlan: "Current plan",
        includedUnits: "Included events",
        remainingUnits: "Remaining",
        usedThisMonth: "Used this month"
      },
      navDescription: "Review monthly quota usage and switch the active plan.",
      navLabel: "Plan & usage",
      noPermissionDescription:
        "Only organization owners and admins can change plans.",
      resetDatePrefix: "Resets on",
      selectedPlanSuffix: "selected",
      sectionDescription:
        "Review the current monthly quota, the UTC reset window, and switch plans when your workspace needs more capacity.",
      sectionTitle: "Plan & usage",
      switchToPlanPrefix: "Switch to",
      usageWindowPrefix: "Usage is tracked by UTC calendar month from"
    }
  },
  usageMeters: [
    {
      key: "events",
      label: "Events"
    }
  ]
} satisfies AuditTrailProductDefinition;
