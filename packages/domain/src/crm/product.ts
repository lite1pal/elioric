import type {
  ProductDefinition,
  ProductModuleManifest
} from "../product/index";

type CrmProductDefinition = ProductModuleManifest &
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

export const crmProduct = {
  "capabilities": [
    {
      "description": "Provides the CRM product shell.",
      "id": "crm-ui",
      "kind": "ui"
    },
    {
      "description": "Provides the CRM workspace navigation.",
      "id": "crm-navigation",
      "kind": "navigation"
    },
    {
      "description": "Provides the companies resource slice.",
      "id": "crm-company",
      "kind": "resource"
    },
    {
      "description": "Provides the contacts resource slice.",
      "id": "crm-contact",
      "kind": "resource"
    },
    {
      "description": "Provides the deals resource slice.",
      "id": "crm-deal",
      "kind": "resource"
    },
    {
      "description": "Provides the notes resource slice.",
      "id": "crm-note",
      "kind": "resource"
    }
  ],
  "chrome": {
    "errorHeading": "Unable to load CRM",
    "loadingLabel": "Loading CRM...",
    "metadataDescription": "CRM is a generated CRM workspace product for tracking companies, contacts, deals, and notes through Elioric's reusable product seams.",
    "metadataTitle": "CRM"
  },
  "description": "CRM is a generated CRM workspace product for tracking companies, contacts, deals, and notes through Elioric's reusable product seams.",
  "emptyStateCopy": {
    "emptyStateDescription": "Manage companies, contacts, deals, and notes through one generated multi-resource CRM workspace without hand-editing shared runtime seams.",
    "emptyStateTitle": "CRM workspace",
    "primaryCtaHref": "/crm",
    "primaryCtaLabel": "Open Deals"
  },
  "id": "crm",
  "name": "CRM",
  "navItems": [
    {
      "href": "/crm",
      "id": "crm-home",
      "label": "CRM"
    },
    {
      "href": "/crm/companies",
      "id": "crm-companies",
      "label": "Companies"
    },
    {
      "href": "/crm/contacts",
      "id": "crm-contacts",
      "label": "Contacts"
    },
    {
      "href": "/crm/deals",
      "id": "crm-deals",
      "label": "Deals"
    },
    {
      "href": "/crm/notes",
      "id": "crm-notes",
      "label": "Notes"
    }
  ],
  "onboardingContent": {
    "completeSummaryDescription": "CRM setup is complete.",
    "dismissFromSidebarLabel": "Dismiss from sidebar",
    "eyebrow": "CRM setup",
    "incompleteSummaryDescription": "CRM does not require additional setup for the initial generated proof.",
    "showInSidebarLabel": "Show in sidebar",
    "stepContent": [],
    "title": "CRM getting started"
  },
  "onboardingSteps": [],
  "resources": [
    {
      "id": "company",
      "navigationId": "crm-companies",
      "ownership": "organization",
      "routeBasePath": "/crm/companies"
    },
    {
      "id": "contact",
      "navigationId": "crm-contacts",
      "ownership": "organization",
      "routeBasePath": "/crm/contacts"
    },
    {
      "id": "deal",
      "navigationId": "crm-deals",
      "ownership": "organization",
      "routeBasePath": "/crm/deals"
    },
    {
      "id": "note",
      "navigationId": "crm-notes",
      "ownership": "organization",
      "routeBasePath": "/crm/notes"
    }
  ],
  "runtime": {
    "registrations": []
  },
  "usageMeters": [
    {
      "key": "crm",
      "label": "CRM"
    }
  ],
  "workspaceSettings": {
    "planUsage": {
      "emptyStateDescription": "CRM usage will appear here once product-specific limits are added.",
      "metrics": {
        "currentPlan": "Current plan",
        "includedUnits": "Included companies",
        "remainingUnits": "Remaining companies",
        "usedThisMonth": "Created this month"
      },
      "navDescription": "Track how CRM will use your workspace plan.",
      "navLabel": "CRM usage",
      "noPermissionDescription": "You do not have permission to inspect CRM usage for this workspace.",
      "resetDatePrefix": "Usage resets",
      "sectionDescription": "This generated product currently reuses the shared workspace plan surface.",
      "sectionTitle": "CRM plan & usage",
      "selectedPlanSuffix": "selected",
      "switchToPlanPrefix": "Switch to",
      "usageWindowPrefix": "Usage window"
    }
  }
} satisfies CrmProductDefinition;
