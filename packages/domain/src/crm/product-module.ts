import type {
  ProductModuleOnboardingCopy,
  ProductModuleOnboardingStepView,
  ProductModuleShellConfig,
  ProductModuleWorkspaceScope,
  RegisteredProductModule
} from "../product/runtime-module";

import { crmProduct } from "./product";

const crmOnboardingCopy: ProductModuleOnboardingCopy = {
  completeSummaryDescription:
    crmProduct.onboardingContent.completeSummaryDescription,
  dismissFromSidebarLabel:
    crmProduct.onboardingContent.dismissFromSidebarLabel,
  emptyStateDescription: crmProduct.emptyStateCopy.emptyStateDescription,
  emptyStatePrimaryCtaHref: crmProduct.emptyStateCopy.primaryCtaHref ?? "/crm",
  emptyStatePrimaryCtaLabel:
    crmProduct.emptyStateCopy.primaryCtaLabel ?? "Open CRM",
  eyebrow: crmProduct.onboardingContent.eyebrow,
  incompleteSummaryDescription:
    crmProduct.onboardingContent.incompleteSummaryDescription,
  showInSidebarLabel: crmProduct.onboardingContent.showInSidebarLabel,
  title: crmProduct.onboardingContent.title
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

export const crmProductModule = {
  manifest: crmProduct,
  buildOnboardingStepViews(
    _input: Parameters<RegisteredProductModule["buildOnboardingStepViews"]>[0]
  ): ProductModuleOnboardingStepView[] {
    return [];
  },
  getChrome() {
    return crmProduct.chrome;
  },
  getOnboardingScreenCopy() {
    return crmOnboardingCopy;
  },
  getRuntimeRegistrations(surface: "api" | "web" | "worker") {
    const registrations = crmProduct.runtime.registrations as RegisteredProductModule["manifest"]["runtime"]["registrations"];
    return registrations.filter(
      (registration) => registration.surface === surface
    );
  },
  getShellProductConfig(input: ProductModuleWorkspaceScope): ProductModuleShellConfig {
    const workspaceSuffix = buildWorkspaceSuffix(input);

    return {
      navItems: crmProduct.navItems.map((item) => ({
        href: toScopedHref(item.href, workspaceSuffix),
        id: item.id,
        label: item.label
      })),
      productName: crmProduct.name
    };
  },
  getWorkspaceSettingsCopy() {
    return crmProduct.workspaceSettings;
  }
} satisfies RegisteredProductModule;
