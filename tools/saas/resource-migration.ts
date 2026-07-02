import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FrameworkResourceSpec } from "../../packages/framework/src/index.js";

export interface ResourceMigrationWrite {
  action: "create" | "skip" | "update";
  contents?: string;
  kind: "central-file" | "generated-file";
  path: string;
}

interface MigrationJournalEntry {
  breakpoints: boolean;
  idx: number;
  tag: string;
  version: string;
  when: number;
}

interface MigrationJournal {
  dialect: "postgresql";
  entries: MigrationJournalEntry[];
  version: string;
}

const journalPath = "packages/db/src/migrations/meta/_journal.json";

export function createResourceMigrationWrites(input: {
  now?: () => number;
  repoRoot: string;
  resource: FrameworkResourceSpec;
  targetPath: string;
}): readonly ResourceMigrationWrite[] {
  const migrationState = resolveMigrationState(input);
  const migrationContents = renderMigrationSql(input.resource);
  const journalContents = renderMigrationJournal({
    journal: migrationState.journal,
    now: input.now ?? (() => Date.now()),
    tag: migrationState.tag
  });

  return [
    createWrite({
      contents: migrationContents,
      kind: "generated-file",
      path: migrationState.migrationPath,
      repoRoot: input.repoRoot,
      targetPath: input.targetPath
    }),
    createWrite({
      contents: journalContents,
      kind: "central-file",
      path: journalPath,
      repoRoot: input.repoRoot,
      targetPath: input.targetPath
    })
  ];
}

function resolveMigrationState(input: {
  repoRoot: string;
  resource: FrameworkResourceSpec;
  targetPath: string;
}) {
  const resourcePath = toKebabCase(input.resource.resource);
  const migrationsDirectoryPath = "packages/db/src/migrations";
  const migrationsDirectoryAbsolutePath = resolve(
    input.repoRoot,
    input.targetPath,
    migrationsDirectoryPath
  );
  const existingMigrationFiles = existsSync(migrationsDirectoryAbsolutePath)
    ? readdirSync(migrationsDirectoryAbsolutePath).filter((entry) =>
        /^\d{4}_.+\.sql$/.test(entry)
      )
    : [];
  const resourceMigrationMatches = existingMigrationFiles.filter((entry) =>
    new RegExp(`^\\d{4}_${resourcePath}\\.sql$`).test(entry)
  );

  if (resourceMigrationMatches.length > 1) {
    throw new Error(
      `Unsupported existing generated resource state in '${migrationsDirectoryPath}'. Multiple migrations already exist for '${resourcePath}'.`
    );
  }

  const migrationId =
    resourceMigrationMatches[0]?.slice(0, 4) ??
    formatMigrationId(
      Math.max(
        -1,
        ...existingMigrationFiles.map((entry) => Number(entry.slice(0, 4)))
      ) + 1
    );
  const tag = `${migrationId}_${resourcePath}`;

  return {
    journal: readMigrationJournal({
      repoRoot: input.repoRoot,
      targetPath: input.targetPath
    }),
    migrationPath: `${migrationsDirectoryPath}/${tag}.sql`,
    tag
  };
}

function readMigrationJournal(input: {
  repoRoot: string;
  targetPath: string;
}): MigrationJournal {
  const absolutePath = resolve(input.repoRoot, input.targetPath, journalPath);

  if (!existsSync(absolutePath)) {
    return {
      dialect: "postgresql",
      entries: [],
      version: "7"
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as MigrationJournal;

    if (
      parsed.version !== "7" ||
      parsed.dialect !== "postgresql" ||
      !Array.isArray(parsed.entries)
    ) {
      throw new Error("Unexpected journal structure.");
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Unsupported central file patch for '${journalPath}'. Existing journal JSON is invalid: ${
        error instanceof Error ? error.message : "unknown parse error"
      }.`
    );
  }
}

function renderMigrationJournal(input: {
  journal: MigrationJournal;
  now: () => number;
  tag: string;
}) {
  const existingEntries = input.journal.entries.filter(
    (entry) => entry.tag === input.tag
  );

  if (existingEntries.length > 1) {
    throw new Error(
      `Unsupported existing generated resource state in '${journalPath}'. Multiple journal entries already exist for '${input.tag}'.`
    );
  }

  const nextEntries =
    existingEntries.length === 1
      ? input.journal.entries
      : [
          ...input.journal.entries,
          {
            breakpoints: true,
            idx:
              Math.max(-1, ...input.journal.entries.map((entry) => entry.idx)) + 1,
            tag: input.tag,
            version: input.journal.version,
            when: input.now()
          }
        ];

  return `${JSON.stringify(
    {
      ...input.journal,
      entries: nextEntries.sort((left, right) => left.idx - right.idx)
    },
    null,
    2
  )}\n`;
}

function renderMigrationSql(resource: FrameworkResourceSpec) {
  const tableName = getTableName(resource);
  const relationByField = new Map(
    resource.relations.map((relation) => [relation.field, relation] as const)
  );
  const columnLines = [
    '  "id" uuid primary key default gen_random_uuid() not null',
    '  "organization_id" uuid not null references "organizations"("id")',
    ...resource.fields.map((field) => renderSqlColumn(field, relationByField.get(field.name))),
    ...(resource.archive?.enabled
      ? [`  "${toSnakeCase(resource.archive.field)}" timestamp with time zone`]
      : []),
    '  "created_at" timestamp with time zone default now() not null',
    '  "updated_at" timestamp with time zone default now() not null'
  ];
  const uniqueConstraintLines = resource.fields
    .filter((field) => field.unique)
    .map(
      (field) =>
        `  CONSTRAINT "${tableName}_${toSnakeCase(field.name)}_unique" UNIQUE("${toSnakeCase(field.name)}")`
    );

  return [
    `create table if not exists "${tableName}" (`,
    [...columnLines, ...uniqueConstraintLines].join(",\n"),
    ");",
    "--> statement-breakpoint",
    `create index if not exists "${tableName}_organization_id_idx"`,
    `  on "${tableName}" ("organization_id");`,
    ...resource.relations.flatMap((relation) => [
      "--> statement-breakpoint",
      `create index if not exists "${tableName}_${toSnakeCase(relation.field)}_idx"`,
      `  on "${tableName}" ("${toSnakeCase(relation.field)}");`
    ])
  ].join("\n");
}

function renderSqlColumn(
  field: FrameworkResourceSpec["fields"][number],
  relation?: FrameworkResourceSpec["relations"][number]
) {
  const columnName = toSnakeCase(field.name);
  const notNullClause = field.required ? " not null" : "";

  switch (field.type) {
    case "boolean":
      return `  "${columnName}" boolean${notNullClause}`;
    case "datetime":
      return `  "${columnName}" timestamp with time zone${notNullClause}`;
    case "uuid":
      if (relation) {
        const targetTable = resolveSqlRelationTargetTable(relation);

        return `  "${columnName}" uuid references "${targetTable}"("id")${notNullClause}`;
      }

      return `  "${columnName}" uuid${notNullClause}`;
    default:
      return `  "${columnName}" text${notNullClause}`;
  }
}

function resolveSqlRelationTargetTable(
  relation: FrameworkResourceSpec["relations"][number]
) {
  if (relation.targetScope === "platform") {
    const platformTargetTables: Record<string, string> = {
      organization: "organizations",
      project: "projects",
      user: "users"
    };
    const tableName = platformTargetTables[relation.target];

    if (!tableName) {
      throw new Error(
        `Unsupported platform relation target '${relation.target}'. Supported targets: organization, project, user.`
      );
    }

    return tableName;
  }

  return pluralizeSegment(toKebabCase(relation.target));
}

function createWrite(input: {
  contents: string;
  kind: "central-file" | "generated-file";
  path: string;
  repoRoot: string;
  targetPath: string;
}): ResourceMigrationWrite {
  const absolutePath = resolve(input.repoRoot, input.targetPath, input.path);

  if (!existsSync(absolutePath)) {
    return {
      action: "create",
      contents: input.contents,
      kind: input.kind,
      path: input.path
    };
  }

  const currentContents = readFileSync(absolutePath, "utf8");

  if (currentContents === input.contents) {
    return {
      action: "skip",
      kind: input.kind,
      path: input.path
    };
  }

  return {
    action: "update",
    contents: input.contents,
    kind: input.kind,
    path: input.path
  };
}

function formatMigrationId(value: number) {
  return value.toString().padStart(4, "0");
}

function getTableName(resource: FrameworkResourceSpec) {
  return pluralizeSegment(toKebabCase(resource.resource));
}

function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

function toSnakeCase(value: string) {
  return toKebabCase(value).replace(/-/g, "_");
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
