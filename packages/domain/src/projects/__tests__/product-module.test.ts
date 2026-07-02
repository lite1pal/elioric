import { describe, expect, it } from "vitest";

import { projectsProductModule } from "../product-module";

describe("projectsProductModule", () => {
  it("builds workspace-aware shell navigation from the product manifest", () => {
    expect(
      projectsProductModule.getShellProductConfig({
        activeOrganizationId: "org-1",
        activeProjectId: "project-1"
      })
    ).toEqual({
      navItems: [
        {
          href: "/projects?organizationId=org-1&projectId=project-1",
          id: "projects-home",
          label: "Projects"
        }
      ],
      productName: "Projects"
    });
  });

  it("keeps onboarding intentionally empty for the minimal second product proof", () => {
    expect(projectsProductModule.getOnboardingScreenCopy()).toMatchObject({
      title: "Projects getting started"
    });
    expect(
      projectsProductModule.buildOnboardingStepViews({
        activeOnboarding: { steps: [] },
        activeOrganizationId: "org-1"
      })
    ).toEqual([]);
  });
});
