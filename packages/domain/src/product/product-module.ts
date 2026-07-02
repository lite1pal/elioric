import { z } from "zod";

import type { OnboardingStepDefinition } from "../onboarding/index";

import {
  onboardingStepDefinitionSchema,
  productCopySchema,
  productNavItemSchema,
  usageMeterDefinitionSchema,
  type ProductCopy,
  type ProductDefinition,
  type ProductNavItem,
  type ProductUsageMeterDefinition
} from "./product-definition";

const nonEmptyStringSchema = z.string().trim().min(1);

export const productOwnershipModes = [
  "organization",
  "user",
  "global",
  "none"
] as const;

export type ProductOwnershipMode = (typeof productOwnershipModes)[number];

export const productCapabilityKinds = [
  "resource",
  "api",
  "ui",
  "navigation",
  "onboarding",
  "billing",
  "entitlement",
  "meter",
  "job",
  "webhook"
] as const;

export type ProductCapabilityKind = (typeof productCapabilityKinds)[number];

export const productRuntimeSurfaces = ["api", "web", "worker"] as const;

export type ProductRuntimeSurface = (typeof productRuntimeSurfaces)[number];

export interface ProductChrome {
  errorHeading: string;
  loadingLabel: string;
  metadataDescription: string;
  metadataTitle: string;
}

export interface ProductOnboardingAction<TTarget extends string = string> {
  label: string;
  target: TTarget;
}

export interface ProductOnboardingStepContent<
  TStepId extends string = string,
  TTarget extends string = string
> {
  action: ProductOnboardingAction<TTarget>;
  description: string;
  missingProjectAction?: ProductOnboardingAction<TTarget>;
  showsIngestCommand?: boolean;
  stepId: TStepId;
  title: string;
}

export interface ProductOnboardingContent<
  TStepId extends string = string,
  TTarget extends string = string
> {
  completeSummaryDescription: string;
  dismissFromSidebarLabel: string;
  eyebrow: string;
  incompleteSummaryDescription: string;
  showInSidebarLabel: string;
  stepContent: readonly ProductOnboardingStepContent<TStepId, TTarget>[];
  title: string;
}

export interface ProductOwnedResource<TResourceId extends string = string> {
  id: TResourceId;
  navigationId?: string;
  ownership: ProductOwnershipMode;
  routeBasePath?: string;
}

export interface ProductCapabilityDefinition<
  TCapabilityId extends string = string
> {
  description?: string;
  id: TCapabilityId;
  kind: ProductCapabilityKind;
}

export interface ProductRuntimeRegistration<
  TRegistrationId extends string = string
> {
  description?: string;
  id: TRegistrationId;
  surface: ProductRuntimeSurface;
  target: string;
}

export interface ProductRuntimeManifest<
  TRegistrationId extends string = string
> {
  registrations: readonly ProductRuntimeRegistration<TRegistrationId>[];
}

export interface ProductModuleManifest<
  TStepId extends string = string,
  TMeterKey extends string = string,
  TNavItemId extends string = string,
  TResourceId extends string = string,
  TCapabilityId extends string = string,
  TRegistrationId extends string = string,
  TActionTarget extends string = string
> extends ProductDefinition<TStepId, TMeterKey, TNavItemId> {
  capabilities: readonly ProductCapabilityDefinition<TCapabilityId>[];
  chrome?: ProductChrome;
  description?: string;
  onboardingContent: ProductOnboardingContent<TStepId, TActionTarget>;
  resources: readonly ProductOwnedResource<TResourceId>[];
  runtime: ProductRuntimeManifest<TRegistrationId>;
}

export const productOwnershipModeSchema = z.enum(productOwnershipModes);

export const productCapabilityKindSchema = z.enum(productCapabilityKinds);

export const productRuntimeSurfaceSchema = z.enum(productRuntimeSurfaces);

export const productChromeSchema = z.object({
  errorHeading: nonEmptyStringSchema,
  loadingLabel: nonEmptyStringSchema,
  metadataDescription: nonEmptyStringSchema,
  metadataTitle: nonEmptyStringSchema
}) satisfies z.ZodType<ProductChrome>;

export const productOnboardingActionSchema = z.object({
  label: nonEmptyStringSchema,
  target: nonEmptyStringSchema
}) satisfies z.ZodType<ProductOnboardingAction>;

export const productOnboardingStepContentSchema = z.object({
  action: productOnboardingActionSchema,
  description: nonEmptyStringSchema,
  missingProjectAction: productOnboardingActionSchema.optional(),
  showsIngestCommand: z.boolean().optional(),
  stepId: nonEmptyStringSchema,
  title: nonEmptyStringSchema
}) satisfies z.ZodType<ProductOnboardingStepContent>;

export const productOnboardingContentSchema = z
  .object({
    completeSummaryDescription: nonEmptyStringSchema,
    dismissFromSidebarLabel: nonEmptyStringSchema,
    eyebrow: nonEmptyStringSchema,
    incompleteSummaryDescription: nonEmptyStringSchema,
    showInSidebarLabel: nonEmptyStringSchema,
    stepContent: z.array(productOnboardingStepContentSchema),
    title: nonEmptyStringSchema
  })
  .superRefine((value, context) => {
    addDuplicateIssues({
      context,
      label: "onboarding step content",
      path: ["stepContent"],
      values: value.stepContent.map((step) => step.stepId)
    });
  }) satisfies z.ZodType<ProductOnboardingContent>;

export const productOwnedResourceSchema = z.object({
  id: nonEmptyStringSchema,
  navigationId: nonEmptyStringSchema.optional(),
  ownership: productOwnershipModeSchema,
  routeBasePath: nonEmptyStringSchema.optional()
}) satisfies z.ZodType<ProductOwnedResource>;

export const productCapabilityDefinitionSchema = z.object({
  description: nonEmptyStringSchema.optional(),
  id: nonEmptyStringSchema,
  kind: productCapabilityKindSchema
}) satisfies z.ZodType<ProductCapabilityDefinition>;

export const productRuntimeRegistrationSchema = z.object({
  description: nonEmptyStringSchema.optional(),
  id: nonEmptyStringSchema,
  surface: productRuntimeSurfaceSchema,
  target: nonEmptyStringSchema
}) satisfies z.ZodType<ProductRuntimeRegistration>;

export const productRuntimeManifestSchema = z
  .object({
    registrations: z.array(productRuntimeRegistrationSchema)
  })
  .superRefine((value, context) => {
    addDuplicateIssues({
      context,
      label: "runtime registration",
      path: ["registrations"],
      values: value.registrations.map((registration) => registration.id)
    });
  }) satisfies z.ZodType<ProductRuntimeManifest>;

export const productModuleManifestSchema = z
  .object({
    capabilities: z.array(productCapabilityDefinitionSchema),
    chrome: productChromeSchema.optional(),
    description: nonEmptyStringSchema.optional(),
    emptyStateCopy: productCopySchema,
    id: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    navItems: z.array(productNavItemSchema),
    onboardingContent: productOnboardingContentSchema,
    onboardingSteps: z.array(onboardingStepDefinitionSchema),
    resources: z.array(productOwnedResourceSchema),
    runtime: productRuntimeManifestSchema,
    usageMeters: z.array(usageMeterDefinitionSchema)
  })
  .superRefine((value, context) => {
    addDuplicateIssues({
      context,
      label: "navigation item",
      path: ["navItems"],
      values: value.navItems.map((item) => item.id)
    });
    addDuplicateIssues({
      context,
      label: "onboarding step",
      path: ["onboardingSteps"],
      values: value.onboardingSteps.map((step) => step.id)
    });
    addDuplicateIssues({
      context,
      label: "usage meter",
      path: ["usageMeters"],
      values: value.usageMeters.map((meter) => meter.key)
    });
    addDuplicateIssues({
      context,
      label: "product resource",
      path: ["resources"],
      values: value.resources.map((resource) => resource.id)
    });
    addDuplicateIssues({
      context,
      label: "product capability",
      path: ["capabilities"],
      values: value.capabilities.map((capability) => capability.id)
    });

    const onboardingStepIds = new Set(value.onboardingSteps.map((step) => step.id));
    const onboardingContentStepIds = new Set(
      value.onboardingContent.stepContent.map((step) => step.stepId)
    );

    for (const stepId of onboardingStepIds) {
      if (!onboardingContentStepIds.has(stepId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing onboarding content for step '${stepId}'.`,
          path: ["onboardingContent", "stepContent"]
        });
      }
    }

    for (const stepId of onboardingContentStepIds) {
      if (!onboardingStepIds.has(stepId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Onboarding content references unknown step '${stepId}'.`,
          path: ["onboardingContent", "stepContent"]
        });
      }
    }
  }) satisfies z.ZodType<ProductModuleManifest>;

function addDuplicateIssues(input: {
  context: z.RefinementCtx;
  label: string;
  path: readonly (string | number)[];
  values: readonly string[];
}) {
  const seen = new Set<string>();

  for (const value of input.values) {
    if (seen.has(value)) {
      input.context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${input.label} identifiers must be unique.`,
        path: [...input.path]
      });

      return;
    }

    seen.add(value);
  }
}
