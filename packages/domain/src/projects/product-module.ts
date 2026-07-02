import type {
  ProductModuleOnboardingCopy,
  ProductModuleOnboardingStepView,
  ProductModuleShellConfig,
  ProductModuleWorkspaceScope,
  RegisteredProductModule
} from "../product/runtime-module";

import { projectsProduct } from "./product";

const projectsOnboardingCopy: ProductModuleOnboardingCopy = {
  completeSummaryDescription:
    projectsProduct.onboardingContent.completeSummaryDescription,
  dismissFromSidebarLabel:
    projectsProduct.onboardingContent.dismissFromSidebarLabel,
  emptyStateDescription: projectsProduct.emptyStateCopy.emptyStateDescription,
  emptyStatePrimaryCtaHref: projectsProduct.emptyStateCopy.primaryCtaHref ?? "/projects",
  emptyStatePrimaryCtaLabel:
    projectsProduct.emptyStateCopy.primaryCtaLabel ?? "Open Projects",
  eyebrow: projectsProduct.onboardingContent.eyebrow,
  incompleteSummaryDescription:
    projectsProduct.onboardingContent.incompleteSummaryDescription,
  showInSidebarLabel: projectsProduct.onboardingContent.showInSidebarLabel,
  title: projectsProduct.onboardingContent.title
};

function buildWorkspaceSuffix(input: ProductModuleWorkspaceScope) {
  if (!input.activeOrganizationId) {
    return "";
  }

  const query = new URLSearchParams({
    organizationId: input.activeOrganizationId
  });

  if (input.activeProjectId) {
    query.set("projectId", input.activeProjectId);
  }

  return `?${query.toString()}`;
}

function toScopedHref(baseHref: string, workspaceSuffix: string) {
  return workspaceSuffix ? `${baseHref}${workspaceSuffix}` : baseHref;
}

export const projectsProductModule = {
  manifest: projectsProduct,
  buildOnboardingStepViews(
    _input: Parameters<RegisteredProductModule["buildOnboardingStepViews"]>[0]
  ): ProductModuleOnboardingStepView[] {
    return [];
  },
  getChrome() {
    return projectsProduct.chrome;
  },
  getOnboardingScreenCopy() {
    return projectsOnboardingCopy;
  },
  getRuntimeRegistrations(surface) {
    return projectsProduct.runtime.registrations.filter(
      (registration) => registration.surface === surface
    );
  },
  getShellProductConfig(input: ProductModuleWorkspaceScope): ProductModuleShellConfig {
    const workspaceSuffix = buildWorkspaceSuffix(input);

    return {
      navItems: projectsProduct.navItems.map((item) => ({
        href: toScopedHref(item.href, workspaceSuffix),
        id: item.id,
        label: item.label
      })),
      productName: projectsProduct.name
    };
  },
  getWorkspaceSettingsCopy() {
    return projectsProduct.workspaceSettings;
  }
} satisfies RegisteredProductModule;
