import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { FrameworkGeneratedFilePlan, FrameworkResourceSpec } from "../../packages/framework/src/index.js";
import { resolveSafeOutputPath } from "../extraction/output.js";
import {
  createResourcePlanFromFile,
  type ResourcePlanAdvisory,
  type ResourcePlanEntry,
  type ResourcePlanGroup,
  type ResourcePlanReport
} from "./resource-planner.js";

export const resourceGeneratorSupportedFieldTypes = [
  "boolean",
  "datetime",
  "email",
  "enum",
  "string",
  "text",
  "uuid"
] as const;

const supportedFieldTypes = new Set<string>(resourceGeneratorSupportedFieldTypes);

export const resourceGeneratorNonBlockingManualReviewCodes = [
  "migration-placeholder"
] as const;

const nonBlockingManualReviewCodes = new Set(
  resourceGeneratorNonBlockingManualReviewCodes as readonly string[]
);

const supportedTemplateIds = new Set([
  "resource/domain-index",
  "resource/db-schema",
  "resource/api-routes",
  "resource/api-service",
  "resource/api-repo",
  "resource/api-postgres-repo",
  "resource/api-routes-test",
  "resource/api-routes-integration-test",
  "resource/api-service-test",
  "resource/web-index",
  "resource/web-api-client",
  "resource/web-screen",
  "resource/web-form",
  "resource/web-table",
  "resource/web-empty-state",
  "resource/web-domain-schemas",
  "resource/web-screen-test",
  "resource/web-client-test",
  "resource/web-list-page",
  "resource/web-create-page",
  "resource/web-detail-page",
  "resource/web-edit-page",
  "resource/docs-resource",
  "resource/docs-customization"
]);

export const defaultResourcePreviewRoot = ".generated/resource-preview";

export interface ResourceGeneratorFile {
  contents: string;
  group: ResourcePlanGroup;
  outputPath: string;
  repoPath: string;
  templateId: string;
}

export interface ResourceGeneratorResult {
  checks: readonly string[];
  outputPath: string;
  resource: FrameworkResourceSpec;
  skippedPlanPaths: readonly string[];
  writtenFiles: readonly ResourceGeneratorFile[];
}

export function generateResourceFromFile(input: {
  allowedWarningCodes?: readonly string[];
  force?: boolean;
  outputPath?: string;
  repoRoot: string;
  specPath: string;
}): ResourceGeneratorResult {
  const plan = createResourcePlanFromFile({
    repoRoot: input.repoRoot,
    specPath: input.specPath
  });
  const outputPath = resolveSafeOutputPath({
    outputPath: input.outputPath ?? createDefaultPreviewOutputPath(plan.resource),
    repoRoot: input.repoRoot
  });

  validateSupportedResource(plan.resource);
  validatePlannerSafety(plan, input.allowedWarningCodes ?? []);

  const writableFiles = createWritableFiles({
    outputPath,
    plan,
    repoRoot: input.repoRoot
  });

  const conflictingFiles = writableFiles.filter(
    (file) =>
      existsSync(resolve(input.repoRoot, file.outputPath)) && !(input.force ?? false)
  );

  if (conflictingFiles.length > 0) {
    throw new Error(
      [
        "Refusing to overwrite existing generated files without --force.",
        ...conflictingFiles.slice(0, 10).map((file) => `- ${file.outputPath}`)
      ].join("\n")
    );
  }

  const writtenFiles = [...writableFiles].sort((left, right) =>
    left.outputPath.localeCompare(right.outputPath)
  );

  for (const file of writtenFiles) {
    const absolutePath = resolve(input.repoRoot, file.outputPath);

    mkdirSync(dirname(absolutePath), {
      recursive: true
    });
    writeFileSync(absolutePath, file.contents);
  }

  const plannedTemplatePaths = flattenPlanEntries(plan)
    .filter((entry) => entry.templateId && supportedTemplateIds.has(entry.templateId))
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));

  return {
    checks: plan.checks.map((check) => check.command),
    outputPath,
    resource: plan.resource,
    skippedPlanPaths: plan.generatedFiles
      .filter(
        (file) =>
          !file.templateId || !supportedTemplateIds.has(file.templateId)
      )
      .map((file) => file.path)
      .sort((left, right) => left.localeCompare(right)),
    writtenFiles: writtenFiles.filter((file) =>
      plannedTemplatePaths.includes(file.repoPath)
    )
  };
}

export function formatGeneratedResourceSummary(
  result: ResourceGeneratorResult
): string {
  const groupCounts = countFilesByGroup(result.writtenFiles);
  const supportedCrud = ["list", "create", "read", "update"];

  if (result.resource.crud.delete) {
    supportedCrud.push("delete");
  }

  if (result.resource.archive.enabled) {
    supportedCrud.push("archive", "unarchive");
  }

  return [
    `Generated resource preview: ${result.resource.resource}`,
    "",
    `- output directory: ${result.outputPath}`,
    `- written files: ${result.writtenFiles.length}`,
    `- domain files: ${groupCounts.domain}`,
    `- db files: ${groupCounts.db}`,
    `- api files: ${groupCounts.api}`,
    `- web files: ${groupCounts.web}`,
    `- docs files: ${groupCounts.docs}`,
    `- skipped central follow-up paths: ${result.skippedPlanPaths.length}`,
    `- ownership: ${result.resource.ownership}`,
    `- supported CRUD: ${supportedCrud.join(", ")}`,
    `- delete support: ${result.resource.crud.delete ? "generated when enabled" : "not generated"}`,
    `- archive support: ${result.resource.archive.enabled ? `generated via \`${result.resource.archive.field}\`` : "disabled"}`,
    `- post-generation checks: ${result.checks.length}`
  ].join("\n");
}

export function createDefaultPreviewOutputPath(resource: FrameworkResourceSpec) {
  return `${defaultResourcePreviewRoot}/${toKebabCase(resource.resource)}`;
}

export function getResourceGeneratorSupportMetadata() {
  return {
    allowedOutputPrefixes: [".generated", "tmp"] as const,
    blockingUnsupportedModes: {
      indexes: true,
      nav: true,
      publicApi: true
    },
    manualReviewAllowedCodes: resourceGeneratorNonBlockingManualReviewCodes,
    previewOnly: true,
    requiredCrud: ["list", "create", "read", "update"] as const,
    safeCustomizationPoints: [
      "apps/api/src/modules/generated/<resource>/service.ts",
      "apps/api/src/modules/generated/<resource>/postgres-repo.ts",
      "apps/api/src/modules/generated/<resource>/routes.ts",
      "apps/web/src/features/<resource>/components/*",
      "docs/resources/<resource>-customization.md"
    ] as const,
    supportedFieldTypes: resourceGeneratorSupportedFieldTypes,
    supportedRelationTargets: {
      generated: "existing generated resources",
      platform: ["organization", "project", "user"]
    } as const,
    supportedOwnership: "organization" as const,
    unsupportedBehaviors: [
      "nested relation reads",
      "relation graph traversal",
      "public API generation",
      "product navigation wiring",
      "index generation",
      "runtime route registration",
      "real migration generation"
    ] as const
  };
}

function validateSupportedResource(resource: FrameworkResourceSpec) {
  if (resource.ownership !== "organization") {
    throw new Error(
      `Unsupported ownership mode '${resource.ownership}'. The first generator supports organization-owned resources only.`
    );
  }

  if (
    !resource.crud.list ||
    !resource.crud.create ||
    !resource.crud.read ||
    !resource.crud.update
  ) {
    throw new Error(
      "The first generator requires list, create, read, and update to stay enabled."
    );
  }

  if (resource.api.public) {
    throw new Error(
      "Public API generation is not supported in the first CRUD generator. Keep `api.public` false or omit it."
    );
  }

  if (resource.ui.nav) {
    throw new Error(
      "Automatic product navigation wiring is not supported in the first CRUD generator. Keep `ui.nav` false or omit it."
    );
  }

  if (resource.indexes.length > 0) {
    throw new Error(
      "Index generation is not supported in the first CRUD generator. Remove `indexes` from the resource spec for now."
    );
  }

  for (const field of resource.fields) {
    if (!supportedFieldTypes.has(field.type)) {
      throw new Error(
        `Field '${field.name}' uses unsupported type '${field.type}'. Supported types: ${Array.from(
          supportedFieldTypes
        ).join(", ")}.`
      );
    }
  }

  for (const relation of resource.relations) {
    if (
      relation.targetScope === "platform" &&
      !["organization", "project", "user"].includes(relation.target)
    ) {
      throw new Error(
        `Unsupported platform relation target '${relation.target}'. Supported targets: organization, project, user.`
      );
    }
  }
}

function validatePlannerSafety(
  plan: ResourcePlanReport,
  allowedWarningCodes: readonly string[]
) {
  const allowedWarnings = new Set(allowedWarningCodes);
  const blockingWarnings = plan.warnings.filter(
    (warning) => !allowedWarnings.has(warning.code)
  );
  const blockingManualReview = plan.manualReview.filter(
    (item) => !nonBlockingManualReviewCodes.has(item.code)
  );

  if (blockingWarnings.length === 0 && blockingManualReview.length === 0) {
    return;
  }

  throw new Error(
    [
      "The validated dry-run plan still contains blocking issues. Resolve them before writing files.",
      ...formatAdvisories("Warnings", blockingWarnings),
      ...formatAdvisories("Manual review", blockingManualReview)
    ].join("\n")
  );
}

function formatAdvisories(
  label: string,
  advisories: readonly ResourcePlanAdvisory[]
) {
  if (advisories.length === 0) {
    return [];
  }

  return [
    `${label}:`,
    ...advisories.map((advisory) => `- ${advisory.code}: ${advisory.message}`)
  ];
}

function createWritableFiles(input: {
  outputPath: string;
  plan: ResourcePlanReport;
  repoRoot: string;
}) {
  const context = createTemplateContext(input.plan);
  const entryByPath = new Map(
    flattenPlanEntries(input.plan).map((entry) => [entry.path, entry] as const)
  );
  const files: ResourceGeneratorFile[] = [];

  for (const generatedFile of [...input.plan.generatedFiles].sort((left, right) =>
    left.path.localeCompare(right.path)
  )) {
    if (!generatedFile.templateId || !supportedTemplateIds.has(generatedFile.templateId)) {
      continue;
    }

    const entry = entryByPath.get(generatedFile.path);

    if (!entry) {
      throw new Error(`Planner entry not found for generated path '${generatedFile.path}'.`);
    }

    const renderer = templateRenderers[generatedFile.templateId];

    if (!renderer) {
      throw new Error(`No template renderer registered for '${generatedFile.templateId}'.`);
    }

    files.push({
      contents: ensureTrailingNewline(renderer(context)),
      group: entry.group,
      outputPath: joinOutputPath(input.outputPath, generatedFile.path),
      repoPath: generatedFile.path,
      templateId: generatedFile.templateId
    });
  }

  return files;
}

function createTemplateContext(plan: ResourcePlanReport) {
  const resource = plan.resource;
  const resourcePath = toKebabCase(resource.resource);
  const resourceSlug = getPluralPath(resource);
  const pascalName = toPascalCase(resource.resource);
  const pluralPascalName = toPascalCase(resourceSlug);
  const label = resource.label;
  const pluralLabel = resource.pluralLabel;
  const apiBasePath = `/api${resource.api.prefix}`;
  const createFields = resource.fields.filter((field) => !field.readonly);
  const relationByField = new Map(
    resource.relations.map((relation) => [relation.field, relation] as const)
  );
  const updateFields = createFields.filter((field) => field.name !== "id");

  return {
    apiBasePath,
    createFields,
    label,
    pascalName,
    pluralLabel,
    pluralPascalName,
    plan,
    relationByField,
    resource,
    resourcePath,
    resourceSlug,
    updateFields
  };
}

const templateRenderers: Record<
  string,
  (context: ReturnType<typeof createTemplateContext>) => string
> = {
  "resource/domain-index": renderDomainIndex,
  "resource/db-schema": renderDbSchema,
  "resource/api-routes": renderApiRoutes,
  "resource/api-service": renderApiService,
  "resource/api-repo": renderApiRepo,
  "resource/api-postgres-repo": renderApiPostgresRepo,
  "resource/api-routes-test": renderApiRoutesTest,
  "resource/api-routes-integration-test": renderApiRoutesIntegrationTest,
  "resource/api-service-test": renderApiServiceTest,
  "resource/web-index": renderWebIndex,
  "resource/web-api-client": renderWebApiClient,
  "resource/web-screen": renderWebScreen,
  "resource/web-form": renderWebForm,
  "resource/web-table": renderWebTable,
  "resource/web-empty-state": renderWebEmptyState,
  "resource/web-domain-schemas": renderWebDomainSchemas,
  "resource/web-screen-test": renderWebScreenTest,
  "resource/web-client-test": renderWebClientTest,
  "resource/web-list-page": renderWebListPage,
  "resource/web-create-page": renderWebCreatePage,
  "resource/web-detail-page": renderWebDetailPage,
  "resource/web-edit-page": renderWebEditPage,
  "resource/docs-resource": renderResourceDocs,
  "resource/docs-customization": renderCustomizationDocs
};

function renderDomainIndex(context: ReturnType<typeof createTemplateContext>) {
  const fieldLines = context.resource.fields
    .map((field) => `  ${field.name}: ${renderZodField(field)}`)
    .join(",\n");
  const createShape = context.createFields
    .map((field) => `  ${field.name}: ${renderZodField(field)}`)
    .join(",\n");
  const updateShape = context.updateFields
    .map((field) => `  ${field.name}: ${renderZodOptionalField(field)}`)
    .join(",\n");
  const workflowLines = renderWorkflowDomainContract(context);

  return [
    'import { z } from "zod";',
    "",
    `export const ${context.resource.resource}FieldSchema = z.object({`,
    fieldLines,
    "});",
    "",
    `export const ${context.resource.resource}RecordSchema = z.object({`,
    '  id: z.string().uuid(),',
    '  organizationId: z.string().uuid(),',
    `${fieldLines},`,
    isArchiveEnabled(context)
      ? `  ${getArchiveFieldName(context)}: z.string().datetime().optional(),`
      : "",
    '  createdAt: z.string().datetime(),',
    '  updatedAt: z.string().datetime()',
    "});",
    "",
    `export const create${context.pascalName}InputSchema = z.object({`,
    createShape,
    "});",
    "",
    `export const update${context.pascalName}InputSchema = z.object({`,
    updateShape,
    "});",
    ...workflowLines,
    "",
    `export const ${context.resource.resource}PageInfoSchema = z.object({`,
    "  hasMore: z.boolean(),",
    "  nextCursor: z.string().nullable()",
    "});",
    "",
    `export const list${context.pluralPascalName}InputSchema = z.object({`,
    ...renderGeneratedListInputSchemaLines(context),
    "});",
    "",
    `export const list${context.pluralPascalName}ResponseSchema = z.object({`,
    `  items: z.array(${context.resource.resource}RecordSchema),`,
    `  pageInfo: ${context.resource.resource}PageInfoSchema`,
    "});",
    "",
    `export type ${context.pascalName}Record = z.infer<typeof ${context.resource.resource}RecordSchema>;`,
    ...renderWorkflowDomainTypes(context),
    `export type ${context.pascalName}PageInfo = z.infer<typeof ${context.resource.resource}PageInfoSchema>;`,
    `export type Create${context.pascalName}Input = z.infer<typeof create${context.pascalName}InputSchema>;`,
    `export type Update${context.pascalName}Input = z.infer<typeof update${context.pascalName}InputSchema>;`,
    `export type List${context.pluralPascalName}Input = z.infer<typeof list${context.pluralPascalName}InputSchema>;`,
    `export type List${context.pluralPascalName}Response = z.infer<typeof list${context.pluralPascalName}ResponseSchema>;`
  ].join("\n");
}

function renderDbSchema(context: ReturnType<typeof createTemplateContext>) {
  const imports = new Set(["index", "pgTable", "text", "timestamp", "uuid"]);
  const schemaImports = new Map<string, Set<string>>();
  const fieldLines: string[] = [
    '    id: uuid("id").primaryKey().defaultRandom(),'
  ];

  addSchemaImport(schemaImports, "./identity.js", "organizations");
  fieldLines.push(
    '    organizationId: uuid("organization_id").notNull().references(() => organizations.id),'
  );

  for (const field of context.resource.fields) {
    imports.add(getDrizzleImport(field.type));
    fieldLines.push(
      `    ${field.name}: ${renderDbColumn(context, field)}`
    );
  }

  for (const relation of context.resource.relations) {
    const targetReference = resolveRelationTargetReference(relation);
    addSchemaImport(
      schemaImports,
      targetReference.importPath,
      targetReference.symbol
    );
  }

  fieldLines.push(
    '    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),',
    '    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()'
  );

  if (isArchiveEnabled(context)) {
    fieldLines.splice(
      fieldLines.length - 2,
      0,
      `    ${getArchiveFieldName(context)}: timestamp("${toSnakeCase(
        getArchiveFieldName(context)
      )}", { withTimezone: true }),`
    );
  }

  const indexLines = [
    `    index("${getDbTableName(context.resource)}_organization_id_idx").on(table.organizationId)`,
    ...context.resource.relations.map(
      (relation) =>
        `    index("${getDbTableName(context.resource)}_${toSnakeCase(relation.field)}_idx").on(table.${relation.field})`
    )
  ];

  return [
    `import { ${Array.from(imports).sort().join(", ")} } from "drizzle-orm/pg-core";`,
    "",
    ...Array.from(schemaImports.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([path, names]) =>
          `import { ${Array.from(names).sort().join(", ")} } from "${path}";`
      ),
    "",
    `export const ${context.resource.resource}Table = pgTable(`,
    `  "${getDbTableName(context.resource)}",`,
    "  {",
    fieldLines.join("\n"),
    "  },",
    "  (table) => [",
    indexLines.join(",\n"),
    "  ]",
    ");"
  ].join("\n");
}

function renderWorkflowDomainContract(
  context: ReturnType<typeof createTemplateContext>
) {
  if (!context.resource.workflow) {
    return [] as string[];
  }

  const workflow = context.resource.workflow;
  const values = getWorkflowFieldValues(context).map((value) => JSON.stringify(value));
  const transitions = JSON.stringify(workflow.transitions, null, 2)
    .split("\n")
    .map((line) => line)
    .join("\n");
  const stateTypeName = `${context.pascalName}WorkflowState`;

  return [
    `export const ${context.resource.resource}WorkflowStateSchema = z.enum([${values.join(", ")}]);`,
    "",
    `export const ${context.resource.resource}Workflow = {`,
    `  field: ${JSON.stringify(workflow.field)},`,
    `  initial: ${JSON.stringify(workflow.initial)},`,
    `  transitions: ${transitions}`,
    `} as const;`,
    "",
    `export function assert${context.pascalName}WorkflowCreateState(state: ${stateTypeName}) {`,
    `  if (state !== ${context.resource.resource}Workflow.initial) {`,
    `    throw new Error(\`invalid_workflow_transition:New ${context.label} records must start in \${${context.resource.resource}Workflow.initial}.\`);`,
    "  }",
    "}",
    "",
    `export function assert${context.pascalName}WorkflowTransition(input: {`,
    `  from: ${stateTypeName};`,
    `  to: ${stateTypeName};`,
    "}) {",
    "  if (input.from === input.to) {",
    "    return;",
    "  }",
    "",
    `  const allowedTransitions = ${context.resource.resource}Workflow.transitions[input.from] as readonly ${stateTypeName}[] | undefined;`,
    "",
    "  if (!allowedTransitions?.includes(input.to)) {",
    `    throw new Error(\`invalid_workflow_transition:Cannot move ${workflow.field} from \${input.from} to \${input.to}.\`);`,
    "  }",
    "}"
  ];
}

function renderWorkflowDomainTypes(context: ReturnType<typeof createTemplateContext>) {
  if (!context.resource.workflow) {
    return [] as string[];
  }

  return [
    `export type ${context.pascalName}WorkflowState = z.infer<typeof ${context.resource.resource}WorkflowStateSchema>;`
  ];
}

function renderApiRepo(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import type { Create${context.pascalName}Input, ${context.pascalName}Record, List${context.pluralPascalName}Input, List${context.pluralPascalName}Response, Update${context.pascalName}Input } from "@auditrail/domain/generated/${context.resourcePath}";`,
    "",
    `export interface ${context.pascalName}Repo {`,
    isArchiveEnabled(context)
      ? `  archive(input: { id: string; organizationId: string }): Promise<${context.pascalName}Record | undefined>;`
      : "",
    `  create(input: { organizationId: string; data: Create${context.pascalName}Input }): Promise<${context.pascalName}Record>;`,
    context.resource.crud.delete
      ? `  delete(input: { id: string; organizationId: string }): Promise<boolean>;`
      : "",
    `  findById(input: { id: string; organizationId: string }): Promise<${context.pascalName}Record | undefined>;`,
    `  list(input: { organizationId: string; filters: List${context.pluralPascalName}Input }): Promise<List${context.pluralPascalName}Response>;`,
    isArchiveEnabled(context)
      ? `  unarchive(input: { id: string; organizationId: string }): Promise<${context.pascalName}Record | undefined>;`
      : "",
    `  update(input: { id: string; organizationId: string; data: Update${context.pascalName}Input }): Promise<${context.pascalName}Record | undefined>;`,
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiService(context: ReturnType<typeof createTemplateContext>) {
  const workflowImports = context.resource.workflow
    ? `, assert${context.pascalName}WorkflowCreateState, assert${context.pascalName}WorkflowTransition`
    : "";
  const workflowCreateValidation = context.resource.workflow
    ? [
        `      assert${context.pascalName}WorkflowCreateState(data.${context.resource.workflow.field});`
      ].join("\n")
    : "";
  const workflowUpdateValidation = context.resource.workflow
    ? [
        "      const current = await repo.findById({",
        "        id: input.id,",
        "        organizationId: input.organizationId",
        "      });",
        "",
        "      if (!current) {",
        "        return undefined;",
        "      }",
        "",
        `      const nextWorkflowState = data.${context.resource.workflow.field};`,
        "",
        "      if (nextWorkflowState !== undefined) {",
        `        assert${context.pascalName}WorkflowTransition({`,
        `          from: current.${context.resource.workflow.field},`,
        "          to: nextWorkflowState",
        "        });",
        "      }"
      ].join("\n")
    : "";

  return [
    `import { create${context.pascalName}InputSchema, list${context.pluralPascalName}InputSchema, update${context.pascalName}InputSchema${workflowImports}, type Create${context.pascalName}Input, type List${context.pluralPascalName}Input, type Update${context.pascalName}Input } from "@auditrail/domain/generated/${context.resourcePath}";`,
    "",
    `import type { ${context.pascalName}Repo } from "./repo.js";`,
    "",
    `export function create${context.pascalName}Service(repo: ${context.pascalName}Repo) {`,
    "  return {",
    isArchiveEnabled(context)
      ? "    async archive(input: { id: string; organizationId: string }) {\n      return repo.archive(input);\n    },"
      : "",
    "    async create(input: { data: Create" + context.pascalName + "Input; organizationId: string }) {",
    "      const data = create" + context.pascalName + "InputSchema.parse(input.data);",
    workflowCreateValidation,
    "      return repo.create({",
    "        data,",
    "        organizationId: input.organizationId",
    "      });",
    "    },",
    context.resource.crud.delete
      ? "    async delete(input: { id: string; organizationId: string }) {\n      return repo.delete(input);\n    },"
      : "",
    "    async get(input: { id: string; organizationId: string }) {",
    "      return repo.findById(input);",
    "    },",
    `    async list(input: { organizationId: string; filters: List${context.pluralPascalName}Input }) {`,
    "      return repo.list({",
    "        filters: list" + context.pluralPascalName + "InputSchema.parse(input.filters),",
    "        organizationId: input.organizationId",
    "      });",
    "    },",
    isArchiveEnabled(context)
      ? "    async unarchive(input: { id: string; organizationId: string }) {\n      return repo.unarchive(input);\n    },"
      : "",
    "    async update(input: { data: Update" + context.pascalName + "Input; id: string; organizationId: string }) {",
    "      const data = update" + context.pascalName + "InputSchema.parse(input.data);",
    workflowUpdateValidation,
    "      return repo.update({",
    "        data,",
    "        id: input.id,",
    "        organizationId: input.organizationId",
    "      });",
    "    }",
    "  };",
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiPostgresRepo(context: ReturnType<typeof createTemplateContext>) {
  const dbAssignmentLines = context.createFields.map((field) =>
    renderDbValueAssignment({
      accessPath: `input.data.${field.name}`,
      field,
      mode: "create"
    })
  );
  const updateAssignmentLines = context.updateFields.map((field) =>
    renderDbValueAssignment({
      accessPath: `input.data.${field.name}`,
      field,
      mode: "update"
    })
  );
  const recordShapeLines = context.resource.fields.map((field) =>
    `    ${field.name}: ${renderRecordValue(context, field)},`
  );
  const searchableFields = context.resource.fields.filter((field) => field.searchable);
  const sortableFields = getListSortableFields(context);
  const filterFields = getListFilterFields(context);
  const searchClauseLines = searchableFields.map((field) =>
    `      ilike(sql\`cast(\${${context.resource.resource}Table.${field.name}} as text)\`, pattern)`
  );
  const sortColumnCases = sortableFields.map(
    (field) =>
      `    case ${JSON.stringify(field.name)}:\n      return ${context.resource.resource}Table.${field.name};`
  );
  const sortValueCases = sortableFields.map((field) => {
    if (field.type === "datetime") {
      return `    case ${JSON.stringify(field.name)}:\n      return record.${field.name}.toISOString();`;
    }

    return `    case ${JSON.stringify(field.name)}:\n      return String(record.${field.name});`;
  });
  const cursorClauseCases = sortableFields.map((field) => {
    const tableField = `${context.resource.resource}Table.${field.name}`;
    const parsedValue =
      field.type === "datetime"
        ? "new Date(String(input.cursorRecord.sortValue))"
        : `input.cursorRecord.sortValue as ${field.type === "enum" ? `${context.pascalName}Record[${JSON.stringify(field.name)}]` : "string"}`;
    const comparator =
      field.type === "datetime"
        ? parsedValue
        : parsedValue;

    return [
      `    case ${JSON.stringify(field.name)}:`,
      "      return input.sortDirection === \"asc\"",
      "        ? or(",
      `            gt(${tableField}, ${comparator}),`,
      "            and(",
      `              eq(${tableField}, ${comparator}),`,
      `              gt(${context.resource.resource}Table.id, input.cursorRecord.id)`,
      "            )",
      "          )",
      "        : or(",
      `            lt(${tableField}, ${comparator}),`,
      "            and(",
      `              eq(${tableField}, ${comparator}),`,
      `              lt(${context.resource.resource}Table.id, input.cursorRecord.id)`,
      "            )",
      "          );"
    ].join("\n");
  });
  const filterClauseLines = filterFields.map((field) => {
    const tableField = `${context.resource.resource}Table.${field.name}`;

    return `          input.filters.${field.name} !== undefined ? eq(${tableField}, input.filters.${field.name}) : undefined,`;
  });

  return [
    `import type { ${context.pascalName}Record, List${context.pluralPascalName}Input, List${context.pluralPascalName}Response } from "@auditrail/domain/generated/${context.resourcePath}";`,
    `import { ${context.resource.resource}Table } from "@auditrail/db/schema";`,
    'import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";',
    "",
    `import type { AppDatabase } from "../../../plugins/database.js";`,
    `import type { ${context.pascalName}Repo } from "./repo.js";`,
    "",
    `export function createPostgres${context.pascalName}Repo(db: AppDatabase): ${context.pascalName}Repo {`,
    "  return {",
    isArchiveEnabled(context)
      ? [
          "    async archive(input) {",
          `      const [record] = await db.update(${context.resource.resource}Table).set({`,
          `        ${getArchiveFieldName(context)}: new Date(),`,
          "        updatedAt: new Date()",
          "      }).where(",
          "        and(",
          `          eq(${context.resource.resource}Table.id, input.id),`,
          `          eq(${context.resource.resource}Table.organizationId, input.organizationId),`,
          `          isNull(${context.resource.resource}Table.${getArchiveFieldName(context)})`,
          "        )",
          "      ).returning();",
          "",
          `      return record ? to${context.pascalName}Record(record) : undefined;`,
          "    },"
        ].join("\n")
      : "",
    "    async create(input) {",
    `      const [record] = await db.insert(${context.resource.resource}Table).values({`,
    "        organizationId: input.organizationId,",
    ...dbAssignmentLines,
    "      }).returning();",
    "",
    `      return to${context.pascalName}Record(record);`,
    "    },",
    "    async findById(input) {",
    `      const [record] = await db.select().from(${context.resource.resource}Table).where(`,
    "        and(",
    `          eq(${context.resource.resource}Table.id, input.id),`,
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
    "        )",
    "      ).limit(1);",
    "",
    `      return record ? to${context.pascalName}Record(record) : undefined;`,
    "    },",
    context.resource.crud.delete
      ? [
          "    async delete(input) {",
          `      const deleted = await db.delete(${context.resource.resource}Table).where(`,
          "        and(",
          `          eq(${context.resource.resource}Table.id, input.id),`,
          `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
          "        )",
          `      ).returning({ id: ${context.resource.resource}Table.id });`,
          "",
          "      return deleted.length > 0;",
          "    },"
        ].join("\n")
      : "",
    "    async list(input) {",
    "      const limit = Math.min(input.filters.limit ?? 50, 100);",
    "      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;",
    '      const sortBy = input.filters.sortBy ?? "createdAt";',
    '      const sortDirection = input.filters.sortDirection ?? "desc";',
    isArchiveEnabled(context)
      ? '      const archived = input.filters.archived ?? "exclude";'
      : "",
    `      const [cursorRecord] = input.filters.cursor ? await db.select({`,
    "        sortValue: resolveGeneratedListSortColumn(sortBy),",
    `        id: ${context.resource.resource}Table.id`,
    `      }).from(${context.resource.resource}Table).where(`,
    "        and(",
    `          eq(${context.resource.resource}Table.id, input.filters.cursor),`,
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
    "        )",
    "      ).limit(1) : [];",
    "",
    "      if (input.filters.cursor && !cursorRecord) {",
    '        throw new Error("invalid_cursor");',
    "      }",
    "",
    `      const records = await db.select().from(${context.resource.resource}Table).where(`,
    "        and(",
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId),`,
    isArchiveEnabled(context)
      ? [
          '          archived === "only"',
          `            ? isNotNull(${context.resource.resource}Table.${getArchiveFieldName(context)})`,
          '            : archived === "include"',
          "              ? undefined",
          `              : isNull(${context.resource.resource}Table.${getArchiveFieldName(context)}),`
        ].join("\n")
      : "",
    ...filterClauseLines,
    searchClauseLines.length > 0
      ? [
          "          pattern",
          "            ? or(",
          ...searchClauseLines.map((line, index) =>
            index < searchClauseLines.length - 1 ? `${line},` : line
          ),
          "            )",
          "            : undefined,"
        ].join("\n")
      : "          undefined,",
    "          cursorRecord",
    "            ? buildGeneratedListCursorClause({",
    "                cursorRecord,",
    "                sortBy,",
    "                sortDirection",
    "              })",
    "            : undefined",
    "        )",
    "      ).orderBy(...resolveGeneratedListOrder(sortBy, sortDirection)).limit(limit + 1);",
    "",
    "      const hasMore = records.length > limit;",
    "      const pageRecords = hasMore ? records.slice(0, limit) : records;",
    "",
    "      return {",
    `        items: pageRecords.map(to${context.pascalName}Record),`,
    "        pageInfo: {",
    "          hasMore,",
    "          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null",
    "        }",
    "      };",
    "    },",
    isArchiveEnabled(context)
      ? [
          "    async unarchive(input) {",
          `      const [record] = await db.update(${context.resource.resource}Table).set({`,
          `        ${getArchiveFieldName(context)}: null,`,
          "        updatedAt: new Date()",
          "      }).where(",
          "        and(",
          `          eq(${context.resource.resource}Table.id, input.id),`,
          `          eq(${context.resource.resource}Table.organizationId, input.organizationId),`,
          `          isNotNull(${context.resource.resource}Table.${getArchiveFieldName(context)})`,
          "        )",
          "      ).returning();",
          "",
          `      return record ? to${context.pascalName}Record(record) : undefined;`,
          "    },"
        ].join("\n")
      : "",
    "    async update(input) {",
    `      const [record] = await db.update(${context.resource.resource}Table).set({`,
    ...updateAssignmentLines,
    "        updatedAt: new Date()",
    "      }).where(",
    "        and(",
    `          eq(${context.resource.resource}Table.id, input.id),`,
    `          eq(${context.resource.resource}Table.organizationId, input.organizationId)`,
    "        )",
    "      ).returning();",
    "",
    `      return record ? to${context.pascalName}Record(record) : undefined;`,
    "    }",
    "  };",
    "}",
    "",
    "function resolveGeneratedListSortColumn(",
    `  sortBy: List${context.pluralPascalName}Input["sortBy"] extends infer T ? NonNullable<T> : never`,
    ") {",
    "  switch (sortBy) {",
    ...sortColumnCases,
    "    default:",
    `      return ${context.resource.resource}Table.createdAt;`,
    "  }",
    "}",
    "",
    "function resolveGeneratedListOrder(",
    `  sortBy: List${context.pluralPascalName}Input["sortBy"] extends infer T ? NonNullable<T> : never,`,
    '  sortDirection: "asc" | "desc"',
    ") {",
    "  const sortColumn = resolveGeneratedListSortColumn(sortBy);",
    "",
    '  return sortDirection === "asc"',
    `    ? [asc(sortColumn), asc(${context.resource.resource}Table.id)] as const`,
    `    : [desc(sortColumn), desc(${context.resource.resource}Table.id)] as const;`,
    "}",
    "",
    "function buildGeneratedListCursorClause(input: {",
    "  cursorRecord: {",
    "    id: string;",
    "    sortValue: unknown;",
    "  };",
    `  sortBy: List${context.pluralPascalName}Input["sortBy"] extends infer T ? NonNullable<T> : never;`,
    '  sortDirection: "asc" | "desc";',
    "}) {",
    "  switch (input.sortBy) {",
    ...cursorClauseCases,
    "    default:",
    "      return undefined;",
    "  }",
    "}",
    "",
    `function to${context.pascalName}Record(`,
    `  record: typeof ${context.resource.resource}Table.$inferSelect`,
    `): ${context.pascalName}Record {`,
    "  return {",
    "    id: record.id,",
    "    organizationId: record.organizationId,",
    ...recordShapeLines,
    isArchiveEnabled(context)
      ? `    ${getArchiveFieldName(context)}: record.${getArchiveFieldName(context)}?.toISOString(),`
      : "",
    "    createdAt: record.createdAt.toISOString(),",
    "    updatedAt: record.updatedAt.toISOString()",
    "  };",
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiRoutes(context: ReturnType<typeof createTemplateContext>) {
  const listPath = context.apiBasePath.replace("/api", "");

  return [
    'import type { FastifyInstance, FastifyReply } from "fastify";',
    'import { z } from "zod";',
    "",
    `import type { create${context.pascalName}Service } from "./service.js";`,
    "",
    "const organizationParamsSchema = z.object({",
    "  organizationId: z.string().uuid()",
    "});",
    "",
    "const listQuerySchema = z.object({",
    ...renderRouteListQuerySchemaLines(context),
    "});",
    "",
    "const resourceIdParamsSchema = z.object({",
    "  id: z.string().uuid(),",
    "  organizationId: z.string().uuid()",
    "});",
    "",
    'type GeneratedResourceAccessRole = "owner" | "admin" | "member" | "viewer";',
    'type GeneratedResourcePolicyAction = "archive" | "read" | "workflow" | "write";',
    'type GeneratedResourcePolicyMode = "organization-role" | "ownership-aware";',
    "",
    "interface GeneratedResourcePolicyRule {",
    "  mode: GeneratedResourcePolicyMode;",
    "  ownerField?: string;",
    "}",
    "",
    "const generatedResourcePolicy = {",
    `  archive: ${formatGeneratedResourcePolicyRule(context.resource.policy.archive)},`,
    `  read: ${formatGeneratedResourcePolicyRule(context.resource.policy.read)},`,
    `  workflow: ${formatGeneratedResourcePolicyRule(context.resource.policy.workflow)},`,
    `  write: ${formatGeneratedResourcePolicyRule(context.resource.policy.write)}`,
    "} as const satisfies Record<GeneratedResourcePolicyAction, GeneratedResourcePolicyRule>;",
    "",
    `export interface ${context.pascalName}RoutesOptions {`,
    "  access: {",
    "    assertOrganizationAccess(input: {",
    "      allowedRoles: readonly GeneratedResourceAccessRole[];",
    "      organizationId: string;",
    "      userId: string;",
    "    }): Promise<void>;",
    "    assertResourceAccess(input: {",
    "      action: GeneratedResourcePolicyAction;",
    "      organizationId: string;",
    "      policy: GeneratedResourcePolicyRule;",
    "      resource: Record<string, unknown>;",
    "      userId: string;",
    "    }): Promise<void>;",
    "  };",
    `  service: ReturnType<typeof create${context.pascalName}Service>;`,
    "}",
    "",
    `export async function register${context.pascalName}Routes(`,
    "  app: FastifyInstance,",
    `  options: ${context.pascalName}RoutesOptions`,
    ") {",
    `  app.get("${listPath}", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = organizationParamsSchema.safeParse(request.params);",
    "    const query = listQuerySchema.safeParse(request.query);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success || !query.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      await options.access.assertOrganizationAccess({",
    '        allowedRoles: ["owner", "admin", "member", "viewer"],',
    "        organizationId: params.data.organizationId,",
    "        userId: user.id",
    "      });",
    "",
    "      return options.service.list({",
    "        filters: query.data,",
    "        organizationId: params.data.organizationId",
    "      });",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "",
    `  app.post("${listPath}", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = organizationParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      await options.access.assertOrganizationAccess({",
    '        allowedRoles: ["owner", "admin", "member"],',
    "        organizationId: params.data.organizationId,",
    "        userId: user.id",
    "      });",
    "",
    "      return reply.code(201).send(",
    "        await options.service.create({",
    '          data: request.body as Parameters<typeof options.service.create>[0]["data"],',
    "          organizationId: params.data.organizationId",
    "        })",
    "      );",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "",
    `  app.get("${listPath}/:id", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = resourceIdParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      const resource = await options.service.get({",
    "        id: params.data.id,",
    "        organizationId: params.data.organizationId",
    "      });",
    "",
    "      if (!resource) {",
    '        return reply.code(404).send({ error: "not_found" });',
    "      }",
    "",
    "      await options.access.assertResourceAccess({",
    '        action: "read",',
    "        organizationId: params.data.organizationId,",
    "        policy: generatedResourcePolicy.read,",
    "        resource,",
    "        userId: user.id",
    "      });",
    "",
    "      return resource;",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    "",
    `  app.patch("${listPath}/:id", async (request, reply) => {`,
    "    const user = request.sessionUser;",
    "    const params = resourceIdParamsSchema.safeParse(request.params);",
    "",
    "    if (!user) {",
    '      return reply.code(401).send({ error: "missing_session" });',
    "    }",
    "",
    "    if (!params.success) {",
    '      return reply.code(400).send({ error: "invalid_request" });',
    "    }",
    "",
    "    try {",
    "      const currentResource = await options.service.get({",
    "        id: params.data.id,",
    "        organizationId: params.data.organizationId",
    "      });",
    "",
    "      if (!currentResource) {",
    '        return reply.code(404).send({ error: "not_found" });',
    "      }",
    "",
    "      await options.access.assertResourceAccess({",
    '        action: "write",',
    "        organizationId: params.data.organizationId,",
    "        policy: generatedResourcePolicy.write,",
    "        resource: currentResource,",
    "        userId: user.id",
    "      });",
    "",
    "      const resource = await options.service.update({",
    '        data: request.body as Parameters<typeof options.service.update>[0]["data"],',
    "        id: params.data.id,",
    "        organizationId: params.data.organizationId",
    "      });",
    "",
    "      if (!resource) {",
    '        return reply.code(404).send({ error: "not_found" });',
    "      }",
    "",
    "      return resource;",
    "    } catch (error) {",
    "      return mapGeneratedResourceAccessError(reply, error);",
    "    }",
    "  });",
    isArchiveEnabled(context)
      ? [
          "",
          `  app.post("${listPath}/:id/archive", async (request, reply) => {`,
          "    const user = request.sessionUser;",
          "    const params = resourceIdParamsSchema.safeParse(request.params);",
          "",
          "    if (!user) {",
          '      return reply.code(401).send({ error: "missing_session" });',
          "    }",
          "",
          "    if (!params.success) {",
          '      return reply.code(400).send({ error: "invalid_request" });',
          "    }",
          "",
          "    try {",
          "      const currentResource = await options.service.get({",
          "        id: params.data.id,",
          "        organizationId: params.data.organizationId",
          "      });",
          "",
          "      if (!currentResource) {",
          '        return reply.code(404).send({ error: "not_found" });',
          "      }",
          "",
          "      await options.access.assertResourceAccess({",
          '        action: "archive",',
          "        organizationId: params.data.organizationId,",
          "        policy: generatedResourcePolicy.archive,",
          "        resource: currentResource,",
          "        userId: user.id",
          "      });",
          "",
          "      const resource = await options.service.archive({",
          "        id: params.data.id,",
          "        organizationId: params.data.organizationId",
          "      });",
          "",
          "      if (!resource) {",
          '        return reply.code(404).send({ error: "not_found" });',
          "      }",
          "",
          "      return resource;",
          "    } catch (error) {",
          "      return mapGeneratedResourceAccessError(reply, error);",
          "    }",
          "  });",
          "",
          `  app.post("${listPath}/:id/unarchive", async (request, reply) => {`,
          "    const user = request.sessionUser;",
          "    const params = resourceIdParamsSchema.safeParse(request.params);",
          "",
          "    if (!user) {",
          '      return reply.code(401).send({ error: "missing_session" });',
          "    }",
          "",
          "    if (!params.success) {",
          '      return reply.code(400).send({ error: "invalid_request" });',
          "    }",
          "",
          "    try {",
          "      const currentResource = await options.service.get({",
          "        id: params.data.id,",
          "        organizationId: params.data.organizationId",
          "      });",
          "",
          "      if (!currentResource) {",
          '        return reply.code(404).send({ error: "not_found" });',
          "      }",
          "",
          "      await options.access.assertResourceAccess({",
          '        action: "archive",',
          "        organizationId: params.data.organizationId,",
          "        policy: generatedResourcePolicy.archive,",
          "        resource: currentResource,",
          "        userId: user.id",
          "      });",
          "",
          "      const resource = await options.service.unarchive({",
          "        id: params.data.id,",
          "        organizationId: params.data.organizationId",
          "      });",
          "",
          "      if (!resource) {",
          '        return reply.code(404).send({ error: "not_found" });',
          "      }",
          "",
          "      return resource;",
          "    } catch (error) {",
          "      return mapGeneratedResourceAccessError(reply, error);",
          "    }",
          "  });"
        ].join("\n")
      : "",
    context.resource.crud.delete
      ? [
          "",
          `  app.delete("${listPath}/:id", async (request, reply) => {`,
          "    const user = request.sessionUser;",
          "    const params = resourceIdParamsSchema.safeParse(request.params);",
          "",
          "    if (!user) {",
          '      return reply.code(401).send({ error: "missing_session" });',
          "    }",
          "",
          "    if (!params.success) {",
          '      return reply.code(400).send({ error: "invalid_request" });',
          "    }",
          "",
          "    try {",
          "      const currentResource = await options.service.get({",
          "        id: params.data.id,",
          "        organizationId: params.data.organizationId",
          "      });",
          "",
          "      if (!currentResource) {",
          '        return reply.code(404).send({ error: "not_found" });',
          "      }",
          "",
          "      await options.access.assertResourceAccess({",
          '        action: "write",',
          "        organizationId: params.data.organizationId,",
          "        policy: generatedResourcePolicy.write,",
          "        resource: currentResource,",
          "        userId: user.id",
          "      });",
          "",
          "      const deleted = await options.service.delete({",
          "        id: params.data.id,",
          "        organizationId: params.data.organizationId",
          "      });",
          "",
          "      if (!deleted) {",
          '        return reply.code(404).send({ error: "not_found" });',
          "      }",
          "",
          "      return reply.code(204).send();",
          "    } catch (error) {",
          "      return mapGeneratedResourceAccessError(reply, error);",
          "    }",
          "  });"
        ].join("\n")
      : "",
    "}",
    "",
    "function mapGeneratedResourceAccessError(reply: FastifyReply, error: unknown) {",
    '  if (error instanceof Error && error.message === "forbidden") {',
    '    return reply.code(403).send({ error: "forbidden" });',
    "  }",
    "",
    '  if (error instanceof Error && error.message.startsWith("invalid_workflow_transition:")) {',
    "    return reply.code(400).send({",
    '      error: error.message.slice("invalid_workflow_transition:".length)',
    "    });",
    "  }",
    "",
    '  if (error instanceof Error && error.message === "invalid_cursor") {',
    '    return reply.code(400).send({ error: "invalid_cursor" });',
    "  }",
    "",
    "  throw error;",
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiRoutesTest(context: ReturnType<typeof createTemplateContext>) {
  const listPath = context.apiBasePath.replace(
    "/api",
    ""
  ).replace(":organizationId", "11111111-1111-4111-8111-111111111111");

  return [
    'import Fastify from "fastify";',
    'import { describe, expect, it } from "vitest";',
    "",
    `import { register${context.pascalName}Routes } from "../routes.js";`,
    `import type { create${context.pascalName}Service } from "../service.js";`,
    "",
    `describe("register${context.pascalName}Routes", () => {`,
    `  it("requires a session before listing ${context.pluralLabel.toLowerCase()}", async () => {`,
    "    const app = buildTestApp({}, { session: false });",
    "",
    "    const response = await app.inject({",
    `      url: "${listPath}${isArchiveEnabled(context) ? '?archived=only' : ""}"`,
    "    });",
    "",
    "    expect(response.statusCode).toBe(401);",
    '    expect(response.json()).toEqual({ error: "missing_session" });',
    "  });",
    "",
    `  it("lists ${context.pluralLabel.toLowerCase()} for the current organization", async () => {`,
    "    const app = buildTestApp({",
    "      async list(input) {",
    "        expect(input).toEqual({",
    "          filters: {",
    isArchiveEnabled(context) ? '            archived: "only",' : "",
    "            cursor: undefined,",
    "            limit: undefined,",
    "            query: undefined,",
    '            sortBy: "createdAt",',
    '            sortDirection: "desc"',
    "          },",
    '          organizationId: "11111111-1111-4111-8111-111111111111",',
    "        });",
    "",
    "        return {",
    "          items: [",
    "            {",
    '              createdAt: "2026-06-29T00:00:00.000Z",',
    renderExpectedFieldObject(context.resource.fields),
    '              id: "22222222-2222-4222-8222-222222222222",',
    '              organizationId: "11111111-1111-4111-8111-111111111111",',
    '              updatedAt: "2026-06-29T00:00:00.000Z"',
    "            }",
    "          ],",
    "          pageInfo: {",
    "            hasMore: false,",
    "            nextCursor: null",
    "          }",
    "        };",
    "      }",
    "    });",
    "",
    "    const response = await app.inject({",
    `      url: "${listPath}${isArchiveEnabled(context) ? '?archived=only' : ""}"`,
    "    });",
    "",
    "    expect(response.statusCode).toBe(200);",
    "    expect(response.json()).toEqual({",
    "      items: [",
    "        {",
    '          createdAt: "2026-06-29T00:00:00.000Z",',
    renderExpectedFieldObject(context.resource.fields),
    '          id: "22222222-2222-4222-8222-222222222222",',
    '          organizationId: "11111111-1111-4111-8111-111111111111",',
    '          updatedAt: "2026-06-29T00:00:00.000Z"',
    "        }",
    "      ],",
    "      pageInfo: {",
    "        hasMore: false,",
    "        nextCursor: null",
    "      }",
    "    });",
    "  });",
    "",
    '  it("maps forbidden organization access to 403", async () => {',
    "    const app = buildTestApp({}, {",
    '      accessError: new Error("forbidden")',
    "    });",
    "",
    "    const response = await app.inject({",
    '      method: "POST",',
    "      payload: {",
    renderCreateInputObject(context.resource.fields),
    "      },",
    `      url: "${listPath}"`,
    "    });",
    "",
    "    expect(response.statusCode).toBe(403);",
    '    expect(response.json()).toEqual({ error: "forbidden" });',
    "  });",
    context.resource.crud.delete
      ? [
          "",
          `  it("deletes ${context.label.toLowerCase()} records for authorized organization members", async () => {`,
          "    const app = buildTestApp({",
          "      async delete(input) {",
          "        expect(input).toEqual({",
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111"',
          "        });",
          "",
          "        return true;",
          "      }",
          "    });",
          "",
          "    const response = await app.inject({",
          '      method: "DELETE",',
          `      url: "${listPath}/22222222-2222-4222-8222-222222222222"`,
          "    });",
          "",
          "    expect(response.statusCode).toBe(204);",
          "  });"
        ].join("\n")
      : "",
    isArchiveEnabled(context)
      ? [
          "",
          `  it("archives ${context.label.toLowerCase()} records for authorized organization members", async () => {`,
          "    const app = buildTestApp({",
          "      async get() {",
          "        return {",
          '          createdAt: "2026-06-29T00:00:00.000Z",',
          renderExpectedFieldObject(context.resource.fields),
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111",',
          '          updatedAt: "2026-06-29T00:00:00.000Z"',
          "        };",
          "      },",
          "      async archive(input) {",
          "        expect(input).toEqual({",
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111"',
          "        });",
          "",
          "        return {",
          '          createdAt: "2026-06-29T00:00:00.000Z",',
          renderExpectedFieldObject(context.resource.fields),
          `          ${getArchiveFieldName(context)}: "2026-07-01T00:00:00.000Z",`,
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111",',
          '          updatedAt: "2026-07-01T00:00:00.000Z"',
          "        };",
          "      }",
          "    });",
          "",
          "    const response = await app.inject({",
          '      method: "POST",',
          `      url: "${listPath}/22222222-2222-4222-8222-222222222222/archive"`,
          "    });",
          "",
          "    expect(response.statusCode).toBe(200);",
          `    expect(response.json()).toMatchObject({ ${getArchiveFieldName(context)}: "2026-07-01T00:00:00.000Z" });`,
          "  });",
          "",
          `  it("unarchives ${context.label.toLowerCase()} records for authorized organization members", async () => {`,
          "    const app = buildTestApp({",
          "      async get() {",
          "        return {",
          `          ${getArchiveFieldName(context)}: "2026-07-01T00:00:00.000Z",`,
          '          createdAt: "2026-06-29T00:00:00.000Z",',
          renderExpectedFieldObject(context.resource.fields),
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111",',
          '          updatedAt: "2026-07-01T00:00:00.000Z"',
          "        };",
          "      },",
          "      async unarchive(input) {",
          "        expect(input).toEqual({",
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111"',
          "        });",
          "",
          "        return {",
          '          createdAt: "2026-06-29T00:00:00.000Z",',
          renderExpectedFieldObject(context.resource.fields),
          `          ${getArchiveFieldName(context)}: undefined,`,
          '          id: "22222222-2222-4222-8222-222222222222",',
          '          organizationId: "11111111-1111-4111-8111-111111111111",',
          '          updatedAt: "2026-07-01T00:00:00.000Z"',
          "        };",
          "      }",
          "    });",
          "",
          "    const response = await app.inject({",
          '      method: "POST",',
          `      url: "${listPath}/22222222-2222-4222-8222-222222222222/unarchive"`,
          "    });",
          "",
          "    expect(response.statusCode).toBe(200);",
          `    expect(response.json()).not.toHaveProperty(${JSON.stringify(getArchiveFieldName(context))});`,
          "  });"
        ].join("\n")
      : "",
    "});",
    "",
    "function buildTestApp(",
    `  overrides: Partial<ReturnType<typeof create${context.pascalName}Service>>,`,
    "  options: {",
    "    accessError?: Error;",
    "    recordAccessError?: Error;",
    "    session?: boolean;",
    "  } = {}",
    ") {",
    "  const app = Fastify();",
    "  const useSession = options.session ?? true;",
    "",
    '  app.decorateRequest("sessionUser");',
    '  app.addHook("preHandler", async (request) => {',
    "    request.sessionUser = useSession",
    "      ? {",
    '          email: "user@example.com",',
    '          id: "user-1"',
    "        }",
    "      : undefined;",
    "  });",
    "",
    `  app.register(register${context.pascalName}Routes, {`,
    "    access: {",
    "      async assertOrganizationAccess() {",
    "        if (options.accessError) {",
    "          throw options.accessError;",
    "        }",
    "      },",
    "      async assertResourceAccess() {",
    "        if (options.recordAccessError) {",
    "          throw options.recordAccessError;",
    "        }",
    "      }",
    "    },",
    `    service: create${context.pascalName}ServiceStub(overrides)`,
    "  });",
    "",
    "  return app;",
    "}",
    "",
    `function create${context.pascalName}ServiceStub(`,
    `  overrides: Partial<ReturnType<typeof create${context.pascalName}Service>>`,
    ") {",
    "  return {",
    isArchiveEnabled(context)
      ? [
          "    async archive() {",
          '      throw new Error("not implemented");',
          "    },"
        ].join("\n")
      : "",
    "    async create() {",
    '      throw new Error("not implemented");',
    "    },",
    context.resource.crud.delete
      ? [
          "    async delete() {",
          '      throw new Error("not implemented");',
          "    },"
        ].join("\n")
      : "",
    "    async get() {",
    '      throw new Error("not implemented");',
    "    },",
    "    async list() {",
    "      return { items: [], pageInfo: { hasMore: false, nextCursor: null } };",
    "    },",
    isArchiveEnabled(context)
      ? [
          "    async unarchive() {",
          '      throw new Error("not implemented");',
          "    },"
        ].join("\n")
      : "",
    "    async update() {",
    '      throw new Error("not implemented");',
    "    },",
    "    ...overrides",
    "  };",
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiRoutesIntegrationTest(
  context: ReturnType<typeof createTemplateContext>
) {
  const tableName = getPluralPath(context.resource);
  const primaryField = context.resource.fields[0];
  const createExpectedFields = renderExpectedFieldObject(context.resource.fields);
  const createPayloadFields = renderCreateInputObject(context.resource.fields);
  const updateValue = JSON.stringify(getAlternateExampleValue(primaryField));
  const updatedExpectedFields = context.resource.fields
    .map((field) =>
      field.name === primaryField.name
        ? `      ${field.name}: ${updateValue},`
        : `      ${field.name}: ${JSON.stringify(getExampleValue(field))},`
    )
    .join("\n");

  return [
    'import { afterAll, beforeEach, describe, expect, it } from "vitest";',
    'import pg from "pg";',
    'import { z } from "zod";',
    "",
    'import { API_VERSION_PREFIX } from "../../../../api-version.js";',
    'import { buildApp } from "../../../../app.js";',
    'import { loadConfig } from "../../../../config.js";',
    'import { loadEnvFiles } from "../../../../env-files.js";',
    'import { hashToken } from "../../../auth/tokens.js";',
    'import { seedDemoProject } from "../../../../../../../packages/db/src/seed.js";',
    "",
    "const config = loadConfig(loadEnvFiles());",
    "const integrationEnv = z",
    "  .object({",
    "    TEST_DATABASE_URL: z.string().url()",
    "  })",
    "  .parse(loadEnvFiles());",
    "const databaseUrl = integrationEnv.TEST_DATABASE_URL;",
    "const authTokenSecret = config.AUTH_TOKEN_SECRET!;",
    "",
    `describe("${context.resource.resource} generated resource integration", () => {`,
    "  const pool = new pg.Pool({",
    "    connectionString: databaseUrl",
    "  });",
    "  const app = buildApp({",
    "    infrastructure: {",
    "      databaseUrl",
    "    },",
    "    useInfrastructure: true,",
    "    useRateLimit: false",
    "  });",
    "",
    "  beforeEach(async () => {",
    "    try {",
    "      await truncateAll();",
    "    } catch (error) {",
    "      if (",
    "        error instanceof Error &&",
    '        "code" in error &&',
    '        error.code === "3D000"',
    "      ) {",
    "        throw new Error(",
    '          "TEST_DATABASE_URL database does not exist. Run `pnpm db:create:test && pnpm db:migrate:test` first."',
    "        );",
    "      }",
    "",
    "      throw error;",
    "    }",
    "  });",
    "",
    "  afterAll(async () => {",
    "    await app.close();",
    "    await pool.end();",
    "  });",
    "",
    `  it("creates, lists, reads, updates, and deletes ${context.pluralLabel.toLowerCase()} through the installed API routes", async () => {`,
    "    const session = await createSessionMember();",
    "    const createResponse = await app.inject({",
    '      method: "POST",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    "      payload: {",
    createPayloadFields,
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
    "    });",
    "",
    "    expect(createResponse.statusCode).toBe(201);",
    "    expect(createResponse.json()).toMatchObject({",
    '      createdAt: expect.any(String),',
    createExpectedFields,
    '      id: expect.any(String),',
    "      organizationId: session.organizationId,",
    '      updatedAt: expect.any(String)',
    "    });",
    "",
    "    const createdId = createResponse.json().id as string;",
    "",
    "    const listResponse = await app.inject({",
    '      method: "GET",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
    "    });",
    "",
    "    expect(listResponse.statusCode).toBe(200);",
    "    expect(listResponse.json()).toEqual({",
    "      items: [",
    "        {",
    '          createdAt: expect.any(String),',
    createExpectedFields,
    "          id: createdId,",
    "          organizationId: session.organizationId,",
    '          updatedAt: expect.any(String)',
    "        }",
    "      ],",
    "      pageInfo: {",
    "        hasMore: false,",
    "        nextCursor: null",
    "      }",
    "    });",
    "",
    "    const getResponse = await app.inject({",
    '      method: "GET",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}\``,
    "    });",
    "",
    "    expect(getResponse.statusCode).toBe(200);",
    "    expect(getResponse.json()).toMatchObject({",
    createExpectedFields,
    "      id: createdId,",
    "      organizationId: session.organizationId",
    "    });",
    "",
    "    const updateResponse = await app.inject({",
    '      method: "PATCH",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    "      payload: {",
    `        ${primaryField.name}: ${updateValue}`,
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}\``,
    "    });",
    "",
    "    expect(updateResponse.statusCode).toBe(200);",
    "    expect(updateResponse.json()).toMatchObject({",
    updatedExpectedFields,
    "      id: createdId,",
    "      organizationId: session.organizationId",
    "    });",
    isArchiveEnabled(context)
      ? [
          "",
          "    const archiveResponse = await app.inject({",
          '      method: "POST",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}/archive\``,
          "    });",
          "",
          "    expect(archiveResponse.statusCode).toBe(200);",
          `    expect(archiveResponse.json()).toMatchObject({ ${getArchiveFieldName(context)}: expect.any(String) });`,
          "",
          "    const archivedListResponse = await app.inject({",
          '      method: "GET",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
          "    });",
          "",
          "    expect(archivedListResponse.statusCode).toBe(200);",
          "    expect(archivedListResponse.json()).toEqual({",
          "      items: [],",
          "      pageInfo: {",
          "        hasMore: false,",
          "        nextCursor: null",
          "      }",
          "    });",
          "",
          "    const archivedOnlyResponse = await app.inject({",
          '      method: "GET",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}?archived=only\``,
          "    });",
          "",
          "    expect(archivedOnlyResponse.statusCode).toBe(200);",
          "    expect(archivedOnlyResponse.json()).toEqual({",
          "      items: [",
          "        {",
          '          createdAt: expect.any(String),',
          updatedExpectedFields,
          `          ${getArchiveFieldName(context)}: expect.any(String),`,
          "          id: createdId,",
          "          organizationId: session.organizationId,",
          '          updatedAt: expect.any(String)',
          "        }",
          "      ],",
          "      pageInfo: {",
          "        hasMore: false,",
          "        nextCursor: null",
          "      }",
          "    });",
          "",
          "    const unarchiveResponse = await app.inject({",
          '      method: "POST",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}/unarchive\``,
          "    });",
          "",
          "    expect(unarchiveResponse.statusCode).toBe(200);",
          `    expect(unarchiveResponse.json()).not.toHaveProperty(${JSON.stringify(getArchiveFieldName(context))});`,
          "",
          "    const unarchivedListResponse = await app.inject({",
          '      method: "GET",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
          "    });",
          "",
          "    expect(unarchivedListResponse.statusCode).toBe(200);",
          "    expect(unarchivedListResponse.json()).toEqual({",
          "      items: [",
          "        {",
          '          createdAt: expect.any(String),',
          updatedExpectedFields,
          "          id: createdId,",
          "          organizationId: session.organizationId,",
          '          updatedAt: expect.any(String)',
          "        }",
          "      ],",
          "      pageInfo: {",
          "        hasMore: false,",
          "        nextCursor: null",
          "      }",
          "    });"
        ].join("\n")
      : "",
    context.resource.crud.delete
      ? [
          "",
          "    const deleteResponse = await app.inject({",
          '      method: "DELETE",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}/${"${createdId}"}\``,
          "    });",
          "",
          "    expect(deleteResponse.statusCode).toBe(204);",
          "",
          "    const deletedListResponse = await app.inject({",
          '      method: "GET",',
          "      headers: {",
          "        cookie: session.cookie",
          "      },",
          `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${session.organizationId}"}/${tableName}\``,
          "    });",
          "",
          "    expect(deletedListResponse.statusCode).toBe(200);",
          "    expect(deletedListResponse.json()).toEqual({",
          "      items: [],",
          "      pageInfo: {",
          "        hasMore: false,",
          "        nextCursor: null",
          "      }",
          "    });"
        ].join("\n")
      : "",
    "  });",
    "",
    `  it("does not expose ${context.pluralLabel.toLowerCase()} across organizations", async () => {`,
    "    const session = await createSessionMember();",
    '    const otherOrganization = await createOrganization("OtherCo");',
    "",
    "    const response = await app.inject({",
    '      method: "GET",',
    "      headers: {",
    "        cookie: session.cookie",
    "      },",
    `      url: \`${"${API_VERSION_PREFIX}"}/organizations/${"${otherOrganization.id}"}/${tableName}\``,
    "    });",
    "",
    "    expect(response.statusCode).toBe(403);",
    '    expect(response.json()).toEqual({ error: "forbidden" });',
    "  });",
    "",
    "  async function truncateAll() {",
    "    await pool.query(`",
    "      TRUNCATE TABLE",
    `        ${tableName},`,
    '        "job_outbox",',
    "        project_webhook_deliveries,",
    "        project_webhook_endpoints,",
    "        audit_events,",
    "        api_keys,",
    "        auth_sessions,",
    "        auth_magic_links,",
    "        organization_memberships,",
    "        organization_invitations,",
    "        user_organization_onboarding_states,",
    "        organization_installed_products,",
    "        projects,",
    "        organizations,",
    '        users',
    "      RESTART IDENTITY CASCADE",
    "    `);",
    "  }",
    "",
    "  async function createSessionMember() {",
    "    const seeded = await seedDemoProject({",
    "      databaseUrl",
    "    });",
    "    const user = await pool.query<{ id: string }>(",
    '      `insert into "users" ("email")',
    '       values ($1)',
    "       returning \"id\"`,",
    '      ["integration-owner@example.com"]',
    "    );",
    "    const userId = user.rows[0]!.id;",
    "",
    "    await pool.query(",
    '      `insert into "organization_memberships" ("organization_id", "user_id", "role")',
    "       values ($1, $2, 'owner')`,",
    "      [seeded.organizationId, userId]",
    "    );",
    "",
    '    const sessionToken = "integration-session-token";',
    "",
    "    await pool.query(",
    '      `insert into "auth_sessions" ("user_id", "token_hash", "expires_at")',
    "       values ($1, $2, now() + interval '30 day')`,",
    "      [userId, hashToken(sessionToken, { secret: authTokenSecret })]",
    "    );",
    "",
    "    return {",
    "      cookie: `${config.AUTH_SESSION_COOKIE_NAME}=${sessionToken}`,",
    "      organizationId: seeded.organizationId,",
    "      userId",
    "    };",
    "  }",
    "",
    "  async function createOrganization(name: string) {",
    "    const result = await pool.query<{ id: string }>(",
    '      `insert into "organizations" ("name")',
    '       values ($1)',
    "       returning \"id\"`,",
    "      [name]",
    "    );",
    "",
    "    return {",
    "      id: result.rows[0]!.id",
    "    };",
    "  }",
    "});"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderApiServiceTest(context: ReturnType<typeof createTemplateContext>) {
  return [
    'import { describe, expect, it } from "vitest";',
    "",
    `import { create${context.pascalName}Service } from "../service.js";`,
    "",
    `describe("create${context.pascalName}Service", () => {`,
    `  it("validates create input before writing ${context.label.toLowerCase()} records", async () => {`,
    `    const service = create${context.pascalName}Service({`,
    isArchiveEnabled(context)
      ? [
          "      async archive() {",
          "        return undefined;",
          "      },"
        ].join("\n")
      : "",
    "      async create(input) {",
    "        return {",
    "          id: \"00000000-0000-0000-0000-000000000001\",",
    "          organizationId: input.organizationId,",
    renderObjectLiteralFields(context.resource.fields),
    '          createdAt: "2026-06-29T00:00:00.000Z",',
    '          updatedAt: "2026-06-29T00:00:00.000Z"',
    "        };",
    "      },",
    context.resource.crud.delete
      ? [
          "      async delete() {",
          "        return true;",
          "      },"
        ].join("\n")
      : "",
    "      async findById() {",
    "        return undefined;",
    "      },",
    "      async list() {",
    "        return { items: [], pageInfo: { hasMore: false, nextCursor: null } };",
    "      },",
    isArchiveEnabled(context)
      ? [
          "      async unarchive() {",
          "        return undefined;",
          "      },"
        ].join("\n")
      : "",
    "      async update() {",
    "        return undefined;",
    "      }",
    "    });",
    "",
    "    await expect(",
    "      service.create({",
    "        data: {",
    renderCreateInputObject(context.resource.fields).replace(/^        /gm, "          "),
    "        },",
    '        organizationId: "00000000-0000-0000-0000-000000000001"',
    "      })",
    "    ).resolves.toMatchObject({",
    renderExpectedFieldObject(context.resource.fields),
    "    });",
    "  });",
    "});"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderWebIndex(context: ReturnType<typeof createTemplateContext>) {
  return [
    `export * from "./api/${context.resourcePath}-client.js";`,
    `export * from "./components/${context.resourcePath}-empty-state.js";`,
    `export * from "./components/${context.resourcePath}-form.js";`,
    `export * from "./components/${context.resourcePath}-screen.js";`,
    `export * from "./components/${context.resourcePath}-table.js";`,
    'export * from "./domain/schemas.js";'
  ].join("\n");
}

function renderWebApiClient(context: ReturnType<typeof createTemplateContext>) {
  const organizationPath = context.apiBasePath.replace(
    ":organizationId",
    "${organizationId}"
  );
  const filterFields = getListFilterFields(context);
  const sortableValues = getListSortableFields(context)
    .map((field) => JSON.stringify(field.name))
    .join(", ");
  const listOptionFields = [
    isArchiveEnabled(context)
      ? 'archived?: "exclude" | "include" | "only";'
      : "",
    "cursor?: string;",
    "limit?: number;",
    "query?: string;",
    `sortBy?: ${sortableValues
      .split(", ")
      .map((value) => value)
      .join(" | ")};`,
    'sortDirection?: "asc" | "desc";',
    ...filterFields.map((field) => `    ${field.name}?: ${renderTypeScriptFieldType(field)};`)
  ]
    .filter(Boolean)
    .join("\n");
  const listQueryEntries = [
    isArchiveEnabled(context) ? "    archived: options?.archived," : "",
    "    cursor: options?.cursor,",
    "    limit: options?.limit,",
    "    query: options?.query,",
    "    sortBy: options?.sortBy,",
    "    sortDirection: options?.sortDirection,",
    ...filterFields.map((field) => `    ${field.name}: options?.${field.name},`)
  ]
    .filter(Boolean)
    .join("\n");

  return [
    'import type { ApiClient } from "@/src/lib/api/api-client";',
    `import { ${context.resource.resource}RecordSchema } from "@/src/features/${context.resourcePath}/domain/schemas";`,
    'import { z } from "zod";',
    "",
    `const ${context.resource.resource}PageInfoSchema = z.object({`,
    "  hasMore: z.boolean(),",
    "  nextCursor: z.string().nullable()",
    "});",
    "",
    `const ${context.resource.resource}ListResponseSchema = z.object({`,
    `  items: z.array(${context.resource.resource}RecordSchema),`,
    `  pageInfo: ${context.resource.resource}PageInfoSchema`,
    "});",
    "",
    "export function createResourceClient(apiClient: ApiClient) {",
    "  return {",
    "    async create(organizationId: string, body: Record<string, unknown>) {",
    `      return ${context.resource.resource}RecordSchema.parse(`,
    "        await apiClient.request({",
    "          body,",
    '          method: "POST",',
    `          path: \`${organizationPath}\` as never`,
    "        })",
    "      );",
    "    },",
    "    async get(organizationId: string, id: string) {",
    `      return ${context.resource.resource}RecordSchema.parse(`,
    "        await apiClient.request({",
    `          path: \`${organizationPath}/${"${id}"}\` as never`,
    "        })",
    "      );",
    "    },",
    "    async list(",
    "      organizationId: string,",
    "      options?: {",
    listOptionFields,
    "      }",
    "    ) {",
    `      return ${context.resource.resource}ListResponseSchema.parse(`,
    "        await apiClient.request({",
    `          path: \`${organizationPath}\${buildListQuery(options)}\` as never`,
    "        })",
    "      );",
    "    },",
    "    async update(organizationId: string, id: string, body: Record<string, unknown>) {",
    `      return ${context.resource.resource}RecordSchema.parse(`,
    "        await apiClient.request({",
    "          body,",
    '          method: "PATCH",',
    `          path: \`${organizationPath}/${"${id}"}\` as never`,
    "        })",
    "      );",
    "    },",
    context.resource.crud.delete
      ? [
          "    async delete(organizationId: string, id: string) {",
          "      await apiClient.request({",
          '        method: "DELETE",',
          `        path: \`${organizationPath}/${"${id}"}\` as never`,
          "      });",
          "    }"
        ].join("\n")
      : ""
    ,
    isArchiveEnabled(context)
      ? [
          "    async archive(organizationId: string, id: string) {",
          `      return ${context.resource.resource}RecordSchema.parse(`,
          "        await apiClient.request({",
          '          method: "POST",',
          `          path: \`${organizationPath}/${"${id}"}/archive\` as never`,
          "        })",
          "      );",
          "    },",
          "    async unarchive(organizationId: string, id: string) {",
          `      return ${context.resource.resource}RecordSchema.parse(`,
          "        await apiClient.request({",
          '          method: "POST",',
          `          path: \`${organizationPath}/${"${id}"}/unarchive\` as never`,
          "        })",
          "      );",
          "    }"
        ].join("\n")
      : ""
    ,
    "  };",
    "}",
    "",
    "function buildListQuery(options?: {",
    listOptionFields,
    "}) {",
    "  const query = new URLSearchParams();",
    "",
    "  for (const [key, value] of Object.entries({",
    listQueryEntries,
    "  })) {",
    "    if (value === undefined || value === null || value === \"\") {",
    "      continue;",
    "    }",
    "",
    "    query.set(key, String(value));",
    "  }",
    "",
    "  const queryString = query.toString();",
    "",
    "  return queryString.length > 0 ? `?${queryString}` : \"\";",
    "}"
  ]
    .filter(Boolean)
    .join("\n");
}

function renderWebDomainSchemas(context: ReturnType<typeof createTemplateContext>) {
  const fieldLines = context.resource.fields
    .map((field) => `  ${field.name}: ${renderZodField(field)}`)
    .join(",\n");

  return [
    'import { z } from "zod";',
    "",
    `export const ${context.resource.resource}RecordSchema = z.object({`,
    '  id: z.string().uuid(),',
    '  organizationId: z.string().uuid(),',
    `${fieldLines},`,
    isArchiveEnabled(context)
      ? `  ${getArchiveFieldName(context)}: z.string().datetime().optional(),`
      : "",
    '  createdAt: z.string().datetime(),',
    '  updatedAt: z.string().datetime()',
    "});",
    "",
    `export type ${context.pascalName}Record = z.infer<typeof ${context.resource.resource}RecordSchema>;`
  ].join("\n");
}

function renderWebScreen(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import type { ${context.pascalName}Record } from "../domain/schemas.js";`,
    "",
    `import { ${context.pascalName}EmptyState } from "./${context.resourcePath}-empty-state.js";`,
    `import { ${context.pascalName}Table } from "./${context.resourcePath}-table.js";`,
    "",
    `type ${context.pascalName}RelationPresentation = {`,
    "  href?: string;",
    "  label: string;",
    "};",
    "",
    `type ${context.pascalName}RelationPresentations = Record<`,
    "  string,",
    `  Partial<Record<string, ${context.pascalName}RelationPresentation>>`,
    ">;",
    "",
    `export function ${context.pascalName}Screen(input: {`,
    `  items: readonly ${context.pascalName}Record[];`,
    "  organizationId?: string;",
    "  projectId?: string;",
    `  relationPresentations?: ${context.pascalName}RelationPresentations;`,
    "  resourceQuery?: string;",
    "  resourceBasePath?: string;",
    "}) {",
    "  if (input.items.length === 0) {",
    `    return <${context.pascalName}EmptyState />;`,
    "  }",
    "",
    `  return (`,
    `    <${context.pascalName}Table`,
    "      items={input.items}",
    "      organizationId={input.organizationId}",
    "      projectId={input.projectId}",
    "      relationPresentations={input.relationPresentations}",
    "      resourceQuery={input.resourceQuery}",
    "      resourceBasePath={input.resourceBasePath}",
    "    />",
    "  );",
    "}"
  ].join("\n");
}

function renderWebForm(context: ReturnType<typeof createTemplateContext>) {
  const formFields = context.createFields.map((field) => {
    const label = field.label ?? toLabel(field.name);
    const valueAccessor = `input.defaultValues?.${field.name}`;

    if (field.type === "text") {
      return [
        `      <label key={${JSON.stringify(field.name)}} className="grid gap-2">`,
        `        <span>${label}</span>`,
        `        <textarea`,
        `          className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2"`,
        `          defaultValue={${valueAccessor} ?? ""}`,
        `          name="${field.name}"`,
        `          ${field.required ? "required" : ""}`,
        "        />",
        "      </label>"
      ].join("\n");
    }

    if (field.type === "enum" && field.values) {
      return [
        `      <label key={${JSON.stringify(field.name)}} className="grid gap-2">`,
        `        <span>${label}</span>`,
        `        <select`,
        `          className="rounded-md border border-[var(--border)] px-3 py-2"`,
        `          defaultValue={${valueAccessor} ?? ${JSON.stringify(field.default ?? field.values[0])}}`,
        `          name="${field.name}"`,
        `          ${field.required ? "required" : ""}`,
        "        >",
        ...field.values.map((value) => `          <option value="${value}">${toLabel(value)}</option>`),
        "        </select>",
        "      </label>"
      ].join("\n");
    }

    if (field.type === "boolean") {
      return [
        `      <label key={${JSON.stringify(field.name)}} className="flex items-center gap-2">`,
        `        <input`,
        `          className="h-4 w-4"`,
        `          defaultChecked={${valueAccessor} ?? ${field.default === true ? "true" : "false"}}`,
        `          name="${field.name}"`,
        `          type="checkbox"`,
        "        />",
        `        <span>${label}</span>`,
        "      </label>"
      ].join("\n");
    }

    const defaultValue =
      field.type === "datetime"
        ? `toDateTimeLocalValue(${valueAccessor})`
        : `${valueAccessor} ?? ""`;

    return [
      `      <label key={${JSON.stringify(field.name)}} className="grid gap-2">`,
      `        <span>${label}</span>`,
      `        <input`,
      `          className="rounded-md border border-[var(--border)] px-3 py-2"`,
      `          defaultValue={${defaultValue}}`,
      `          name="${field.name}"`,
      `          ${field.required ? "required" : ""}`,
      `          type="${renderHtmlInputType(field.type)}"`,
      "        />",
      "      </label>"
    ].join("\n");
  });

  return [
    `import type { ReactNode } from "react";`,
    "",
    `import type { ${context.pascalName}Record } from "../domain/schemas.js";`,
    "",
    `export function ${context.pascalName}Form(input: {`,
    "  action?: (formData: FormData) => void | Promise<void>;",
    "  children?: ReactNode;",
    `  defaultValues?: Partial<${context.pascalName}Record>;`,
    "  submitLabel?: string;",
    "}) {",
    '  return (',
    '    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">',
    "      {input.children}",
    ...formFields,
    '      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save ' +
      context.label +
      '"}</button>',
    "    </form>",
    "  );",
    "}",
    "",
    "function toDateTimeLocalValue(value?: string) {",
    "  if (!value) {",
    "    return \"\";",
    "  }",
    "",
    "  const date = new Date(value);",
    "",
    "  if (Number.isNaN(date.getTime())) {",
    "    return \"\";",
    "  }",
    "",
    "  return date.toISOString().slice(0, 16);",
    "}"
  ].join("\n");
}

function renderWebTable(context: ReturnType<typeof createTemplateContext>) {
  const headers = context.resource.fields
    .map((field) => `          <th>${field.label ?? toLabel(field.name)}</th>`)
    .join("\n");
  const cells = context.resource.fields
    .map((field) =>
      context.relationByField.get(field.name)
        ? `            <td>{renderRelationAwareValue(item.id, ${JSON.stringify(field.name)}, item.${field.name}, input.relationPresentations)}</td>`
        : `            <td>{item.${field.name}?.toString()}</td>`
    )
    .join("\n");

  return [
    `import type { ${context.pascalName}Record } from "../domain/schemas.js";`,
    "",
    `type ${context.pascalName}RelationPresentation = {`,
    "  href?: string;",
    "  label: string;",
    "};",
    "",
    `type ${context.pascalName}RelationPresentations = Record<`,
    "  string,",
    `  Partial<Record<string, ${context.pascalName}RelationPresentation>>`,
    ">;",
    "",
    `export function ${context.pascalName}Table(input: {`,
    `  items: readonly ${context.pascalName}Record[];`,
    "  organizationId?: string;",
    "  projectId?: string;",
    `  relationPresentations?: ${context.pascalName}RelationPresentations;`,
    "  resourceQuery?: string;",
    "  resourceBasePath?: string;",
    "}) {",
    "  const showActions = Boolean(input.organizationId && input.resourceBasePath);",
    "",
    "  return (",
    "    <table>",
    "      <thead>",
    "        <tr>",
    headers,
    "          {showActions ? <th>Actions</th> : null}",
    "        </tr>",
    "      </thead>",
    "      <tbody>",
    "        {input.items.map((item) => (",
    "          <tr key={item.id}>",
    cells,
    "            {showActions ? (",
    "              <td>",
    "                <div className=\"flex gap-3\">",
    "                  <a href={buildResourceHref(input, item.id)}>View</a>",
    "                  <a href={buildEditHref(input, item.id)}>Edit</a>",
    "                </div>",
    "              </td>",
    "            ) : null}",
    "          </tr>",
    "        ))}",
    "      </tbody>",
    "    </table>",
    "  );",
    "}",
    "",
    "function renderRelationAwareValue(",
    "  recordId: string,",
    "  fieldName: string,",
    "  value: unknown,",
    `  relationPresentations?: ${context.pascalName}RelationPresentations`,
    ") {",
    "  const relation = relationPresentations?.[recordId]?.[fieldName];",
    "",
    "  if (relation?.href) {",
    "    return <a href={relation.href}>{relation.label}</a>;",
    "  }",
    "",
    "  if (relation) {",
    "    return relation.label;",
    "  }",
    "",
    "  return value?.toString() ?? \"\";",
    "}",
    "",
    `function buildResourceHref(`,
    `  input: Pick<${context.pascalName}TableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,`,
    "  id: string",
    ") {",
    "  if (input.resourceQuery) {",
    "    return `${input.resourceBasePath}/${id}?${input.resourceQuery}`;",
    "  }",
    "",
    "  const query = new URLSearchParams({",
    '    organizationId: input.organizationId ?? ""',
    "  });",
    "",
    "  if (input.projectId) {",
    '    query.set("projectId", input.projectId);',
    "  }",
    "",
    "  return `${input.resourceBasePath}/${id}?${query.toString()}`;",
    "}",
    "",
    `function buildEditHref(`,
    `  input: Pick<${context.pascalName}TableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,`,
    "  id: string",
    ") {",
    "  if (input.resourceQuery) {",
    "    return `${input.resourceBasePath}/${id}/edit?${input.resourceQuery}`;",
    "  }",
    "",
    "  const query = new URLSearchParams({",
    '    organizationId: input.organizationId ?? ""',
    "  });",
    "",
    "  if (input.projectId) {",
    '    query.set("projectId", input.projectId);',
    "  }",
    "",
    "  return `${input.resourceBasePath}/${id}/edit?${query.toString()}`;",
    "}",
    "",
    `interface ${context.pascalName}TableParameters {`,
    `  items: readonly ${context.pascalName}Record[];`,
    "  organizationId?: string;",
    "  projectId?: string;",
    `  relationPresentations?: ${context.pascalName}RelationPresentations;`,
    "  resourceQuery?: string;",
    "  resourceBasePath?: string;",
    "}"
  ].join("\n");
}

function renderWebEmptyState(context: ReturnType<typeof createTemplateContext>) {
  return [
    `export function ${context.pascalName}EmptyState() {`,
    "  return (",
    '    <section className="rounded-lg border border-dashed p-6">',
    `      <h2>No ${context.pluralLabel.toLowerCase()} yet</h2>`,
    `      <p>Create the first ${context.label.toLowerCase()} to validate the generated CRUD seam.</p>`,
    "    </section>",
    "  );",
    "}"
  ].join("\n");
}

function renderWebScreenTest(context: ReturnType<typeof createTemplateContext>) {
  return [
    'import { render, screen } from "@testing-library/react";',
    'import { describe, expect, it } from "vitest";',
    "",
    `import { ${context.pascalName}Screen } from "../components/${context.resourcePath}-screen.js";`,
    "",
    `describe("${context.pascalName}Screen", () => {`,
    `  it("renders the empty state when no ${context.pluralLabel.toLowerCase()} exist", () => {`,
    `    render(<${context.pascalName}Screen items={[]} />);`,
    "",
    `    expect(screen.getByText("No ${context.pluralLabel.toLowerCase()} yet")).toBeTruthy();`,
    "  });",
    "});"
  ].join("\n");
}

function renderWebClientTest(context: ReturnType<typeof createTemplateContext>) {
  return [
    'import { describe, expect, it } from "vitest";',
    "",
    'import type { ApiClient, ApiRequestOptions } from "@/src/lib/api/api-client";',
    `import { createResourceClient } from "../api/${context.resourcePath}-client.js";`,
    "",
    'describe("createResourceClient", () => {',
    `  it("loads ${context.pluralLabel.toLowerCase()} through the API client", async () => {`,
    "    const requests: unknown[] = [];",
    `    const client = createResourceClient(createRecordingApiClient(requests, { items: [], pageInfo: { hasMore: false, nextCursor: null } }));`,
    "",
    '    await client.list("00000000-0000-0000-0000-000000000001");',
    "",
    "    expect(requests).toHaveLength(1);",
    "  });",
    "});",
    "",
    "function createRecordingApiClient(",
    "  requests: unknown[],",
    "  response: unknown",
    "): ApiClient {",
    "  return {",
    "    async raw(options: ApiRequestOptions) {",
    "      requests.push(options);",
    "      return new Response(JSON.stringify(response), {",
    '        headers: { "content-type": "application/json" },',
    "        status: 200",
    "      });",
    "    },",
    "    async request<TResponse>(options: ApiRequestOptions) {",
    "      requests.push(options);",
    "      return response as TResponse;",
    "    }",
    "  };",
    "}"
  ].join("\n");
}

function renderWebListPage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}Screen } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-screen";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}Screen items={[]} />;`,
    "}"
  ].join("\n");
}

function renderWebCreatePage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}Form } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-form";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}Form />;`,
    "}"
  ].join("\n");
}

function renderWebDetailPage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}EmptyState } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-empty-state";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}EmptyState />;`,
    "}"
  ].join("\n");
}

function renderWebEditPage(context: ReturnType<typeof createTemplateContext>) {
  return [
    `import { ${context.pascalName}Form } from "@/src/features/${context.resourcePath}/components/${context.resourcePath}-form";`,
    "",
    "export default function Page() {",
    `  return <${context.pascalName}Form />;`,
    "}"
  ].join("\n");
}

function renderResourceDocs(context: ReturnType<typeof createTemplateContext>) {
  const fields = context.resource.fields
    .map(
      (field) =>
        `- \`${field.name}\`: \`${field.type}\`${field.required ? " required" : ""}`
    )
    .join("\n");
  const plannedWrites = context.plan.generatedFiles
    .filter(
      (file) => file.templateId && supportedTemplateIds.has(file.templateId)
    )
    .map((file) => `- \`${file.path}\``)
    .join("\n");

  return [
    `# ${context.label} Resource Preview`,
    "",
    `This preview was generated from a validated \`${context.resource.resource}\` resource spec.`,
    "",
    "## Supported assumptions",
    "",
    "- ownership: `organization`",
    `- CRUD: \`${["list", "create", "read", "update", ...(context.resource.crud.delete ? ["delete"] : [])].join("`, `")}\``,
    `- delete generation: ${context.resource.crud.delete ? "hard delete is generated when `crud.delete` is enabled" : "disabled for this resource spec"}`,
    "- output mode: preview-only under `.generated/` or `tmp/`",
    "",
    "## Fields",
    "",
    fields,
    "",
    "## Generated file groups",
    "",
    plannedWrites,
    "",
    "## Manual follow-up",
    "",
    "- add domain and DB barrel exports if this preview is promoted into real repo source",
    "- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly",
    "- write a real migration after picking the next migration identifier"
  ].join("\n");
}

function renderCustomizationDocs(context: ReturnType<typeof createTemplateContext>) {
  return [
    `# ${context.label} CUSTOMIZE`,
    "",
    "This preview is intentionally safe and incomplete. Treat it as generated scaffolding, not as a drop-in runtime slice.",
    "",
    "## Safe customization points",
    "",
    `- business rules: \`apps/api/src/modules/generated/${context.resourcePath}/service.ts\``,
    `- persistence queries: \`apps/api/src/modules/generated/${context.resourcePath}/postgres-repo.ts\``,
    `- request validation and route shaping: \`apps/api/src/modules/generated/${context.resourcePath}/routes.ts\``,
    `- UI copy and layout: \`apps/web/src/features/${context.resourcePath}/components/*\``,
    "",
    "## Ownership assumptions",
    "",
    "- every CRUD call is organization-scoped",
    "- generated preview files assume organization IDs are required at every API boundary",
    "- product navigation is intentionally not wired automatically in this first generator",
    "",
    "## Regeneration guidance",
    "",
    "- avoid hand-editing generated schema boilerplate if you plan to regenerate from the same spec",
    "- prefer layering business logic into service and adapter files after review",
    "- do not copy the preview directly into runtime without adding barrel exports, route registration, and a real migration",
    "",
    "## Checks to run after promotion",
    "",
    ...context.plan.checks.map((check) => `- \`${check.command}\``)
  ].join("\n");
}

function flattenPlanEntries(plan: ResourcePlanReport) {
  return Object.values(plan.groups)
    .flat()
    .sort((left, right) => left.path.localeCompare(right.path));
}

function countFilesByGroup(files: readonly ResourceGeneratorFile[]) {
  return {
    api: files.filter((file) => file.group === "api").length,
    db: files.filter((file) => file.group === "db").length,
    docs: files.filter((file) => file.group === "docs").length,
    domain: files.filter((file) => file.group === "domain").length,
    web: files.filter((file) => file.group === "web").length
  } as const;
}

function isArchiveEnabled(context: ReturnType<typeof createTemplateContext>) {
  return context.resource.archive.enabled;
}

function getArchiveFieldName(context: ReturnType<typeof createTemplateContext>) {
  return context.resource.archive.field ?? "archivedAt";
}

function getListFilterFields(context: ReturnType<typeof createTemplateContext>) {
  return context.resource.api.filters
    .map((fieldName) =>
      context.resource.fields.find((field) => field.name === fieldName)
    )
    .filter(
      (
        field
      ): field is ReturnType<typeof createTemplateContext>["resource"]["fields"][number] =>
        field !== undefined
    );
}

function getListSortableFields(context: ReturnType<typeof createTemplateContext>) {
  const baseFields = [
    {
      name: "createdAt",
      type: "datetime"
    },
    {
      name: "updatedAt",
      type: "datetime"
    }
  ];
  const resourceFields = context.resource.fields.filter(
    (field) =>
      field.required &&
      field.sortable &&
      ["datetime", "email", "enum", "string", "uuid"].includes(field.type)
  );

  return [...baseFields, ...resourceFields];
}

function renderGeneratedListInputSchemaLines(
  context: ReturnType<typeof createTemplateContext>
) {
  const lines: string[] = [];

  if (isArchiveEnabled(context)) {
    lines.push('  archived: z.enum(["exclude", "include", "only"]).optional(),');
  }

  lines.push('  cursor: z.string().min(1).optional(),');
  lines.push("  limit: z.number().int().positive().max(100).optional(),");
  lines.push("  query: z.string().trim().min(1).optional(),");

  const sortableValues = getListSortableFields(context).map((field) =>
    JSON.stringify(field.name)
  );

  lines.push(
    `  sortBy: z.enum([${sortableValues.join(", ")}]).default("createdAt"),`
  );
  lines.push('  sortDirection: z.enum(["asc", "desc"]).default("desc"),');

  for (const field of getListFilterFields(context)) {
    lines.push(`  ${field.name}: ${renderZodOptionalField(field)},`);
  }

  const lastLine = lines.at(-1);

  if (lastLine) {
    lines[lines.length - 1] = lastLine.replace(/,$/, "");
  }

  return lines;
}

function renderRouteListQuerySchemaLines(
  context: ReturnType<typeof createTemplateContext>
) {
  const lines: string[] = [];

  if (isArchiveEnabled(context)) {
    lines.push('  archived: z.enum(["exclude", "include", "only"]).optional(),');
  }

  lines.push('  cursor: z.string().min(1).optional(),');
  lines.push("  limit: z.coerce.number().int().positive().max(100).optional(),");
  lines.push("  query: z.string().trim().min(1).optional(),");

  const sortableValues = getListSortableFields(context).map((field) =>
    JSON.stringify(field.name)
  );

  lines.push(
    `  sortBy: z.enum([${sortableValues.join(", ")}]).default("createdAt"),`
  );
  lines.push('  sortDirection: z.enum(["asc", "desc"]).default("desc"),');

  for (const field of getListFilterFields(context)) {
    lines.push(`  ${field.name}: ${renderRouteQuerySchemaField(field)},`);
  }

  const lastLine = lines.at(-1);

  if (lastLine) {
    lines[lines.length - 1] = lastLine.replace(/,$/, "");
  }

  return lines;
}

function renderRouteQuerySchemaField(
  field: ReturnType<typeof createTemplateContext>["resource"]["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return 'z.enum(["true", "false"]).transform((value) => value === "true").optional()';
    case "datetime":
      return "z.string().datetime().optional()";
    default:
      return renderZodOptionalField(field);
  }
}

function getWorkflowFieldValues(context: ReturnType<typeof createTemplateContext>) {
  const workflowField = context.resource.fields.find(
    (field) => field.name === context.resource.workflow?.field
  );

  return workflowField?.values ?? [];
}

function formatGeneratedResourcePolicyRule(
  rule: FrameworkResourceSpec["policy"]["archive"]
) {
  if (rule.ownerField) {
    return `{ mode: ${JSON.stringify(rule.mode)}, ownerField: ${JSON.stringify(rule.ownerField)} }`;
  }

  return `{ mode: ${JSON.stringify(rule.mode)} }`;
}

function getPluralPath(resource: FrameworkResourceSpec) {
  const segments = resource.api.prefix.split("/").filter(Boolean);

  return segments.at(-1) ?? pluralizeSegment(toKebabCase(resource.resource));
}

function getDbTableName(resource: FrameworkResourceSpec) {
  return pluralizeSegment(toKebabCase(resource.resource));
}

function pluralizeSegment(value: string) {
  if (/[sxz]$/i.test(value) || /(ch|sh)$/i.test(value)) {
    return `${value}es`;
  }

  if (/[^aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`;
  }

  return `${value}s`;
}

function getDrizzleImport(type: FrameworkResourceSpec["fields"][number]["type"]) {
  switch (type) {
    case "boolean":
      return "boolean";
    case "datetime":
      return "timestamp";
    case "uuid":
      return "uuid";
    default:
      return "text";
  }
}

function renderDbColumn(
  context: ReturnType<typeof createTemplateContext>,
  field: FrameworkResourceSpec["fields"][number]
) {
  const notNullSuffix = field.required ? ".notNull()" : "";
  const uniqueSuffix = field.unique ? ".unique()" : "";
  const relation = context.relationByField.get(field.name);

  switch (field.type) {
    case "boolean":
      return `boolean("${toSnakeCase(field.name)}")${notNullSuffix}${uniqueSuffix},`;
    case "datetime":
      return `timestamp("${toSnakeCase(field.name)}", { withTimezone: true })${notNullSuffix}${uniqueSuffix},`;
    case "uuid":
      if (relation) {
        const targetReference = resolveRelationTargetReference(relation);

        return `uuid("${toSnakeCase(field.name)}")${notNullSuffix}.references(() => ${targetReference.symbol}.id)${uniqueSuffix},`;
      }

      return `uuid("${toSnakeCase(field.name)}")${notNullSuffix}${uniqueSuffix},`;
    default:
      return `text("${toSnakeCase(field.name)}")${notNullSuffix}${uniqueSuffix},`;
  }
}

function renderDbValueAssignment(input: {
  accessPath: string;
  field: FrameworkResourceSpec["fields"][number];
  mode: "create" | "update";
}) {
  const expression = renderDbWriteValue(input.accessPath, input.field);

  if (input.mode === "update") {
    return `        ${input.field.name}: ${input.accessPath} !== undefined ? ${expression} : undefined,`;
  }

  return `        ${input.field.name}: ${expression},`;
}

function renderDbWriteValue(
  accessPath: string,
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "datetime":
      return `${accessPath} ? new Date(${accessPath}) : undefined`;
    default:
      return accessPath;
  }
}

function renderRecordValue(
  context: ReturnType<typeof createTemplateContext>,
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "datetime":
      return `record.${field.name}?.toISOString()`;
    case "enum":
      return `record.${field.name} as ${context.pascalName}Record["${field.name}"]`;
    default:
      return field.required
        ? `record.${field.name}`
        : `record.${field.name} ?? undefined`;
  }
}

function renderZodField(field: FrameworkResourceSpec["fields"][number]) {
  let expression: string;

  switch (field.type) {
    case "boolean":
      expression = "z.boolean()";
      break;
    case "datetime":
      expression = "z.string().datetime()";
      break;
    case "email":
      expression = "z.string().email()";
      break;
    case "enum":
      expression = `z.enum([${(field.values ?? [])
        .map((value) => JSON.stringify(value))
        .join(", ")}])`;
      break;
    case "text":
      expression = "z.string().trim().min(1)";
      break;
    case "uuid":
      expression = "z.string().uuid()";
      break;
    default:
      expression = "z.string().trim().min(1)";
      break;
  }

  if (!field.required) {
    expression += ".optional()";
  }

  return expression;
}

function renderZodOptionalField(field: FrameworkResourceSpec["fields"][number]) {
  const requiredVersion = renderZodField({
    ...field,
    required: true
  });

  return `${requiredVersion}.optional()`;
}

function renderHtmlInputType(
  type: FrameworkResourceSpec["fields"][number]["type"]
) {
  switch (type) {
    case "boolean":
      return "checkbox";
    case "datetime":
      return "datetime-local";
    case "email":
      return "email";
    default:
      return "text";
  }
}

function renderTypeScriptFieldType(
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return "boolean";
    case "datetime":
    case "email":
    case "string":
    case "text":
    case "uuid":
      return "string";
    case "enum":
      return (field.values ?? [])
        .map((value) => JSON.stringify(value))
        .join(" | ");
    default:
      return "string";
  }
}

function renderObjectLiteralFields(
  fields: readonly FrameworkResourceSpec["fields"][number][]
) {
  return fields
    .map((field) => `          ${field.name}: ${JSON.stringify(getExampleValue(field))},`)
    .join("\n");
}

function renderCreateInputObject(
  fields: readonly FrameworkResourceSpec["fields"][number][]
) {
  return fields
    .map((field) => `        ${field.name}: ${JSON.stringify(getExampleValue(field))},`)
    .join("\n");
}

function renderExpectedFieldObject(
  fields: readonly FrameworkResourceSpec["fields"][number][]
) {
  return fields
    .map((field) => `      ${field.name}: ${JSON.stringify(getExampleValue(field))},`)
    .join("\n");
}

function getExampleValue(field: FrameworkResourceSpec["fields"][number]) {
  if (field.default !== undefined) {
    return field.default;
  }

  switch (field.type) {
    case "boolean":
      return true;
    case "datetime":
      return "2026-06-29T00:00:00.000Z";
    case "email":
      return "person@example.com";
    case "enum":
      return field.values?.[0] ?? "value";
    case "uuid":
      return "11111111-1111-4111-8111-111111111111";
    default:
      return `${field.name} value`;
  }
}

function getAlternateExampleValue(
  field: FrameworkResourceSpec["fields"][number]
) {
  switch (field.type) {
    case "boolean":
      return !Boolean(getExampleValue(field));
    case "datetime":
      return "2026-07-01T12:00:00.000Z";
    case "email":
      return "updated@example.com";
    case "enum":
      return field.values?.[1] ?? field.values?.[0] ?? "value";
    case "uuid":
      return "22222222-2222-4222-8222-222222222222";
    default:
      return `updated ${field.name} value`;
  }
}

function joinOutputPath(root: string, path: string) {
  return `${root.replace(/\/$/, "")}/${path}`.replace(/\\/g, "/");
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
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
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join("");
}

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();
}

function toLabel(value: string) {
  return toKebabCase(value)
    .split("-")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function addSchemaImport(
  imports: Map<string, Set<string>>,
  path: string,
  name: string
) {
  const existing = imports.get(path);

  if (existing) {
    existing.add(name);
    return;
  }

  imports.set(path, new Set([name]));
}

function resolveRelationTargetReference(
  relation: FrameworkResourceSpec["relations"][number]
) {
  if (relation.targetScope === "platform") {
    const platformTargetMap: Record<
      string,
      { importPath: string; symbol: string }
    > = {
      organization: {
        importPath: "./identity.js",
        symbol: "organizations"
      },
      project: {
        importPath: "./identity.js",
        symbol: "projects"
      },
      user: {
        importPath: "./identity.js",
        symbol: "users"
      }
    };
    const mapped = platformTargetMap[relation.target];

    if (!mapped) {
      throw new Error(
        `Unsupported platform relation target '${relation.target}'. Supported targets: organization, project, user.`
      );
    }

    return mapped;
  }

  const targetPath = toKebabCase(relation.target);

  return {
    importPath: `./${targetPath}.js`,
    symbol: `${relation.target}Table`
  };
}
