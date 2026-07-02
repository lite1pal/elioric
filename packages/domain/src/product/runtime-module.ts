import type { ProductModuleManifest } from "./product-module";

export interface ProductModuleChrome {
  errorHeading: string;
  loadingLabel: string;
  metadataDescription: string;
  metadataTitle: string;
}

export interface ProductModuleOnboardingCopy {
  completeSummaryDescription: string;
  dismissFromSidebarLabel: string;
  emptyStateDescription: string;
  emptyStatePrimaryCtaHref: string;
  emptyStatePrimaryCtaLabel: string;
  eyebrow: string;
  incompleteSummaryDescription: string;
  showInSidebarLabel: string;
  title: string;
}

export interface ProductModuleOnboardingStepView<
  TStep extends {
    id: string;
    required: boolean;
    status: "complete" | "pending";
  } = {
    id: string;
    required: boolean;
    status: "complete" | "pending";
  }
> {
  completedAt?: string;
  ctaHref: string;
  ctaLabel: string;
  description: string;
  id: TStep["id"];
  required: TStep["required"];
  showsIngestCommand: boolean;
  status: TStep["status"];
  title: string;
}

export interface ProductModuleWorkspaceSettingsCopy {
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
}

export interface ProductModuleWorkspaceScope {
  activeOrganizationId?: string;
  activeProjectId?: string;
}

export interface ProductModuleShellConfig {
  navItems: readonly {
    href: string;
    id: string;
    label: string;
  }[];
  productName: string;
}

export interface RegisteredProductModule {
  buildOnboardingStepViews(input: {
    activeOnboarding: {
      steps: readonly {
        completedAt?: string;
        id: string;
        required: boolean;
        status: "complete" | "pending";
      }[];
    };
    activeOrganizationId: string;
    activeProjectId?: string;
  }): ProductModuleOnboardingStepView[];
  getChrome(): ProductModuleChrome;
  getOnboardingScreenCopy(): ProductModuleOnboardingCopy;
  getRuntimeRegistrations(surface: "api" | "web" | "worker"): ReadonlyArray<
    ProductModuleManifest["runtime"]["registrations"][number]
  >;
  getShellProductConfig(input: ProductModuleWorkspaceScope): ProductModuleShellConfig;
  getWorkspaceSettingsCopy(): ProductModuleWorkspaceSettingsCopy;
  manifest: ProductModuleManifest;
}
