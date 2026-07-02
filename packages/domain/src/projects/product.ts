import type {
  ProductDefinition,
  ProductModuleManifest
} from "../product/index";

type ProjectsProductDefinition = ProductModuleManifest &
  ProductDefinition & {
    chrome: {
      errorHeading: string;
      loadingLabel: string;
      metadataDescription: string;
      metadataTitle: string;
    };
    workspaceSettings: {
      planUsage: {
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
        sectionDescription: string;
        sectionTitle: string;
        selectedPlanSuffix: string;
        switchToPlanPrefix: string;
        usageWindowPrefix: string;
      };
    };
  };

export const projectsProduct = {
  capabilities: [
    {
      description: "Provides the minimal project workspace overview API.",
      id: "projects-api",
      kind: "api"
    },
    {
      description: "Provides the minimal project workspace UI.",
      id: "projects-ui",
      kind: "ui"
    },
    {
      description: "Provides project-focused shell navigation.",
      id: "projects-navigation",
      kind: "navigation"
    }
  ],
  chrome: {
    errorHeading: "Unable to load Projects",
    loadingLabel: "Loading Projects...",
    metadataDescription: "Projects workspace for teams building inside Elioric",
    metadataTitle: "Projects"
  },
  description:
    "Projects is the minimal second product module that proves Elioric can host a non-AuditTrail workspace through the shared manifest and runtime seams.",
  emptyStateCopy: {
    emptyStateDescription:
      "Select a workspace to see the current organization projects and prepare the product for the fuller PM slice.",
    emptyStateTitle: "No project workspace selected",
    primaryCtaHref: "/settings",
    primaryCtaLabel: "Open settings"
  },
  id: "projects",
  name: "Projects",
  navItems: [
    {
      href: "/projects",
      id: "projects-home",
      label: "Projects"
    }
  ],
  onboardingContent: {
    completeSummaryDescription: "Projects setup is complete.",
    dismissFromSidebarLabel: "Dismiss from sidebar",
    eyebrow: "Projects setup",
    incompleteSummaryDescription:
      "Projects does not require extra setup yet. The fuller PM slice will add product-specific onboarding steps later.",
    showInSidebarLabel: "Show in sidebar",
    stepContent: [],
    title: "Projects getting started"
  },
  onboardingSteps: [],
  resources: [],
  runtime: {
    registrations: [
      {
        description: "Registers the Projects API workspace summary routes.",
        id: "projects-api-routes",
        surface: "api",
        target: "projects-routes"
      },
      {
        description: "Declares the Projects web workspace entrypoint.",
        id: "projects-web-routes",
        surface: "web",
        target: "projects-page"
      }
    ]
  },
  usageMeters: [
    {
      key: "projects",
      label: "Projects"
    }
  ],
  workspaceSettings: {
    planUsage: {
      emptyStateDescription:
        "Projects usage will appear here once the PM slice starts tracking product-specific limits.",
      metrics: {
        currentPlan: "Current plan",
        includedUnits: "Included projects",
        remainingUnits: "Remaining projects",
        usedThisMonth: "Created this month"
      },
      navDescription: "Track how the Projects product will use your workspace plan.",
      navLabel: "Projects usage",
      noPermissionDescription:
        "You do not have permission to inspect Projects usage for this workspace.",
      resetDatePrefix: "Usage resets",
      sectionDescription:
        "This section is intentionally minimal until the project-manager product slice adds its own meters.",
      sectionTitle: "Projects plan & usage",
      selectedPlanSuffix: "selected",
      switchToPlanPrefix: "Switch to",
      usageWindowPrefix: "Usage window"
    }
  }
} satisfies ProjectsProductDefinition;
