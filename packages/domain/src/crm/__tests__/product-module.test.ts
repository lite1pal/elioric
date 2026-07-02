import { describe, expect, it } from "vitest";

import { crmProductModule } from "../product-module";

describe("crmProductModule", () => {
  it("builds scoped shell navigation for CRM", () => {
    expect(
      crmProductModule.getShellProductConfig({
        activeOrganizationId: "org-1",
        activeProjectId: "project-1"
      })
    ).toEqual({
      navItems:       [
        {
          "href": "/crm?organizationId=org-1&projectId=project-1",
          "id": "crm-home",
          "label": "CRM"
        },
        {
          "href": "/crm/companies?organizationId=org-1&projectId=project-1",
          "id": "crm-companies",
          "label": "Companies"
        },
        {
          "href": "/crm/contacts?organizationId=org-1&projectId=project-1",
          "id": "crm-contacts",
          "label": "Contacts"
        },
        {
          "href": "/crm/deals?organizationId=org-1&projectId=project-1",
          "id": "crm-deals",
          "label": "Deals"
        },
        {
          "href": "/crm/notes?organizationId=org-1&projectId=project-1",
          "id": "crm-notes",
          "label": "Notes"
        }
      ],
      productName: "CRM"
    });
  });

  it("keeps CRM onboarding empty for the first generated slice", () => {
    expect(
      crmProductModule.buildOnboardingStepViews({
        activeOnboarding: { steps: [] },
        activeOrganizationId: "org-1"
      })
    ).toEqual([]);
  });
});
