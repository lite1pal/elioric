import { z } from "zod";

import type { OnboardingStepDefinition } from "../onboarding/index";

export interface ProductUsageMeterDefinition<TMeterKey extends string = string> {
  key: TMeterKey;
  label: string;
}

export interface ProductNavItem<TNavItemId extends string = string> {
  href: string;
  id: TNavItemId;
  label: string;
}

export interface ProductCopy {
  emptyStateDescription: string;
  emptyStateTitle: string;
  primaryCtaHref?: string;
  primaryCtaLabel?: string;
}

export interface ProductDefinition<
  TStepId extends string = string,
  TMeterKey extends string = string,
  TNavItemId extends string = string
> {
  emptyStateCopy: ProductCopy;
  id: string;
  name: string;
  navItems: readonly ProductNavItem<TNavItemId>[];
  onboardingSteps: readonly OnboardingStepDefinition<TStepId>[];
  usageMeters: readonly ProductUsageMeterDefinition<TMeterKey>[];
}

const nonEmptyStringSchema = z.string().trim().min(1);

export const onboardingStepDefinitionSchema = z.object({
  id: nonEmptyStringSchema,
  required: z.boolean()
}) satisfies z.ZodType<OnboardingStepDefinition>;

export const usageMeterDefinitionSchema = z.object({
  key: nonEmptyStringSchema,
  label: nonEmptyStringSchema
}) satisfies z.ZodType<ProductUsageMeterDefinition>;

export const productNavItemSchema = z.object({
  href: nonEmptyStringSchema,
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema
}) satisfies z.ZodType<ProductNavItem>;

export const productCopySchema = z.object({
  emptyStateDescription: nonEmptyStringSchema,
  emptyStateTitle: nonEmptyStringSchema,
  primaryCtaHref: nonEmptyStringSchema.optional(),
  primaryCtaLabel: nonEmptyStringSchema.optional()
}) satisfies z.ZodType<ProductCopy>;

export const productDefinitionSchema = z.object({
  emptyStateCopy: productCopySchema,
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  navItems: z.array(productNavItemSchema),
  onboardingSteps: z.array(onboardingStepDefinitionSchema),
  usageMeters: z.array(usageMeterDefinitionSchema)
}) satisfies z.ZodType<ProductDefinition>;
