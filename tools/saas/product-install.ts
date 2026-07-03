import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";

import { applyResourceFromFile } from "./resource-apply.js";
import {
  readGeneratedProductSpec,
  type GeneratedProductResource,
  type GeneratedProductSpec
} from "./product-spec.js";

const productInstallStageRoot = "tmp/saas-product-install";

export interface ProductInstallResult {
  generatedFileChanges: readonly ProductInstallChange[];
  installedProductId: string;
  resourceIds: readonly string[];
  rootPatchChanges: readonly ProductInstallChange[];
  writtenFiles: readonly string[];
}

export interface ProductInstallChange {
  action: "create" | "skip" | "update";
  kind: "generated-file" | "root-patch";
  path: string;
}

export function installProductFromFile(input: {
  force?: boolean;
  repoRoot: string;
  specPath: string;
}): ProductInstallResult {
  const repoRoot = resolve(input.repoRoot);
  const specPath = resolveProductSpecPath({
    repoRoot,
    specPath: input.specPath
  });
  const product = readGeneratedProductSpec(
    JSON.parse(readFileSync(specPath, "utf8"))
  );
  const stageRoot = resolve(
    repoRoot,
    `${productInstallStageRoot}/${product.id}`
  );

  try {
    rmSync(stageRoot, {
      force: true,
      recursive: true
    });
    mkdirSync(stageRoot, {
      recursive: true
    });

    for (const resourceEntry of product.resources) {
      const stagedSpecPath = resolve(
        stageRoot,
        `${toKebabCase(resourceEntry.resource.resource)}.json`
      );

      writeFileSync(
        stagedSpecPath,
        `${JSON.stringify(resourceEntry.resource, null, 2)}\n`
      );
      applyResourceFromFile({
        allowedWarningCodes:
          input.force ?? false ? ["existing-module-conflict"] : undefined,
        force: input.force ?? false,
        repoRoot,
        specPath: relative(repoRoot, stagedSpecPath).replace(/\\/g, "/"),
        targetPath: "."
      });
    }

    const generatedFiles = createProductGeneratedFiles(product);
    const preparedGeneratedWrites = prepareGeneratedProductWrites({
      files: generatedFiles,
      force: input.force ?? false,
      repoRoot
    });

    for (const file of preparedGeneratedWrites) {
      if (file.action === "skip") {
        continue;
      }

      const absolutePath = resolve(repoRoot, file.path);

      mkdirSync(dirname(absolutePath), {
        recursive: true
      });
      writeFileSync(absolutePath, ensureTrailingNewline(file.contents));
    }

    const rootPatchChanges = [
      patchRootFile({
        filePath: "packages/domain/src/index.ts",
        repoRoot,
        update: (contents) =>
          insertAfterAnchor({
            anchor: 'export * from "./webhooks/index";',
            contents,
            insertion: `export * from "./${product.id}/index";`
          })
      }),
      patchRootFile({
        filePath: "packages/domain/package.json",
        repoRoot,
        update: (contents) => patchDomainPackageExports(contents, product.id)
      }),
      patchRootFile({
        filePath: "apps/api/src/product-module.ts",
        repoRoot,
        update: (contents) => patchApiProductRuntime(contents, product.id)
      }),
      patchRootFile({
        filePath: "apps/web/app/product-module.ts",
        repoRoot,
        update: (contents) => patchWebProductRuntime(contents, product.id)
      }),
      patchRootFile({
        filePath: "apps/api/src/__tests__/product-module.test.ts",
        repoRoot,
        update: (contents) => patchApiProductRuntimeTest(contents, product)
      })
    ] satisfies readonly ProductInstallChange[];

    return {
      generatedFileChanges: preparedGeneratedWrites.map((file) => ({
        action: file.action,
        kind: "generated-file",
        path: file.path
      })),
      installedProductId: product.id,
      resourceIds: product.resources.map(
        (resource: GeneratedProductResource) => resource.resource.resource
      ),
      rootPatchChanges,
      writtenFiles: generatedFiles.map((file: PendingProductFile) => file.path)
    };
  } finally {
    rmSync(stageRoot, {
      force: true,
      recursive: true
    });
  }
}

export function formatInstalledProductSummary(result: ProductInstallResult) {
  const createdGeneratedFiles = result.generatedFileChanges.filter(
    (change) => change.action === "create"
  ).length;
  const updatedGeneratedFiles = result.generatedFileChanges.filter(
    (change) => change.action === "update"
  ).length;
  const skippedGeneratedFiles = result.generatedFileChanges.filter(
    (change) => change.action === "skip"
  ).length;
  const updatedRootPatches = result.rootPatchChanges.filter(
    (change) => change.action === "update"
  ).length;
  const skippedRootPatches = result.rootPatchChanges.filter(
    (change) => change.action === "skip"
  ).length;

  return [
    `Installed product: ${result.installedProductId}`,
    "",
    `- resources: ${result.resourceIds.join(", ")}`,
    `- generated files: ${result.writtenFiles.length}`,
    `- generated file changes: ${createdGeneratedFiles} created, ${updatedGeneratedFiles} updated, ${skippedGeneratedFiles} unchanged`,
    `- shared root patches: ${updatedRootPatches} updated, ${skippedRootPatches} unchanged`
  ].join("\n");
}

interface PendingProductFile {
  contents: string;
  path: string;
}

interface PreparedProductWrite extends PendingProductFile {
  action: "create" | "skip" | "update";
}

export function createProductGeneratedFiles(
  product: GeneratedProductSpec
): readonly PendingProductFile[] {
  const productPath = toKebabCase(product.id);
  const productFeaturePath = `${productPath}-product`;

  return [
    {
      path: `packages/domain/src/${productPath}/index.ts`,
      contents: [
        'export * from "./product.js";',
        'export * from "./product-module.js";'
      ].join("\n")
    },
    {
      path: `packages/domain/src/${productPath}/product.ts`,
      contents: renderDomainProductFile(product)
    },
    {
      path: `packages/domain/src/${productPath}/product-module.ts`,
      contents: renderDomainProductModuleFile(product)
    },
    {
      path: `packages/domain/src/${productPath}/__tests__/product-module.test.ts`,
      contents: renderDomainProductModuleTest(product)
    },
    {
      path: `apps/web/src/features/${productFeaturePath}/components/${productPath}-home-screen.tsx`,
      contents: renderProductHomeScreen(product)
    },
    {
      path: `apps/web/src/features/${productFeaturePath}/index.ts`,
      contents: `export * from "./components/${productPath}-home-screen";`
    },
    {
      path: `apps/web/app/${productPath}/page.tsx`,
      contents: renderProductHomePage(product)
    },
    ...product.resources.flatMap((resourceEntry: GeneratedProductResource) => [
      {
        path: `apps/web/src/features/${productFeaturePath}/server/${toKebabCase(
          resourceEntry.resource.resource
        )}-workspace.ts`,
        contents: renderProductResourceServerFile(product, resourceEntry)
      },
      {
        path: trimLeadingSlash(`apps/web/app${resourceEntry.listPath}/page.tsx`),
        contents: renderProductResourceListPage(product, resourceEntry)
      },
      ...(resourceEntry.resource.crud.read
        ? [
            {
              path: trimLeadingSlash(
                `apps/web/app${resourceEntry.listPath}/[${getProductResourceParamName(
                  resourceEntry
                )}]/page.tsx`
              ),
              contents: renderProductResourceDetailPage(product, resourceEntry)
            }
          ]
        : []),
      ...(resourceEntry.resource.crud.update
        ? [
            {
              path: trimLeadingSlash(
                `apps/web/app${resourceEntry.listPath}/[${getProductResourceParamName(
                  resourceEntry
                )}]/edit/page.tsx`
              ),
              contents: renderProductResourceEditPage(product, resourceEntry)
            }
          ]
        : [])
    ])
  ] satisfies readonly PendingProductFile[];
}

function renderDomainProductFile(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);
  const manifest = {
    capabilities: [
      {
        description: `Provides the ${product.name} product shell.`,
        id: `${product.id}-ui`,
        kind: "ui"
      },
      {
        description: `Provides the ${product.name} workspace navigation.`,
        id: `${product.id}-navigation`,
        kind: "navigation"
      },
      ...product.resources.map((resourceEntry: GeneratedProductResource) => ({
        description: `Provides the ${resourceEntry.resource.pluralLabel.toLowerCase()} resource slice.`,
        id: `${product.id}-${resourceEntry.resource.resource}`,
        kind: "resource"
      }))
    ],
    chrome: {
      errorHeading: `Unable to load ${product.name}`,
      loadingLabel: `Loading ${product.name}...`,
      metadataDescription:
        product.description ?? `${product.name} workspace generated by Elioric`,
      metadataTitle: product.name
    },
    description:
      product.description ??
      `${product.name} is a CLI-generated Elioric product module.`,
    emptyStateCopy: {
      emptyStateDescription:
        product.home?.description ??
        `Open ${product.resources[0]!.navLabel.toLowerCase()} to start using ${product.name}.`,
      emptyStateTitle: product.home?.title ?? `${product.name} workspace`,
      primaryCtaHref: `/${product.id}`,
      primaryCtaLabel: product.home?.ctaLabel ?? `Open ${product.name}`
    },
    id: product.id,
    name: product.name,
    navItems: [
      {
        href: `/${product.id}`,
        id: `${product.id}-home`,
        label: product.name
      },
      ...product.resources.map((resourceEntry: GeneratedProductResource) => ({
        href: resourceEntry.listPath,
        id: `${product.id}-${toKebabCase(resourceEntry.resource.pluralLabel)}`,
        label: resourceEntry.navLabel
      }))
    ],
    onboardingContent: {
      completeSummaryDescription: `${product.name} setup is complete.`,
      dismissFromSidebarLabel: "Dismiss from sidebar",
      eyebrow: `${product.name} setup`,
      incompleteSummaryDescription:
        `${product.name} does not require additional setup for the initial generated proof.`,
      showInSidebarLabel: "Show in sidebar",
      stepContent: [],
      title: `${product.name} getting started`
    },
    onboardingSteps: [],
    resources: product.resources.map((resourceEntry) => ({
      id: resourceEntry.resource.resource,
      navigationId: `${product.id}-${toKebabCase(resourceEntry.resource.pluralLabel)}`,
      ownership: resourceEntry.resource.ownership,
      routeBasePath: resourceEntry.listPath
    })),
    runtime: {
      registrations: []
    },
    usageMeters: [
      {
        key: product.id,
        label: product.name
      }
    ],
    workspaceSettings: {
      planUsage: {
        emptyStateDescription:
          `${product.name} usage will appear here once product-specific limits are added.`,
        metrics: {
          currentPlan: "Current plan",
          includedUnits: `Included ${product.resources[0]!.resource.pluralLabel.toLowerCase()}`,
          remainingUnits: `Remaining ${product.resources[0]!.resource.pluralLabel.toLowerCase()}`,
          usedThisMonth: "Created this month"
        },
        navDescription: `Track how ${product.name} will use your workspace plan.`,
        navLabel: `${product.name} usage`,
        noPermissionDescription:
          `You do not have permission to inspect ${product.name} usage for this workspace.`,
        resetDatePrefix: "Usage resets",
        sectionDescription:
          `This generated product currently reuses the shared workspace plan surface.`,
        sectionTitle: `${product.name} plan & usage`,
        selectedPlanSuffix: "selected",
        switchToPlanPrefix: "Switch to",
        usageWindowPrefix: "Usage window"
      }
    }
  };

  return [
    'import type {',
    "  ProductDefinition,",
    "  ProductModuleManifest",
    '} from "../product/index.js";',
    "",
    `type ${pascalName}ProductDefinition = ProductModuleManifest &`,
    "  ProductDefinition & {",
    "    chrome: {",
    "      errorHeading: string;",
    "      loadingLabel: string;",
    "      metadataDescription: string;",
    "      metadataTitle: string;",
    "    };",
    "    workspaceSettings: {",
    "      planUsage: {",
    "        emptyStateDescription: string;",
    "        metrics: {",
    "          currentPlan: string;",
    "          includedUnits: string;",
    "          remainingUnits: string;",
    "          usedThisMonth: string;",
    "        };",
    "        navDescription: string;",
    "        navLabel: string;",
    "        noPermissionDescription: string;",
    "        resetDatePrefix: string;",
    "        sectionDescription: string;",
    "        sectionTitle: string;",
    "        selectedPlanSuffix: string;",
    "        switchToPlanPrefix: string;",
    "        usageWindowPrefix: string;",
    "      };",
    "    };",
    "  };",
    "",
    `export const ${camelCase(product.id)}Product = ${JSON.stringify(
      manifest,
      null,
      2
    )} satisfies ${pascalName}ProductDefinition;`
  ].join("\n");
}

function renderDomainProductModuleFile(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);
  const camelName = camelCase(product.id);

  return [
    'import type {',
    "  ProductModuleOnboardingCopy,",
    "  ProductModuleOnboardingStepView,",
    "  ProductModuleShellConfig,",
    "  ProductModuleWorkspaceScope,",
    "  RegisteredProductModule",
    '} from "../product/runtime-module.js";',
    "",
    `import { ${camelName}Product } from "./product.js";`,
    "",
    `const ${camelName}OnboardingCopy: ProductModuleOnboardingCopy = {`,
    `  completeSummaryDescription:`,
    `    ${camelName}Product.onboardingContent.completeSummaryDescription,`,
    `  dismissFromSidebarLabel:`,
    `    ${camelName}Product.onboardingContent.dismissFromSidebarLabel,`,
    `  emptyStateDescription: ${camelName}Product.emptyStateCopy.emptyStateDescription,`,
    `  emptyStatePrimaryCtaHref: ${camelName}Product.emptyStateCopy.primaryCtaHref ?? "/${product.id}",`,
    `  emptyStatePrimaryCtaLabel:`,
    `    ${camelName}Product.emptyStateCopy.primaryCtaLabel ?? "Open ${product.name}",`,
    `  eyebrow: ${camelName}Product.onboardingContent.eyebrow,`,
    `  incompleteSummaryDescription:`,
    `    ${camelName}Product.onboardingContent.incompleteSummaryDescription,`,
    `  showInSidebarLabel: ${camelName}Product.onboardingContent.showInSidebarLabel,`,
    `  title: ${camelName}Product.onboardingContent.title`,
    "};",
    "",
    "function buildWorkspaceSuffix(input: ProductModuleWorkspaceScope) {",
    "  if (!input.activeOrganizationId) {",
    '    return "";',
    "  }",
    "",
    "  const query = new URLSearchParams({",
    "    organizationId: input.activeOrganizationId",
    "  });",
    "",
    "  if (input.activeProjectId) {",
    '    query.set("projectId", input.activeProjectId);',
    "  }",
    "",
    "  return `?${query.toString()}`;",
    "}",
    "",
    "function toScopedHref(baseHref: string, workspaceSuffix: string) {",
    "  return workspaceSuffix ? `${baseHref}${workspaceSuffix}` : baseHref;",
    "}",
    "",
    `export const ${camelName}ProductModule = {`,
    `  manifest: ${camelName}Product,`,
    "  buildOnboardingStepViews(",
    `    _input: Parameters<RegisteredProductModule["buildOnboardingStepViews"]>[0]`,
    "  ): ProductModuleOnboardingStepView[] {",
    "    return [];",
    "  },",
    "  getChrome() {",
    `    return ${camelName}Product.chrome;`,
    "  },",
    "  getOnboardingScreenCopy() {",
    `    return ${camelName}OnboardingCopy;`,
    "  },",
    '  getRuntimeRegistrations(surface: "api" | "web" | "worker") {',
    `    const registrations = ${camelName}Product.runtime.registrations as RegisteredProductModule["manifest"]["runtime"]["registrations"];`,
    `    return registrations.filter(`,
    "      (registration) => registration.surface === surface",
    "    );",
    "  },",
    "  getShellProductConfig(input: ProductModuleWorkspaceScope): ProductModuleShellConfig {",
    "    const workspaceSuffix = buildWorkspaceSuffix(input);",
    "",
    "    return {",
    `      navItems: ${camelName}Product.navItems.map((item) => ({`,
    "        href: toScopedHref(item.href, workspaceSuffix),",
    "        id: item.id,",
    "        label: item.label",
    "      })),",
    `      productName: ${camelName}Product.name`,
    "    };",
    "  },",
    "  getWorkspaceSettingsCopy() {",
    `    return ${camelName}Product.workspaceSettings;`,
    "  }",
    "} satisfies RegisteredProductModule;"
  ].join("\n");
}

function renderDomainProductModuleTest(product: GeneratedProductSpec) {
  const camelName = camelCase(product.id);
  const expectedNav = [
    {
      href: `/${product.id}?organizationId=org-1&projectId=project-1`,
      id: `${product.id}-home`,
      label: product.name
    },
    ...product.resources.map((resourceEntry: GeneratedProductResource) => ({
      href: `${resourceEntry.listPath}?organizationId=org-1&projectId=project-1`,
      id: `${product.id}-${toKebabCase(resourceEntry.resource.pluralLabel)}`,
      label: resourceEntry.navLabel
    }))
  ];

  return [
    'import { describe, expect, it } from "vitest";',
    "",
    `import { ${camelName}ProductModule } from "../product-module.js";`,
    "",
    `describe("${camelName}ProductModule", () => {`,
    `  it("builds scoped shell navigation for ${product.name}", () => {`,
    "    expect(",
    `      ${camelName}ProductModule.getShellProductConfig({`,
    '        activeOrganizationId: "org-1",',
    '        activeProjectId: "project-1"',
    "      })",
    "    ).toEqual({",
    `      navItems: ${JSON.stringify(expectedNav, null, 2).replace(/^/gm, "      ")},`,
    `      productName: ${JSON.stringify(product.name)}`,
    "    });",
    "  });",
    "",
    `  it("keeps ${product.name} onboarding empty for the first generated slice", () => {`,
    "    expect(",
    `      ${camelName}ProductModule.buildOnboardingStepViews({`,
    "        activeOnboarding: { steps: [] },",
    '        activeOrganizationId: "org-1"',
    "      })",
    "    ).toEqual([]);",
    "  });",
    "});"
  ].join("\n");
}

function renderProductHomeScreen(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);

  return [
    'import Link from "next/link";',
    'import type { Route } from "next";',
    "",
    'import { EmptyState } from "@/src/components/ui/empty-state";',
    'import { PageShell } from "@/src/components/ui/page-shell";',
    "",
    `export function ${pascalName}HomeScreen(input: {`,
    "  organizationName?: string;",
    "  resourceLinks: readonly {",
    "    href: string;",
    "    label: string;",
    "  }[];",
    "}) {",
    "  return (",
    "    <PageShell>",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-2">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${product.name}</p>`,
    '          <h1 className="text-3xl font-semibold text-[var(--foreground)]">',
    "            {input.organizationName",
    `              ? \`${"${input.organizationName}"} ${product.name.toLowerCase()}\``,
    `              : ${JSON.stringify(product.home?.title ?? `${product.name} workspace`)}}`,
    "          </h1>",
    `          <p className="max-w-2xl text-sm text-[var(--muted)]">${product.home?.description ?? product.description ?? `${product.name} generated workspace`}</p>`,
    "        </header>",
    "        {input.resourceLinks.length === 0 ? (",
    `          <EmptyState label=${JSON.stringify(`No workspace with the ${product.name} product is enabled for this account yet.`)} />`,
    "        ) : (",
    '          <div className="flex flex-wrap gap-3">',
    "            {input.resourceLinks.map((resourceLink) => (",
    "              <Link",
    '                key={resourceLink.href}',
    '                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"',
    "                href={resourceLink.href as Route}",
    "              >",
    "                {resourceLink.label}",
    "              </Link>",
    "            ))}",
    "          </div>",
    "        )}",
    "      </div>",
    "    </PageShell>",
    "  );",
    "}"
  ].join("\n");
}

function renderProductHomePage(product: GeneratedProductSpec) {
  const pascalName = toPascalCase(product.id);

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    'import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";',
    `import { ${pascalName}HomeScreen } from "@/src/features/${product.id}-product";`,
    "",
    'import { getProductMetadata, getShellProductConfig } from "@/app/product-module";',
    "",
    `export const metadata = getProductMetadata(${JSON.stringify(product.id)});`,
    "",
    "interface ProductPageProps {",
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ProductPage({ searchParams }: ProductPageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedSearchParams = await searchParams;",
    "  const workspace = resolveWorkspaceContext(",
    "    currentUser,",
    "    {",
    "      organizationId: getSearchValue(resolvedSearchParams.organizationId),",
    "      projectId: getSearchValue(resolvedSearchParams.projectId)",
    "    },",
    "    {",
    `      requiredProductId: ${JSON.stringify(product.id)}`,
    "    }",
    "  );",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: workspace.activeOrganizationId,",
    "    activeProjectId: workspace.activeProjectId,",
    "    installedProducts: workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "  const workspaceSuffix = buildWorkspaceSuffix(",
    "    workspace.activeOrganizationId,",
    "    workspace.activeProjectId",
    "  );",
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={workspace.activeOrganizationId}",
    "      activeProjectId={workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    `      <${pascalName}HomeScreen`,
    "        organizationName={workspace.activeOrganization?.name}",
    "        resourceLinks={",
    "          workspace.activeOrganizationId",
    "            ? [",
    ...product.resources.map((resourceEntry: GeneratedProductResource) =>
      `                { href: \`${resourceEntry.listPath}${"${workspaceSuffix}"}\`, label: ${JSON.stringify(
        resourceEntry.navLabel
      )} },`
    ),
    "              ]",
    "            : []",
    "        }",
    "      />",
    "    </AppShell>",
    "  );",
    "}",
    "function buildWorkspaceSuffix(",
    "  organizationId?: string,",
    "  projectId?: string",
    ") {",
    "  if (!organizationId) {",
    '    return "";',
    "  }",
    "",
    "  const query = new URLSearchParams();",
    '  query.set("organizationId", organizationId);',
    "",
    "  if (projectId) {",
    '    query.set("projectId", projectId);',
    "  }",
    "",
    "  return `?${query.toString()}`;",
    "}",
    "",
    "function getSearchValue(value: string | string[] | undefined) {",
    '  return Array.isArray(value) ? value[0] : value;',
    "}"
  ].join("\n");
}

function renderProductResourceServerFile(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const workspaceFunction = `${pascalResource}WorkspacePage`;
  const detailFunction = `${pascalResource}WorkspaceDetailPage`;
  const paramName = getProductResourceParamName(resourceEntry);
  const detailPath = resourceEntry.listPath;
  const generatedRelationTargets = getResolvableGeneratedRelationTargets(
    product,
    resourceEntry
  );
  const hasRelationFormOptions =
    resourceEntry.resource.relations.some(
      (relation) =>
        (relation.targetScope === "platform" && relation.target === "project") ||
        relation.targetScope === "generated"
    );
  const hasRelationPresentations =
    resourceEntry.resource.relations.some(
      (relation) =>
        relation.targetScope === "platform" && relation.target === "project"
    ) || generatedRelationTargets.length > 0;
  const workspaceUnavailableFeedback = `Enable the ${product.name} product for a workspace before managing ${resourceEntry.resource.pluralLabel.toLowerCase()}.`;

  return [
    'import "server-only";',
    "",
    'import { revalidatePath } from "next/cache";',
    'import { redirect } from "next/navigation";',
    'import { ZodError } from "zod";',
    "",
    `import { create${pascalResource}InputSchema, update${pascalResource}InputSchema } from "@auditrail/domain/generated/${toKebabCase(resourceId)}";`,
    "",
    'import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";',
    `import type { ${pascalResource}Record } from "@/src/features/${toKebabCase(resourceId)}/domain/schemas";`,
    'import { createServerApiClient } from "@/src/lib/api/server-api-client";',
    'import { resolveWorkspaceContext } from "@/src/features/organizations/domain/workspace";',
    `import { createResourceClient } from "@/src/features/${toKebabCase(resourceId)}/api/${toKebabCase(
      resourceId
    )}-client";`,
    ...renderProductRelationClientImports(generatedRelationTargets),
    "",
    `export async function load${workspaceFunction}(`,
    "  searchParams: Record<string, string | string[] | undefined>,",
    "  dependencies: {",
    "    currentUser: CurrentUserResponse;",
    "  }",
    ") {",
    "  const workspace = resolveWorkspaceContext(",
    "    dependencies.currentUser,",
    "    {",
    '      organizationId: getSearchValue(searchParams.organizationId),',
    '      projectId: getSearchValue(searchParams.projectId)',
    "    },",
    "    {",
    `      requiredProductId: ${JSON.stringify(product.id)}`,
    "    }",
    "  );",
    "  const listQuery = readListQuery(searchParams);",
    `  const listResponse = workspace.activeOrganizationId`,
    `    ? await createResourceClient(createServerApiClient()).list(`,
    "        workspace.activeOrganizationId,",
    "        listQuery",
    "      )",
    '    : { items: [], pageInfo: { hasMore: false, nextCursor: null } };',
    hasRelationFormOptions
      ? [
          `  const formOptions = await resolve${pascalResource}FormOptions({`,
          "    organizationId: workspace.activeOrganizationId,",
          "    projectId: workspace.activeProjectId,",
          "    workspace",
          "  });"
        ].join("\n")
      : "  const formOptions = {};",
    hasRelationPresentations
      ? [
          `  const relationPresentations = await resolve${pascalResource}RelationPresentations({`,
          "    items: listResponse.items,",
          "    organizationId: workspace.activeOrganizationId,",
          "    projectId: workspace.activeProjectId,",
          "    workspace",
          "  });"
        ].join("\n")
      : `  const relationPresentations = {};`,
    "",
    "  return {",
    "    draftValues: readDraftValues(searchParams),",
    "    fieldErrors: readFieldErrors(searchParams),",
    "    feedback: readFeedback(searchParams),",
    "    formOptions,",
    "    items: listResponse.items,",
    "    listQuery,",
    "    pageInfo: listResponse.pageInfo,",
    "    relationPresentations,",
    "    workspace",
    "  };",
    "}",
    "",
    `export async function load${detailFunction}(`,
    "  input: {",
    `    ${paramName}: string;`,
    "    searchParams: Record<string, string | string[] | undefined>;",
    "  },",
    "  dependencies: {",
    "    currentUser: CurrentUserResponse;",
    "  }",
    ") {",
    "  const workspace = resolveWorkspaceContext(",
    "    dependencies.currentUser,",
    "    {",
    '      organizationId: getSearchValue(input.searchParams.organizationId),',
    '      projectId: getSearchValue(input.searchParams.projectId)',
    "    },",
    "    {",
    `      requiredProductId: ${JSON.stringify(product.id)}`,
    "    }",
    "  );",
    "  const listQuery = readListQuery(input.searchParams);",
    `  const item = workspace.activeOrganizationId`,
    `    ? await createResourceClient(createServerApiClient()).get(`,
    "        workspace.activeOrganizationId,",
    `        input.${paramName}`,
    "      )",
    "    : null;",
    hasRelationFormOptions
      ? [
          `  const formOptions = await resolve${pascalResource}FormOptions({`,
          "    organizationId: workspace.activeOrganizationId,",
          "    projectId: workspace.activeProjectId,",
          "    workspace",
          "  });"
        ].join("\n")
      : "  const formOptions = {};",
    hasRelationPresentations
      ? [
          `  const relationPresentations = item`,
          `    ? await resolve${pascalResource}RelationPresentations({`,
          "        items: [item],",
          "        organizationId: workspace.activeOrganizationId,",
          "        projectId: workspace.activeProjectId,",
          "        workspace",
          "      })",
          "    : {};"
        ].join("\n")
      : `  const relationPresentations = {};`,
    "",
    "  return {",
    "    draftValues: readDraftValues(input.searchParams),",
    "    fieldErrors: readFieldErrors(input.searchParams),",
    "    feedback: readFeedback(input.searchParams),",
    "    formOptions,",
    "    item,",
    "    listQuery,",
    "    relationPresentations,",
    "    workspace",
    "  };",
    "}",
    "",
    `export async function create${pascalResource}WorkspaceAction(formData: FormData) {`,
    '  "use server";',
    "",
    '  const organizationId = String(formData.get("organizationId") ?? "");',
    '  const projectId = coerceString(formData.get("projectId"));',
    "  const listQuery = readListQueryFromFormData(formData);",
    "",
    "  if (!organizationId.trim()) {",
    "    return redirect(",
    `      buildFailurePath(${JSON.stringify(resourceEntry.listPath)}, "", projectId, listQuery, {`,
    "        draftValues: buildDraftValues(formData),",
    `        feedback: ${JSON.stringify(workspaceUnavailableFeedback)}`,
    "      }) as never",
    "    );",
    "  }",
    "",
    `  try {`,
    `    const payload = create${pascalResource}InputSchema.parse({`,
    ...renderCreateActionObjectLines(resourceEntry.resource).map(
      (line: string) => `      ${line}`
    ),
    "    });",
    "",
    "    await createResourceClient(createServerApiClient()).create(",
    "      organizationId,",
    "      payload",
    "    );",
    "",
    `    const nextPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId, listQuery);`,
    "    revalidatePath(nextPath);",
    "    redirect(nextPath as never);",
    "  } catch (error) {",
    "    const validationState = getValidationState(error, \"Unable to create this record right now.\");",
    "    redirect(",
    `      buildFailurePath(${JSON.stringify(resourceEntry.listPath)}, organizationId, projectId, listQuery, {`,
    "        draftValues: buildDraftValues(formData),",
    "        feedback: validationState.feedback,",
    "        fieldErrors: validationState.fieldErrors",
    "      }) as never",
    "    );",
    "  }",
    "}",
    "",
    `export async function update${pascalResource}WorkspaceAction(formData: FormData) {`,
    '  "use server";',
    "",
    `  const ${paramName} = String(formData.get(${JSON.stringify(paramName)}) ?? "");`,
    '  const organizationId = String(formData.get("organizationId") ?? "");',
    '  const projectId = coerceString(formData.get("projectId"));',
    "  const listQuery = readListQueryFromFormData(formData);",
    "",
    "  if (!organizationId.trim()) {",
    "    return redirect(",
    `      buildFailurePath(buildResourceEditPath(${JSON.stringify(detailPath)}, ${paramName}), "", projectId, listQuery, {`,
    "        draftValues: buildDraftValues(formData),",
    `        feedback: ${JSON.stringify(workspaceUnavailableFeedback)}`,
    "      }) as never",
    "    );",
    "  }",
    "",
    `  try {`,
    `    const payload = update${pascalResource}InputSchema.parse({`,
    ...renderCreateActionObjectLines(resourceEntry.resource).map(
      (line: string) => `      ${line}`
    ),
    "    });",
    "",
    "    await createResourceClient(createServerApiClient()).update(",
    "      organizationId,",
    `      ${paramName},`,
    "      payload",
    "    );",
    "",
    `    const nextPath = buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, organizationId, projectId, listQuery, { includeCursor: true });`,
    `    const listPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId, listQuery);`,
    "    revalidatePath(nextPath);",
    "    revalidatePath(listPath);",
    "    redirect(nextPath as never);",
    "  } catch (error) {",
    "    const validationState = getValidationState(error, \"Unable to save changes right now.\");",
    "    redirect(",
    `      buildFailurePath(buildResourceEditPath(${JSON.stringify(detailPath)}, ${paramName}), organizationId, projectId, listQuery, {`,
    "        draftValues: buildDraftValues(formData),",
    "        feedback: validationState.feedback,",
    "        fieldErrors: validationState.fieldErrors",
    "      }) as never",
    "    );",
    "  }",
    "}",
    resourceEntry.resource.crud.delete
      ? [
          "",
          `export async function delete${pascalResource}WorkspaceAction(formData: FormData) {`,
          '  "use server";',
          "",
          `  const ${paramName} = String(formData.get(${JSON.stringify(paramName)}) ?? "");`,
          '  const organizationId = String(formData.get("organizationId") ?? "");',
          '  const projectId = coerceString(formData.get("projectId"));',
          "  const listQuery = readListQueryFromFormData(formData);",
          "",
          "  if (!organizationId.trim()) {",
          "    return redirect(",
          `      buildFailurePath(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, "", projectId, listQuery), "", projectId, listQuery, {`,
          `        feedback: ${JSON.stringify(workspaceUnavailableFeedback)}`,
          "      }) as never",
          "    );",
          "  }",
          "",
          "  try {",
          "    await createResourceClient(createServerApiClient()).delete(",
          "      organizationId,",
          `      ${paramName}`,
          "    );",
          "",
          `    const listPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId, listQuery);`,
          "    revalidatePath(listPath);",
          "    redirect(listPath as never);",
          "  } catch (error) {",
          '    const validationState = getValidationState(error, "Unable to delete this record right now.");',
          "    redirect(",
          `      buildFailurePath(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {`,
          "        feedback: validationState.feedback,",
          "        fieldErrors: validationState.fieldErrors",
          "      }) as never",
          "    );",
          "  }",
          "}"
        ].join("\n")
      : "",
    resourceEntry.resource.archive.enabled
      ? [
          "",
          `export async function archive${pascalResource}WorkspaceAction(formData: FormData) {`,
          '  "use server";',
          "",
          `  const ${paramName} = String(formData.get(${JSON.stringify(paramName)}) ?? "");`,
          '  const organizationId = String(formData.get("organizationId") ?? "");',
          '  const projectId = coerceString(formData.get("projectId"));',
          "  const listQuery = readListQueryFromFormData(formData);",
          "",
          "  if (!organizationId.trim()) {",
          "    return redirect(",
          `      buildFailurePath(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, "", projectId, listQuery), "", projectId, listQuery, {`,
          `        feedback: ${JSON.stringify(workspaceUnavailableFeedback)}`,
          "      }) as never",
          "    );",
          "  }",
          "",
          "  try {",
          "    await createResourceClient(createServerApiClient()).archive(",
          "      organizationId,",
          `      ${paramName}`,
          "    );",
          "",
          `    const listPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId, listQuery);`,
          "    const detailPath = buildResourcePath(",
          `      ${JSON.stringify(detailPath)},`,
          `      ${paramName},`,
          "      organizationId,",
          "      projectId,",
          "      { ...listQuery, archived: listQuery.archived === \"only\" ? \"only\" : \"exclude\" }",
          "    );",
          "    revalidatePath(listPath);",
          "    revalidatePath(detailPath);",
          "    redirect(listPath as never);",
          "  } catch (error) {",
          '    const validationState = getValidationState(error, "Unable to archive this record right now.");',
          "    redirect(",
          `      buildFailurePath(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {`,
          "        feedback: validationState.feedback,",
          "        fieldErrors: validationState.fieldErrors",
          "      }) as never",
          "    );",
          "  }",
          "}",
          "",
          `export async function unarchive${pascalResource}WorkspaceAction(formData: FormData) {`,
          '  "use server";',
          "",
          `  const ${paramName} = String(formData.get(${JSON.stringify(paramName)}) ?? "");`,
          '  const organizationId = String(formData.get("organizationId") ?? "");',
          '  const projectId = coerceString(formData.get("projectId"));',
          "  const listQuery = readListQueryFromFormData(formData);",
          "",
          "  if (!organizationId.trim()) {",
          "    return redirect(",
          `      buildFailurePath(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, "", projectId, listQuery), "", projectId, listQuery, {`,
          `        feedback: ${JSON.stringify(workspaceUnavailableFeedback)}`,
          "      }) as never",
          "    );",
          "  }",
          "",
          "  try {",
          "    await createResourceClient(createServerApiClient()).unarchive(",
          "      organizationId,",
          `      ${paramName}`,
          "    );",
          "",
          `    const listPath = ${JSON.stringify(resourceEntry.listPath)} + buildWorkspaceSuffix(organizationId, projectId, { ...listQuery, archived: listQuery.archived === "only" ? "exclude" : listQuery.archived });`,
          "    revalidatePath(listPath);",
          `    redirect(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, organizationId, projectId, { ...listQuery, archived: "exclude" }) as never);`,
          "  } catch (error) {",
          '    const validationState = getValidationState(error, "Unable to restore this record right now.");',
          "    redirect(",
          `      buildFailurePath(buildResourcePath(${JSON.stringify(detailPath)}, ${paramName}, organizationId, projectId, listQuery), organizationId, projectId, listQuery, {`,
          "        feedback: validationState.feedback,",
          "        fieldErrors: validationState.fieldErrors",
          "      }) as never",
          "    );",
          "  }",
          "}"
        ].join("\n")
      : "",
    "",
    `type ${pascalResource}RelationPresentation = {`,
    "  href?: string;",
    "  label: string;",
    "};",
    "",
    `type ${pascalResource}RelationPresentations = Record<`,
    "  string,",
    `  Partial<Record<string, ${pascalResource}RelationPresentation>>`,
    ">;",
    "",
    `type ${pascalResource}FormFieldErrors = Partial<Record<keyof ${pascalResource}Record, string>>;`,
    "",
    `type ${pascalResource}FormOption = {`,
    "  label: string;",
    "  value: string;",
    "};",
    "",
    `type ${pascalResource}FormOptions = Partial<`,
    `  Record<keyof ${pascalResource}Record, readonly ${pascalResource}FormOption[]>`,
    ">;",
    "",
    `async function resolve${pascalResource}FormOptions(input: {`,
    "  organizationId?: string;",
    "  projectId?: string;",
    "  workspace: ReturnType<typeof resolveWorkspaceContext>;",
    `}): Promise<${pascalResource}FormOptions> {`,
    `  const options: ${pascalResource}FormOptions = {};`,
    "",
    ...renderFormOptionResolverLines(product, resourceEntry).map((line) => `  ${line}`),
    "",
    "  return options;",
    "}",
    "",
    `async function resolve${pascalResource}RelationPresentations(input: {`,
    `  items: readonly ${pascalResource}Record[];`,
    "  organizationId?: string;",
    "  projectId?: string;",
    "  workspace: ReturnType<typeof resolveWorkspaceContext>;",
    `}): Promise<${pascalResource}RelationPresentations> {`,
    `  const presentations: ${pascalResource}RelationPresentations = {};`,
    "",
    "  if (input.items.length === 0) {",
    "    return presentations;",
    "  }",
    "",
    "  for (const item of input.items) {",
    "    presentations[item.id] = {};",
    "  }",
    "",
    ...renderRelationPresentationResolverLines(product, resourceEntry).map(
      (line) => `  ${line}`
    ),
    "",
    "  return compactRelationPresentations(presentations);",
    "}",
    "",
    `function compactRelationPresentations(`,
    `  presentations: ${pascalResource}RelationPresentations`,
    `): ${pascalResource}RelationPresentations {`,
    "  return Object.fromEntries(",
    "    Object.entries(presentations).map(([recordId, value]) => [",
    "      recordId,",
    "      Object.fromEntries(",
    "        Object.entries(value).filter(([, relation]) => relation !== undefined)",
    "      )",
    "    ])",
    `  ) as ${pascalResource}RelationPresentations;`,
    "}",
    "",
    `type ${pascalResource}ListQuery = ${renderProductListQueryType(resourceEntry.resource)};`,
    "",
    "function buildWorkspaceSuffix(",
    "  organizationId: string,",
    "  projectId: string | undefined,",
    `  query: ${pascalResource}ListQuery,`,
    "  options?: {",
    "    includeCursor?: boolean;",
    "  }",
    ") {",
    "  const search = new URLSearchParams();",
    "",
    "  if (organizationId) {",
    '    search.set("organizationId", organizationId);',
    "  }",
    "",
    "  if (projectId) {",
    '    search.set("projectId", projectId);',
    "  }",
    "",
    "  for (const [key, value] of Object.entries({",
    ...renderProductListQueryEntries(resourceEntry.resource),
    "  })) {",
    "    if (value === undefined || value === null || value === \"\") {",
    "      continue;",
    "    }",
    "",
    "    search.set(key, String(value));",
    "  }",
    "",
    "  if (options?.includeCursor && query.cursor) {",
    '    search.set("cursor", query.cursor);',
    "  }",
    "",
    "  return `?${search.toString()}`;",
    "}",
    "",
    "function buildResourcePath(",
    "  basePath: string,",
    "  id: string,",
    "  organizationId: string,",
    "  projectId?: string,",
    `  query?: ${pascalResource}ListQuery,`,
    "  options?: {",
    "    includeCursor?: boolean;",
    "  }",
    ") {",
    `  return \`${"${basePath}"}/${"${id}"}\${buildWorkspaceSuffix(organizationId, projectId, query ?? readDefaultListQuery(), options)}\`;`,
    "}",
    "",
    "function buildResourceEditPath(basePath: string, id: string) {",
    "  return `${basePath}/${id}/edit`;",
    "}",
    "",
    "function buildFailurePath(",
    "  basePath: string,",
    "  organizationId: string,",
    "  projectId: string | undefined,",
    `  query: ${pascalResource}ListQuery,`,
    "  input: {",
    "    draftValues?: Record<string, string | undefined>;",
    "    feedback: string;",
    `    fieldErrors?: ${pascalResource}FormFieldErrors;`,
    "  }",
    ") {",
    "  const search = new URLSearchParams();",
    "",
    "  if (organizationId) {",
    '    search.set("organizationId", organizationId);',
    "  }",
    "",
    "  if (projectId) {",
    '    search.set("projectId", projectId);',
    "  }",
    "",
    "  for (const [key, value] of Object.entries({",
    ...renderProductListQueryEntries(resourceEntry.resource),
    "  })) {",
    "    if (value === undefined || value === null || value === \"\") {",
    "      continue;",
    "    }",
    "",
    "    search.set(key, String(value));",
    "  }",
    "",
    '  search.set("feedback", input.feedback);',
    "",
    "  for (const [key, value] of Object.entries(input.fieldErrors ?? {})) {",
    "    if (typeof value === \"string\" && value.length > 0) {",
    '      search.set(`error_${key}`, value);',
    "    }",
    "  }",
    "",
    "  for (const [key, value] of Object.entries(input.draftValues ?? {})) {",
    "    if (value !== undefined && value.length > 0) {",
    '      search.set(`draft_${key}`, value);',
    "    }",
    "  }",
    "",
    "  return `${basePath}?${search.toString()}`;",
    "}",
    "",
    "function getSearchValue(value: string | string[] | undefined) {",
    '  return Array.isArray(value) ? value[0] : value;',
    "}",
    "",
    "function readAllowedValue<T extends string>(value: string | undefined, allowed: readonly T[]) {",
    "  return value && allowed.includes(value as T) ? (value as T) : undefined;",
    "}",
    "",
    "function readPositiveInteger(value: string | undefined) {",
    "  if (!value) {",
    "    return undefined;",
    "  }",
    "",
    "  const parsed = Number.parseInt(value, 10);",
    "",
    "  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;",
    "}",
    "",
    "function readFeedback(searchParams: Record<string, string | string[] | undefined>) {",
    '  const feedback = getSearchValue(searchParams.feedback);',
    "",
    "  return feedback ? feedback : undefined;",
    "}",
    "",
    "function readFieldErrors(searchParams: Record<string, string | string[] | undefined>) {",
    "  return compactFieldErrors({",
    ...resourceEntry.resource.fields
      .filter((field) => !field.hidden)
      .map(
        (field) =>
          `    ${field.name}: getSearchValue(searchParams.${`error_${field.name}`}) ?? undefined,`
      ),
    `  }) as ${pascalResource}FormFieldErrors;`,
    "}",
    "",
    `function readDefaultListQuery(): ${pascalResource}ListQuery {`,
    "  return {",
    ...renderProductDefaultListQueryLines(resourceEntry.resource),
    "  };",
    "}",
    "",
    `function readListQuery(searchParams: Record<string, string | string[] | undefined>): ${pascalResource}ListQuery {`,
    "  return {",
    ...renderProductReadListQueryLines(resourceEntry.resource),
    "  };",
    "}",
    "",
    `function readListQueryFromFormData(formData: FormData): ${pascalResource}ListQuery {`,
    "  return {",
    ...renderProductReadFormListQueryLines(resourceEntry.resource),
    "  };",
    "}",
    resourceEntry.resource.archive.enabled
      ? [
          "",
          'function readArchivedFilter(searchParams: Record<string, string | string[] | undefined>): "exclude" | "include" | "only" {',
          '  const archived = getSearchValue(searchParams.archived);',
          "",
          '  return archived === "include" || archived === "only" ? archived : "exclude";',
          "}",
          "",
          'function readArchivedFilterFromFormData(formData: FormData): "exclude" | "include" | "only" {',
          '  const value = coerceString(formData.get("list_archived"));',
          "",
          '  return value === "include" || value === "only" ? value : "exclude";',
          "}"
        ].join("\n")
      : "",
    "",
    "function readDraftValues(searchParams: Record<string, string | string[] | undefined>) {",
    "  return compactDraftValues({",
    ...renderDraftSearchValueLines(resourceEntry.resource).map((line) => `    ${line}`),
    "  });",
    "}",
    "",
    "function buildDraftValues(formData: FormData) {",
    "  return {",
    ...renderDraftFormValueLines(resourceEntry.resource).map((line) => `    ${line}`),
    "  };",
    "}",
    "function compactDraftValues<T extends Record<string, unknown>>(values: T) {",
    "  return Object.fromEntries(",
    "    Object.entries(values).filter(([, value]) => value !== undefined)",
    "  ) as Partial<T>;",
    "}",
    "",
    `function compactFieldErrors(values: Record<string, string | undefined>) {`,
    "  return Object.fromEntries(",
    "    Object.entries(values).filter(([, value]) => typeof value === \"string\" && value.length > 0)",
    "  );",
    "}",
    "",
    "function coerceString(value: FormDataEntryValue | null) {",
    "  if (typeof value !== \"string\") {",
    "    return undefined;",
    "  }",
    "",
    "  const trimmed = value.trim();",
    "",
    "  return trimmed.length > 0 ? trimmed : undefined;",
    "}",
    "",
    "function coerceDatetime(value: FormDataEntryValue | null) {",
    "  const trimmed = coerceString(value);",
    "",
    "  return trimmed ? new Date(trimmed).toISOString() : undefined;",
    "}",
    "",
    "function coerceBoolean(value: FormDataEntryValue | null) {",
    '  return value === "on";',
    "}",
    "",
    "function getValidationState(error: unknown, fallback: string) {",
    "  if (error instanceof ZodError) {",
    "    const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;",
    "    const firstFieldErrors: Record<string, string | undefined> = {};",
    "",
    "    for (const key of Object.keys(flattened)) {",
    "      firstFieldErrors[key] = flattened[key]?.[0];",
    "    }",
    "",
    `    const fieldErrors = compactFieldErrors(firstFieldErrors) as ${pascalResource}FormFieldErrors;`,
    "    const issue = error.issues[0];",
    "",
    "    return {",
    "      feedback: issue?.message ?? fallback,",
    "      fieldErrors",
    "    };",
    "  }",
    "",
    "  if (error instanceof Error && error.message.length > 0) {",
    "    return {",
    "      feedback: error.message,",
    `      fieldErrors: {} as ${pascalResource}FormFieldErrors`,
    "    };",
    "  }",
    "",
    "  return {",
    "    feedback: fallback,",
    `    fieldErrors: {} as ${pascalResource}FormFieldErrors`,
    "  };",
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderProductResourceListPage(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const workspaceUnavailableLabel = `No workspace with the ${product.name} product is enabled for this account yet.`;

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { EmptyState } from "@/src/components/ui/empty-state";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    `import { ${pascalResource}Form } from "@/src/features/${toKebabCase(resourceId)}/components/${toKebabCase(
      resourceId
    )}-form";`,
    `import { ${pascalResource}Screen } from "@/src/features/${toKebabCase(resourceId)}/components/${toKebabCase(
      resourceId
    )}-screen";`,
    "",
    'import { getShellProductConfig } from "@/app/product-module";',
    `import {`,
    `  create${pascalResource}WorkspaceAction,`,
    `  load${pascalResource}WorkspacePage`,
    `} from "@/src/features/${product.id}-product/server/${toKebabCase(resourceId)}-workspace";`,
    "",
    "interface ResourcePageProps {",
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ResourcePage({ searchParams }: ResourcePageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedSearchParams = await searchParams;",
    `  const data = await load${pascalResource}WorkspacePage(resolvedSearchParams, {`,
    "    currentUser",
    "  });",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: data.workspace.activeOrganizationId,",
    "    activeProjectId: data.workspace.activeProjectId,",
    "    installedProducts: data.workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    `  const resourceQuery = data.workspace.activeOrganizationId`,
    "    ? buildWorkspaceSuffix(",
    "        data.workspace.activeOrganizationId,",
    "        data.workspace.activeProjectId ?? undefined,",
    "        data.listQuery,",
    "        { includeCursor: true }",
    "      ).slice(1)",
    '    : "";',
    "  const nextPageHref =",
    "    data.pageInfo.hasMore && data.pageInfo.nextCursor && data.workspace.activeOrganizationId",
    `      ? ${JSON.stringify(resourceEntry.listPath)} +`,
    "        buildWorkspaceSuffix(",
    "          data.workspace.activeOrganizationId,",
    "          data.workspace.activeProjectId ?? undefined,",
    "          { ...data.listQuery, cursor: data.pageInfo.nextCursor },",
    "          { includeCursor: true }",
    "        )",
    "      : null;",
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={data.workspace.activeOrganizationId}",
    "      activeProjectId={data.workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-2">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${resourceEntry.navLabel}</p>`,
    `          <h1 className="text-3xl font-semibold text-[var(--foreground)]">${resourceEntry.navLabel}</h1>`,
    `          <p className="max-w-2xl text-sm text-[var(--muted)]">This generated product route loads real ${resourceEntry.resource.pluralLabel.toLowerCase()} through the API seam and allows inline creation.</p>`,
    "        </header>",
    "        {data.workspace.activeOrganizationId ? (",
    "          <>",
    `            <${pascalResource}Form`,
    `              action={create${pascalResource}WorkspaceAction}`,
    "              defaultValues={data.draftValues}",
    "              fieldErrors={data.fieldErrors}",
    "              formError={data.feedback}",
    "              relationOptions={data.formOptions}",
    `              submitLabel="Create ${resourceEntry.resource.label}"`,
    "            >",
    '              <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId} />',
    '              <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />',
    ...renderProductListHiddenInputs(resourceEntry.resource).map((line) =>
      line.replace("          <", "              <")
    ),
    `            </${pascalResource}Form>`,
    ...renderProductListFilterControls(resourceEntry.resource).map((line) =>
      line
        .replace('value={data.workspace.activeOrganizationId ?? ""}', 'value={data.workspace.activeOrganizationId}')
        .replace(/^        /, "            ")
        .replace(/^      /, "          ")
    ),
    `            <${pascalResource}Screen`,
    "              items={data.items}",
    "              organizationId={data.workspace.activeOrganizationId}",
    "              projectId={data.workspace.activeProjectId ?? undefined}",
    "              relationPresentations={data.relationPresentations}",
    "              resourceQuery={resourceQuery}",
    `              resourceBasePath=${JSON.stringify(resourceEntry.listPath)}`,
    "            />",
    "            {nextPageHref ? (",
    '              <a className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" href={nextPageHref}>Next Page</a>',
    "            ) : null}",
    "          </>",
    "        ) : (",
    `          <EmptyState label=${JSON.stringify(workspaceUnavailableLabel)} />`,
    "        )}",
    "      </div>",
    "    </AppShell>",
    "  );",
    "}",
    "",
    "function buildWorkspaceSuffix(",
    "  organizationId: string,",
    "  projectId: string | undefined,",
    "  query: Record<string, string | number | boolean | undefined> & { cursor?: string },",
    "  options?: {",
    "    includeCursor?: boolean;",
    "  }",
    ") {",
    "  const search = new URLSearchParams();",
    "",
    "  if (organizationId) {",
    '    search.set("organizationId", organizationId);',
    "  }",
    "",
    "  if (projectId) {",
    '    search.set("projectId", projectId);',
    "  }",
    "",
    "  for (const [key, value] of Object.entries({",
    ...renderProductListQueryEntries(resourceEntry.resource),
    "  })) {",
    "    if (value === undefined || value === null || value === \"\") {",
    "      continue;",
    "    }",
    "",
    "    search.set(key, String(value));",
    "  }",
    "",
    "  if (options?.includeCursor && query.cursor) {",
    '    search.set("cursor", query.cursor);',
    "  }",
    "",
    "  return `?${search.toString()}`;",
    "}"
  ].join("\n");
}

function renderProductResourceDetailPage(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const paramName = getProductResourceParamName(resourceEntry);
  const displayField = getProductResourceDisplayField(resourceEntry);
  const workspaceUnavailableLabel = `No workspace with the ${product.name} product is enabled for this account yet.`;

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    "",
    'import { getShellProductConfig } from "@/app/product-module";',
    `import { ${resourceEntry.resource.archive.enabled ? `archive${pascalResource}WorkspaceAction, ` : ""}${resourceEntry.resource.crud.delete ? `delete${pascalResource}WorkspaceAction, ` : ""}load${pascalResource}WorkspaceDetailPage${resourceEntry.resource.archive.enabled ? `, unarchive${pascalResource}WorkspaceAction` : ""} } from "@/src/features/${product.id}-product/server/${toKebabCase(
      resourceId
    )}-workspace";`,
    "",
    "interface ResourceDetailPageProps {",
    `  params: Promise<{ ${paramName}: string }>;`,
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ResourceDetailPage({",
    "  params,",
    "  searchParams",
    "}: ResourceDetailPageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedParams = await params;",
    "  const resolvedSearchParams = await searchParams;",
    `  const data = await load${pascalResource}WorkspaceDetailPage(`,
    "    {",
    `      ${paramName}: resolvedParams.${paramName},`,
    "      searchParams: resolvedSearchParams",
    "    },",
    "    {",
    "      currentUser",
    "    }",
    "  );",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: data.workspace.activeOrganizationId,",
    "    activeProjectId: data.workspace.activeProjectId,",
    "    installedProducts: data.workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "  const workspaceSuffix = data.workspace.activeOrganizationId",
    "    ? buildWorkspaceSuffix(",
    "        data.workspace.activeOrganizationId,",
    "        data.workspace.activeProjectId ?? undefined,",
    "        data.listQuery,",
    "        { includeCursor: true }",
    "      )",
    '    : "";',
    `  const listHref = ${JSON.stringify(resourceEntry.listPath)} + workspaceSuffix;`,
    `  const editHref = data.item ? ${JSON.stringify(resourceEntry.listPath)} + \`/\${data.item.id}/edit\${workspaceSuffix}\` : listHref;`,
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={data.workspace.activeOrganizationId}",
    "      activeProjectId={data.workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-3">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${resourceEntry.resource.label} detail</p>`,
    '          <div className="flex flex-wrap items-center justify-between gap-3">',
    `            <h1 className="text-3xl font-semibold text-[var(--foreground)]">{data.item?.${displayField}?.toString() ?? ${JSON.stringify(
      resourceEntry.resource.label
    )}}</h1>`,
    '            <div className="flex gap-3 text-sm">',
    '              <a className="rounded-md border border-[var(--border)] px-3 py-2" href={listHref}>Back to list</a>',
    '              {data.item ? <a className="rounded-md border border-[var(--border)] px-3 py-2" href={editHref}>Edit</a> : null}',
    "            </div>",
    "          </div>",
    "        </header>",
    "        {data.feedback ? (",
    '          <p className="rounded-md border border-[var(--border)] bg-[var(--panel-muted)] px-3 py-2 text-sm text-[var(--foreground)]">{data.feedback}</p>',
    "        ) : null}",
    "        {!data.workspace.activeOrganizationId ? (",
    `          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">${workspaceUnavailableLabel}</section>`,
    "        ) : data.item ? (",
    '          <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">',
    ...renderProductResourceDetailFields(resourceEntry),
    resourceEntry.resource.crud.delete
      ? [
          '            <form action={delete' + pascalResource + 'WorkspaceAction} className="pt-2">',
          `              <input name="${paramName}" type="hidden" value={data.item.id} />`,
          '              <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId} />',
          '              <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />',
          ...renderProductListHiddenInputs(resourceEntry.resource).map((line) =>
            line.replace("data.", "data.")
          ),
          '              <button className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">Delete ' +
            resourceEntry.resource.label +
            "</button>",
          "            </form>"
        ].join("\n")
      : "",
    resourceEntry.resource.archive.enabled
      ? [
          `            <form action={data.item.${resourceEntry.resource.archive.field} ? unarchive${pascalResource}WorkspaceAction : archive${pascalResource}WorkspaceAction} className="pt-2">`,
          `              <input name="${paramName}" type="hidden" value={data.item.id} />`,
          '              <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId} />',
          '              <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />',
          ...renderProductListHiddenInputs(resourceEntry.resource),
          `              <button className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{data.item.${resourceEntry.resource.archive.field} ? "Restore ${resourceEntry.resource.label}" : "Archive ${resourceEntry.resource.label}"}</button>`,
          "            </form>"
        ].join("\n")
      : "",
    "          </section>",
    "        ) : (",
    '          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">',
    `            ${resourceEntry.resource.label} not found.`,
    "          </section>",
    "        )}",
    "      </div>",
    "    </AppShell>",
    "  );",
    "}",
    "",
    `type ${pascalResource}RelationPresentation = {`,
    "  href?: string;",
    "  label: string;",
    "};",
    "",
    `type ${pascalResource}RelationPresentations = Record<`,
    "  string,",
    `  Partial<Record<string, ${pascalResource}RelationPresentation>>`,
    ">;",
    "",
    "function renderRelationAwareDetailValue(",
    "  recordId: string,",
    "  fieldName: string,",
    "  value: unknown,",
    `  relationPresentations: ${pascalResource}RelationPresentations`,
    ") {",
    "  const relation = relationPresentations[recordId]?.[fieldName];",
    "",
    "  if (relation?.href) {",
    "    return <a href={relation.href}>{relation.label}</a>;",
    "  }",
    "",
    "  if (relation) {",
    "    return relation.label;",
    "  }",
    "",
    "  return value?.toString() ?? \"Not set\";",
    "}",
    "",
    "function buildWorkspaceSuffix(",
    "  organizationId: string,",
    "  projectId: string | undefined,",
    "  query: Record<string, string | number | boolean | undefined> & { cursor?: string },",
    "  options?: {",
    "    includeCursor?: boolean;",
    "  }",
    ") {",
    "  const search = new URLSearchParams();",
    "",
    "  if (organizationId) {",
    '    search.set("organizationId", organizationId);',
    "  }",
    "",
    "  if (projectId) {",
    '    search.set("projectId", projectId);',
    "  }",
    "",
    "  for (const [key, value] of Object.entries({",
    ...renderProductListQueryEntries(resourceEntry.resource),
    "  })) {",
    "    if (value === undefined || value === null || value === \"\") {",
    "      continue;",
    "    }",
    "",
    "    search.set(key, String(value));",
    "  }",
    "",
    "  if (options?.includeCursor && query.cursor) {",
    '    search.set("cursor", query.cursor);',
    "  }",
    "",
    "  return `?${search.toString()}`;",
    "}"
  ].join("\n");
}

function renderProductResourceEditPage(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const resourceId = resourceEntry.resource.resource;
  const pascalResource = toPascalCase(resourceId);
  const paramName = getProductResourceParamName(resourceEntry);
  const workspaceUnavailableLabel = `No workspace with the ${product.name} product is enabled for this account yet.`;

  return [
    'import { AppShell } from "@/src/components/layout/app-shell";',
    'import { requireCurrentUser } from "@/src/features/auth/server/auth-server";',
    `import { ${pascalResource}Form } from "@/src/features/${toKebabCase(resourceId)}/components/${toKebabCase(
      resourceId
    )}-form";`,
    "",
    'import { getShellProductConfig } from "@/app/product-module";',
    `import {`,
    `  load${pascalResource}WorkspaceDetailPage,`,
    `  update${pascalResource}WorkspaceAction`,
    `} from "@/src/features/${product.id}-product/server/${toKebabCase(resourceId)}-workspace";`,
    "",
    "interface ResourceEditPageProps {",
    `  params: Promise<{ ${paramName}: string }>;`,
    "  searchParams: Promise<Record<string, string | string[] | undefined>>;",
    "}",
    "",
    "export default async function ResourceEditPage({",
    "  params,",
    "  searchParams",
    "}: ResourceEditPageProps) {",
    "  const currentUser = await requireCurrentUser();",
    "  const resolvedParams = await params;",
    "  const resolvedSearchParams = await searchParams;",
    `  const data = await load${pascalResource}WorkspaceDetailPage(`,
    "    {",
    `      ${paramName}: resolvedParams.${paramName},`,
    "      searchParams: resolvedSearchParams",
    "    },",
    "    {",
    "      currentUser",
    "    }",
    "  );",
    "  const shellProduct = getShellProductConfig({",
    "    activeOrganizationId: data.workspace.activeOrganizationId,",
    "    activeProjectId: data.workspace.activeProjectId,",
    "    installedProducts: data.workspace.activeOrganizationInstalledProducts,",
    `    preferredProductId: ${JSON.stringify(product.id)}`,
    "  });",
    "",
    "  return (",
    "    <AppShell",
    "      activeOrganizationId={data.workspace.activeOrganizationId}",
    "      activeProjectId={data.workspace.activeProjectId}",
    "      availableProducts={shellProduct.availableProducts}",
    "      currentUser={currentUser}",
    "      productName={shellProduct.productName}",
    "      productNavItems={shellProduct.navItems}",
    "    >",
    '      <div className="grid gap-6">',
    '        <header className="grid gap-2">',
    `          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Edit ${resourceEntry.resource.label}</p>`,
    `          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Edit ${resourceEntry.resource.label}</h1>`,
    `          <p className="max-w-2xl text-sm text-[var(--muted)]">Update the generated ${resourceEntry.resource.label.toLowerCase()} record through the existing API seam.</p>`,
    "        </header>",
    "        {data.workspace.activeOrganizationId ? (",
    `          <${pascalResource}Form`,
    `            action={update${pascalResource}WorkspaceAction}`,
    `            defaultValues={${renderDraftPresenceExpression(resourceEntry.resource)} ? { ...(data.item ?? {}), ...data.draftValues } : data.item ?? undefined}`,
    "            fieldErrors={data.fieldErrors}",
    "            formError={data.feedback}",
    "            relationOptions={data.formOptions}",
    `            submitLabel="Save ${resourceEntry.resource.label}"`,
    "          >",
    `            <input name="${paramName}" type="hidden" value={data.item?.id ?? resolvedParams.${paramName}} />`,
    '            <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId} />',
    '            <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />',
    ...renderProductListHiddenInputs(resourceEntry.resource).map((line) =>
      line.replace("          <", "            <")
    ),
    `          </${pascalResource}Form>`,
    "        ) : (",
    `          <section className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">${workspaceUnavailableLabel}</section>`,
    "        )}",
    "      </div>",
    "    </AppShell>",
    "  );",
    "}"
  ].join("\n");
}

function renderCreateActionObjectLines(resource: GeneratedProductResource["resource"]) {
  return resource.fields
    .filter(
      (field: GeneratedProductResource["resource"]["fields"][number]) =>
        !resource.timestamps.enabled ||
        ![
          resource.timestamps.createdAtField,
          resource.timestamps.updatedAtField
        ].includes(field.name)
    )
    .map(
      (field: GeneratedProductResource["resource"]["fields"][number]) =>
        `${field.name}: ${renderFormDataAccessor(field)},`
    );
}

function renderFormDataAccessor(
  field: GeneratedProductResource["resource"]["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return `coerceBoolean(formData.get(${JSON.stringify(field.name)}))`;
    case "datetime":
      return field.required
        ? `new Date(String(formData.get(${JSON.stringify(field.name)}) ?? "")).toISOString()`
        : `coerceDatetime(formData.get(${JSON.stringify(field.name)}))`;
    default:
      return field.required
        ? `String(formData.get(${JSON.stringify(field.name)}) ?? "")`
        : `coerceString(formData.get(${JSON.stringify(field.name)}))`;
  }
}

function renderDraftSearchValueLines(resource: GeneratedProductResource["resource"]) {
  return resource.fields
    .filter((field) => !field.hidden)
    .map((field) => {
      const queryKey = `draft_${field.name}`;

      if (field.type === "boolean") {
        return `${field.name}: getSearchValue(searchParams.${queryKey}) === "true" ? true : getSearchValue(searchParams.${queryKey}) === "false" ? false : undefined,`;
      }

      if (field.type === "enum" && field.values) {
        return `${field.name}: ${JSON.stringify(field.values)}.includes(getSearchValue(searchParams.${queryKey}) ?? "") ? (getSearchValue(searchParams.${queryKey}) as ${field.values
          .map((value) => JSON.stringify(value))
          .join(" | ")}) : undefined,`;
      }

      return `${field.name}: getSearchValue(searchParams.${queryKey}) ?? undefined,`;
    });
}

function getProductListFilterFields(resource: GeneratedProductResource["resource"]) {
  return resource.api.filters
    .map((fieldName) => resource.fields.find((field) => field.name === fieldName))
    .filter(
      (
        field
      ): field is GeneratedProductResource["resource"]["fields"][number] =>
        field !== undefined
    );
}

function getProductSortableFields(resource: GeneratedProductResource["resource"]) {
  const fields = [
    {
      name: "createdAt",
      type: "datetime"
    },
    {
      name: "updatedAt",
      type: "datetime"
    },
    ...resource.fields.filter(
      (field) =>
        field.required &&
        field.sortable &&
        ["datetime", "email", "enum", "string", "uuid"].includes(field.type)
    )
  ];

  return fields;
}

function getDefaultProductSortBy(resource: GeneratedProductResource["resource"]) {
  const sortValues = getProductSortableFields(resource).map((field) => field.name);

  return sortValues.includes("createdAt") ? "createdAt" : sortValues[0] ?? "createdAt";
}

function renderProductListQueryType(resource: GeneratedProductResource["resource"]) {
  const sortValues = getProductSortableFields(resource)
    .map((field) => JSON.stringify(field.name))
    .join(" | ");

  return [
    "{",
    resource.archive.enabled
      ? '  archived: "exclude" | "include" | "only";'
      : "",
    "  cursor?: string;",
    "  limit?: number;",
    "  query?: string;",
    `  sortBy: ${sortValues};`,
    '  sortDirection: "asc" | "desc";',
    ...getProductListFilterFields(resource).map(
      (field) => `  ${field.name}?: ${renderProductQueryFieldType(field)};`
    ),
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderProductQueryFieldType(
  field: GeneratedProductResource["resource"]["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return "boolean";
    case "enum":
      return (field.values ?? []).map((value) => JSON.stringify(value)).join(" | ");
    default:
      return "string";
  }
}

function renderProductReadListQueryLines(resource: GeneratedProductResource["resource"]) {
  const sortValues = getProductSortableFields(resource).map((field) => field.name);
  const defaultSortBy = getDefaultProductSortBy(resource);

  return [
    resource.archive.enabled ? "    archived: readArchivedFilter(searchParams)," : "",
    '    cursor: getSearchValue(searchParams.cursor) ?? undefined,',
    "    limit: readPositiveInteger(getSearchValue(searchParams.limit)),",
    "    query: getSearchValue(searchParams.query) ?? undefined,",
    `    sortBy: readAllowedValue(getSearchValue(searchParams.sortBy), [${sortValues
      .map((value) => JSON.stringify(value))
      .join(", ")}]) ?? ${JSON.stringify(defaultSortBy)},`,
    '    sortDirection: readAllowedValue(getSearchValue(searchParams.sortDirection), ["asc", "desc"]) ?? "desc",',
    ...getProductListFilterFields(resource).map((field) =>
      `    ${field.name}: ${renderProductReadSearchQueryValue(field)},`
    )
  ].filter(Boolean);
}

function renderProductReadFormListQueryLines(resource: GeneratedProductResource["resource"]) {
  const sortValues = getProductSortableFields(resource).map((field) => field.name);
  const defaultSortBy = getDefaultProductSortBy(resource);

  return [
    resource.archive.enabled ? "    archived: readArchivedFilterFromFormData(formData)," : "",
    "    cursor: undefined,",
    '    limit: readPositiveInteger(coerceString(formData.get("list_limit"))),',
    '    query: coerceString(formData.get("list_query")),',
    `    sortBy: readAllowedValue(coerceString(formData.get("list_sortBy")), [${sortValues
      .map((value) => JSON.stringify(value))
      .join(", ")}]) ?? ${JSON.stringify(defaultSortBy)},`,
    '    sortDirection: readAllowedValue(coerceString(formData.get("list_sortDirection")), ["asc", "desc"]) ?? "desc",',
    ...getProductListFilterFields(resource).map((field) =>
      `    ${field.name}: ${renderProductReadFormQueryValue(field)},`
    )
  ].filter(Boolean);
}

function renderProductReadSearchQueryValue(
  field: GeneratedProductResource["resource"]["fields"][number]
) {
  const access = `getSearchValue(searchParams.${field.name})`;

  if (field.type === "boolean") {
    return `${access} === "true" ? true : ${access} === "false" ? false : undefined`;
  }

  if (field.type === "enum" && field.values) {
    return `readAllowedValue(${access}, [${field.values
      .map((value) => JSON.stringify(value))
      .join(", ")}]) ?? undefined`;
  }

  return `${access} ?? undefined`;
}

function renderProductReadFormQueryValue(
  field: GeneratedProductResource["resource"]["fields"][number]
) {
  const access = `coerceString(formData.get(${JSON.stringify(`list_${field.name}`)}))`;

  if (field.type === "boolean") {
    return `${access} === "true" ? true : ${access} === "false" ? false : undefined`;
  }

  if (field.type === "enum" && field.values) {
    return `readAllowedValue(${access}, [${field.values
      .map((value) => JSON.stringify(value))
      .join(", ")}]) ?? undefined`;
  }

  return access;
}

function renderProductListQueryEntries(resource: GeneratedProductResource["resource"]) {
  return [
    resource.archive.enabled ? "    archived: query.archived," : "",
    "    query: query.query,",
    "    limit: query.limit,",
    '    sortBy: query.sortBy !== "createdAt" ? query.sortBy : undefined,',
    '    sortDirection: query.sortDirection !== "desc" ? query.sortDirection : undefined,',
    ...getProductListFilterFields(resource).map(
      (field) => `    ${field.name}: query.${field.name},`
    )
  ].filter(Boolean);
}

function renderProductListHiddenInputs(resource: GeneratedProductResource["resource"]) {
  return [
    resource.archive.enabled
      ? '          <input name="list_archived" type="hidden" value={data.listQuery.archived} />'
      : "",
    '          <input name="list_query" type="hidden" value={data.listQuery.query ?? ""} />',
    '          <input name="list_limit" type="hidden" value={data.listQuery.limit?.toString() ?? ""} />',
    '          <input name="list_sortBy" type="hidden" value={data.listQuery.sortBy} />',
    '          <input name="list_sortDirection" type="hidden" value={data.listQuery.sortDirection} />',
    ...getProductListFilterFields(resource).map((field) => {
      if (field.type === "boolean") {
        return `          <input name="list_${field.name}" type="hidden" value={data.listQuery.${field.name} === undefined ? "" : data.listQuery.${field.name} ? "true" : "false"} />`;
      }

      return `          <input name="list_${field.name}" type="hidden" value={data.listQuery.${field.name} ?? ""} />`;
    })
  ].filter(Boolean);
}

function renderProductListFilterControls(resource: GeneratedProductResource["resource"]) {
  const controls: string[] = [
    '        <form action="" className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4" method="GET">',
    '          <input name="organizationId" type="hidden" value={data.workspace.activeOrganizationId} />',
    '          <input name="projectId" type="hidden" value={data.workspace.activeProjectId ?? ""} />'
  ];

  if (resource.archive.enabled) {
    controls.push(
      '          <label className="grid gap-2">',
      "            <span>Archived</span>",
      '            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.archived} name="archived">',
      '              <option value="exclude">Active</option>',
      '              <option value="include">All</option>',
      '              <option value="only">Archived</option>',
      "            </select>",
      "          </label>"
    );
  }

  controls.push(
    '          <label className="grid gap-2">',
    "            <span>Search</span>",
    '            <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.query ?? ""} name="query" type="text" />',
    "          </label>",
    '          <div className="grid gap-4 md:grid-cols-2">',
    '            <label className="grid gap-2">',
    "              <span>Sort By</span>",
    '              <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.sortBy} name="sortBy">'
  );

  for (const field of getProductSortableFields(resource)) {
    controls.push(
      `                <option value="${field.name}">${toTitleCase(field.name)}</option>`
    );
  }

  controls.push(
    "              </select>",
    "            </label>",
    '            <label className="grid gap-2">',
    "              <span>Sort Direction</span>",
    '              <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.sortDirection} name="sortDirection">',
    '                <option value="desc">Descending</option>',
    '                <option value="asc">Ascending</option>',
    "              </select>",
    "            </label>",
    "          </div>",
    '          <label className="grid gap-2">',
    "            <span>Page Size</span>",
    '            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.limit?.toString() ?? "25"} name="limit">',
    '              <option value="10">10</option>',
    '              <option value="25">25</option>',
    '              <option value="50">50</option>',
    '              <option value="100">100</option>',
    "            </select>",
    "          </label>"
  );

  for (const field of getProductListFilterFields(resource)) {
    const label = toTitleCase(field.name);

    if (field.type === "enum" && field.values) {
      controls.push(
        '          <label className="grid gap-2">',
        `            <span>${label}</span>`,
        `            <select className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.${field.name} ?? ""} name="${field.name}">`,
        '              <option value="">Any</option>',
        ...field.values.map(
          (value) => `              <option value="${value}">${toTitleCase(value)}</option>`
        ),
        "            </select>",
        "          </label>"
      );
      continue;
    }

    controls.push(
      '          <label className="grid gap-2">',
      `            <span>${label}</span>`,
      `            <input className="rounded-md border border-[var(--border)] px-3 py-2" defaultValue={data.listQuery.${field.name} ?? ""} name="${field.name}" type="text" />`,
      "          </label>"
    );
  }

  controls.push(
    '          <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">Apply Filters</button>',
    "        </form>"
  );

  return controls;
}

function renderProductDefaultListQueryLines(resource: GeneratedProductResource["resource"]) {
  const sortValues = getProductSortableFields(resource).map((field) => field.name);
  const defaultSortBy = sortValues.includes("createdAt")
    ? "createdAt"
    : sortValues[0] ?? "createdAt";

  return [
    resource.archive.enabled ? '    archived: "exclude",' : "",
    "    cursor: undefined,",
    "    limit: undefined,",
    "    query: undefined,",
    `    sortBy: ${JSON.stringify(defaultSortBy)},`,
    '    sortDirection: "desc",',
    ...getProductListFilterFields(resource).map(
      (field) => `    ${field.name}: undefined,`
    )
  ].filter(Boolean);
}

function renderDraftFormValueLines(resource: GeneratedProductResource["resource"]) {
  return resource.fields
    .filter((field) => !field.hidden)
    .map((field) => {
      if (field.type === "boolean") {
        return `${field.name}: formData.get(${JSON.stringify(field.name)}) === "on" ? "true" : undefined,`;
      }

      if (field.type === "datetime") {
        return `${field.name}: coerceString(formData.get(${JSON.stringify(field.name)})),`;
      }

      return `${field.name}: coerceString(formData.get(${JSON.stringify(field.name)})),`;
    });
}

function renderDraftPresenceExpression(
  resource: GeneratedProductResource["resource"]
) {
  const expressions = resource.fields
    .filter((field) => !field.hidden)
    .map((field) => `data.draftValues?.${field.name} !== undefined`);

  return expressions.length > 0 ? expressions.join(" || ") : "false";
}

function getProductResourceParamName(resourceEntry: GeneratedProductResource) {
  return `${camelCase(resourceEntry.resource.resource)}Id`;
}

function getProductResourceDisplayField(
  resourceEntry: GeneratedProductResource
) {
  return (
    resourceEntry.resource.fields.find((field) => !field.hidden)?.name ?? "id"
  );
}

function renderProductResourceDetailFields(
  resourceEntry: GeneratedProductResource
) {
  return resourceEntry.resource.fields
    .filter((field) => !field.hidden)
    .map((field) => {
      const label = field.label ?? toTitleCase(field.name);

      return [
        '            <div className="grid gap-1">',
        `              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">${label}</p>`,
        `              <p>{data.item ? renderRelationAwareDetailValue(data.item.id, ${JSON.stringify(
          field.name
        )}, data.item.${field.name}, data.relationPresentations) : "Not set"}</p>`,
        "            </div>"
      ].join("\n");
    });
}

function getResolvableGeneratedRelationTargets(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  return resourceEntry.resource.relations
    .filter((relation) => relation.targetScope === "generated")
    .map((relation) => ({
      relation,
      targetResource: product.resources.find(
        (candidate) => candidate.resource.resource === relation.target
      )
    }))
    .filter(
      (
        entry
      ): entry is {
        relation: GeneratedProductResource["resource"]["relations"][number];
        targetResource: GeneratedProductResource;
      } => entry.targetResource !== undefined
    );
}

function renderProductRelationClientImports(
  targets: ReturnType<typeof getResolvableGeneratedRelationTargets>
) {
  return targets.map(
    ({ targetResource }) =>
      `import { createResourceClient as create${toPascalCase(
        targetResource.resource.resource
      )}ResourceClient } from "@/src/features/${toKebabCase(
        targetResource.resource.resource
      )}/api/${toKebabCase(targetResource.resource.resource)}-client";`
  );
}

function renderRelationPresentationResolverLines(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const lines: string[] = [];
  const projectRelations = resourceEntry.resource.relations.filter(
    (relation) => relation.targetScope === "platform" && relation.target === "project"
  );

  if (projectRelations.length > 0) {
    lines.push(
      "const projectById = new Map(input.workspace.projects.map((project) => [project.id, project] as const));",
      "",
      "for (const item of input.items) {"
    );

    for (const relation of projectRelations) {
      lines.push(
        `  if (item.${relation.field}) {`,
        `    presentations[item.id].${relation.field} = {`,
        `      label: projectById.get(item.${relation.field})?.name ?? item.${relation.field}`,
        "    };",
        "  }"
      );
    }

    lines.push("}", "");
  }

  for (const { relation, targetResource } of getResolvableGeneratedRelationTargets(
    product,
    resourceEntry
  )) {
    const targetPascal = toPascalCase(targetResource.resource.resource);
    const labelField = getProductResourceDisplayField(targetResource);
    const targetListPath = JSON.stringify(targetResource.listPath);

    lines.push(
      "if (input.organizationId) {",
      "  const organizationId = input.organizationId;",
      `  const ${relation.field}Client = create${targetPascal}ResourceClient(createServerApiClient());`,
      `  const ${relation.field}Ids = Array.from(`,
      "    new Set(",
      `      input.items`,
      `        .map((item) => item.${relation.field})`,
      `        .filter((value): value is string => typeof value === "string" && value.length > 0)`,
      "    )",
      "  );",
      `  const ${relation.field}Presentations = new Map<string, { href?: string; label: string }>();`,
      "",
      `  await Promise.all(`,
      `    ${relation.field}Ids.map(async (id) => {`,
      "      try {",
      `        const record = await ${relation.field}Client.get(organizationId, id);`,
      `        ${relation.field}Presentations.set(id, {`,
      `          href: buildResourcePath(${targetListPath}, record.id, organizationId, input.projectId),`,
      `          label: record.${labelField}?.toString() ?? record.id`,
      "        });",
      "      } catch {",
      `        ${relation.field}Presentations.set(id, { label: id });`,
      "      }",
      "    })",
      "  );",
      "",
      "  for (const item of input.items) {",
      `    if (item.${relation.field}) {`,
      `      presentations[item.id].${relation.field} =`,
      `        ${relation.field}Presentations.get(item.${relation.field}) ?? { label: item.${relation.field} };`,
      "    }",
      "  }",
      "}",
      ""
    );
  }

  return lines;
}

function renderFormOptionResolverLines(
  product: GeneratedProductSpec,
  resourceEntry: GeneratedProductResource
) {
  const lines: string[] = [];
  const projectRelations = resourceEntry.resource.relations.filter(
    (relation) => relation.targetScope === "platform" && relation.target === "project"
  );

  if (projectRelations.length > 0) {
    for (const relation of projectRelations) {
      lines.push(
        `options.${relation.field} = input.workspace.projects.map((project) => ({`,
        "  label: project.name,",
        "  value: project.id",
        "}));",
        ""
      );
    }
  }

  for (const { relation, targetResource } of getResolvableGeneratedRelationTargets(
    product,
    resourceEntry
  )) {
    const targetPascal = toPascalCase(targetResource.resource.resource);
    const labelField = getProductResourceDisplayField(targetResource);
    const defaultSortBy = getDefaultProductSortBy(targetResource.resource);
    const defaultQueryLines = [
      targetResource.resource.archive.enabled ? 'archived: "exclude",' : "",
      `sortBy: ${JSON.stringify(defaultSortBy)},`,
      'sortDirection: "desc",',
      "limit: 100"
    ].filter(Boolean);

    lines.push(
      "if (input.organizationId) {",
      `  const ${relation.field}Response = await create${targetPascal}ResourceClient(createServerApiClient()).list(`,
      "    input.organizationId,",
      "    {",
      ...defaultQueryLines.map((line) => `      ${line}`),
      "    }",
      "  );",
      "",
      `  options.${relation.field} = ${relation.field}Response.items.map((record) => ({`,
      `    label: record.${labelField}?.toString() ?? record.id,`,
      "    value: record.id",
      "  }));",
      "}",
      ""
    );
  }

  return lines;
}

function patchDomainPackageExports(contents: string, productId: string) {
  const parsed = JSON.parse(contents) as {
    exports?: Record<string, { import: string; types: string }>;
  };
  const exportKey = `./${productId}`;

  parsed.exports ??= {};

  if (!parsed.exports[exportKey]) {
    parsed.exports[exportKey] = {
      import: `./src/${productId}/index.ts`,
      types: `./src/${productId}/index.ts`
    };
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function patchApiProductRuntime(contents: string, productId: string) {
  const pascalName = toPascalCase(productId);
  const camelName = camelCase(productId);
  const importLine = `import { ${camelName}ProductModule } from "@auditrail/domain/${productId}";`;

  const withImport = insertAfterAnchor({
    anchor: 'import { projectsProductModule } from "@auditrail/domain/projects";',
    contents,
    insertion: importLine
  });

  return withImport.replace(
    /const registeredProductModules = \[\n([\s\S]*?)\n\] as const satisfies readonly ApiProductModule\[\];/,
    (match, body: string) => {
      if (body.includes(`${camelName}ProductModule`)) {
        return match;
      }

      return `const registeredProductModules = [\n${body},\n  ${camelName}ProductModule\n] as const satisfies readonly ApiProductModule[];`;
    }
  );
}

function patchWebProductRuntime(contents: string, productId: string) {
  const camelName = camelCase(productId);
  const importLine = `import { ${camelName}ProductModule } from "@auditrail/domain/${productId}";`;

  const withImport = insertAfterAnchor({
    anchor: 'import { projectsProductModule } from "@auditrail/domain/projects";',
    contents,
    insertion: importLine
  });

  return withImport.replace(
    /const registeredProductModules = \[\n([\s\S]*?)\n\] as const satisfies readonly RegisteredProductModule\[\];/,
    (match, body: string) => {
      if (body.includes(`${camelName}ProductModule`)) {
        return match;
      }

      return `const registeredProductModules = [\n${body},\n  ${camelName}ProductModule\n] as const satisfies readonly RegisteredProductModule[];`;
    }
  );
}

function patchApiProductRuntimeTest(
  contents: string,
  product: GeneratedProductSpec
) {
  const productEntry = `      {\n        id: ${JSON.stringify(product.id)},\n        name: ${JSON.stringify(product.name)}\n      }`;

  return contents.replace(
    /expect\(runtime\.listRegisteredProducts\(\)\)\.toEqual\(\[\n([\s\S]*?)\n    \]\);/,
    (match, body: string) => {
      if (body.includes(`id: "${product.id}"`) || body.includes(`id: '${product.id}'`)) {
        return match;
      }

      return `expect(runtime.listRegisteredProducts()).toEqual([\n${body},\n${productEntry}\n    ]);`;
    }
  );
}

function patchRootFile(input: {
  filePath: string;
  repoRoot: string;
  update: (contents: string) => string;
}): ProductInstallChange {
  const absolutePath = resolve(input.repoRoot, input.filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required root file '${input.filePath}'.`);
  }

  const currentContents = readFileSync(absolutePath, "utf8");
  const nextContents = ensureTrailingNewline(input.update(currentContents));

  if (currentContents === nextContents) {
    return {
      action: "skip",
      kind: "root-patch",
      path: input.filePath
    };
  }

  writeFileSync(absolutePath, nextContents);

  return {
    action: existsSync(absolutePath) ? "update" : "create",
    kind: "root-patch",
    path: input.filePath
  };
}

function prepareGeneratedProductWrites(input: {
  files: readonly PendingProductFile[];
  force: boolean;
  repoRoot: string;
}) {
  ensureWritableFiles({
    files: input.files,
    force: input.force,
    repoRoot: input.repoRoot
  });

  return input.files.map<PreparedProductWrite>((file) => {
    const absolutePath = resolve(input.repoRoot, file.path);
    const nextContents = ensureTrailingNewline(file.contents);

    if (!existsSync(absolutePath)) {
      return {
        ...file,
        action: "create",
        contents: nextContents
      };
    }

    const currentContents = readFileSync(absolutePath, "utf8");

    if (currentContents === nextContents) {
      return {
        ...file,
        action: "skip",
        contents: nextContents
      };
    }

    return {
      ...file,
      action: "update",
      contents: nextContents
    };
  });
}

function ensureWritableFiles(input: {
  files: readonly PendingProductFile[];
  force: boolean;
  repoRoot: string;
}) {
  const conflicts = input.files
    .map((file) => resolve(input.repoRoot, file.path))
    .filter((path) => existsSync(path));

  if (conflicts.length > 0 && !input.force) {
    throw new Error(
      [
        "Refusing to overwrite existing generated product files without --force.",
        ...conflicts.slice(0, 10).map((path) =>
          `- ${relative(input.repoRoot, path).replace(/\\/g, "/")}`
        )
      ].join("\n")
    );
  }
}

function resolveProductSpecPath(input: {
  repoRoot: string;
  specPath: string;
}) {
  const absolutePath = resolve(input.repoRoot, input.specPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Product spec file not found: ${input.specPath}`);
  }

  if (extname(absolutePath).toLowerCase() !== ".json") {
    throw new Error("Product specs must be JSON files.");
  }

  return absolutePath;
}

function insertAfterAnchor(input: {
  anchor: string;
  contents: string;
  insertion: string;
}) {
  if (input.contents.includes(input.insertion)) {
    return input.contents;
  }

  const anchorIndex = input.contents.indexOf(input.anchor);

  if (anchorIndex === -1) {
    throw new Error(
      `Unsupported central file patch. Could not find expected anchor '${input.anchor}'.`
    );
  }

  const anchorEnd = anchorIndex + input.anchor.length;

  return [
    input.contents.slice(0, anchorEnd),
    "\n",
    input.insertion,
    input.contents.slice(anchorEnd)
  ].join("");
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function trimLeadingSlash(value: string) {
  return value.startsWith("/") ? value.slice(1) : value;
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function toPascalCase(value: string) {
  return toKebabCase(value)
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join("");
}

function camelCase(value: string) {
  const pascal = toPascalCase(value);

  return pascal[0]!.toLowerCase() + pascal.slice(1);
}

function toTitleCase(value: string) {
  return toKebabCase(value)
    .split("-")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}
