import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyResourceFromFile } from "../resource-apply.js";
import { executeSaasCli } from "../cli.js";
import { generateResourceFromFile } from "../resource-generator.js";
import { createResourcePlanFromFile } from "../resource-planner.js";

describe("saas resource generator", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("generates deterministic preview files for a valid organization-owned resource", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    const first = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });
    const second = generateResourceFromFile({
      force: true,
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(first.writtenFiles.map((file) => file.outputPath)).toEqual(
      second.writtenFiles.map((file) => file.outputPath)
    );
    expect(readGenerated(repoRoot, ".generated/customer-preview/docs/resources/customer.md")).toContain(
      "# Customer Resource Preview"
    );
    expect(
      readGenerated(
        repoRoot,
        ".generated/customer-preview/docs/resources/customer-customization.md"
      )
    ).toContain("# Customer CUSTOMIZE");
  });

  it("reuses the dry-run planner and writes only planned template files", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const plan = createResourcePlanFromFile({
      repoRoot,
      specPath: "specs/customer.json"
    });
    const result = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });
    const plannedPaths = new Set(plan.generatedFiles.map((file) => file.path));

    for (const writtenFile of result.writtenFiles) {
      expect(plannedPaths.has(writtenFile.repoPath)).toBe(true);
    }
  });

  it("fails for unsupported ownership modes", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/profile.json": resourceSpecJson({
        fields: [{ name: "name", required: true, type: "string" }],
        label: "Profile",
        ownership: "user",
        resource: "profile"
      })
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/profile-preview",
        repoRoot,
        specPath: "specs/profile.json"
      })
    ).toThrow(/organization-owned resources only/i);
  });

  it("fails for unsupported field types", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": resourceSpecJson({
        fields: [{ name: "metadata", required: false, type: "json" }],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).toThrow(/unsupported type 'json'/i);
  });

  it("fails when a generated target file already exists without force", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).toThrow(/without --force/i);
  });

  it("does not generate AuditTrail-specific imports or product copy", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    for (const file of result.writtenFiles) {
      expect(file.contents).not.toContain("@auditrail/domain/audit-events");
      expect(file.contents).not.toContain("audit-product");
      expect(file.contents).not.toContain("AuditTrail");
    }
  });

  it("keeps written file ordering deterministic", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });
    const result = generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });
    const orderedPaths = [...result.writtenFiles.map((file) => file.outputPath)].sort();

    expect(result.writtenFiles.map((file) => file.outputPath)).toEqual(orderedPaths);
  });

  it("keeps preview generation isolated from real app source", () => {
    const repoRoot = createRepo(createdRoots, {
      "apps/api/src/app.ts": "export const untouched = true;\n",
      "specs/customer.json": readFixture("customer.json")
    });

    generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toBe(
      "export const untouched = true;\n"
    );
    expect(
      readGenerated(
        repoRoot,
        ".generated/customer-preview/apps/api/src/modules/generated/customer/routes.ts"
      )
    ).toContain("registerCustomerRoutes");
  });

  it("fails before writing when the planner reports blocking warnings", () => {
    const repoRoot = createRepo(createdRoots, {
      "apps/api/src/modules/customer/existing.ts": "export const existing = true;\n",
      "specs/customer.json": resourceSpecJson({
        fields: [{ name: "name", required: true, type: "string" }],
        label: "Customer",
        ownership: "organization",
        resource: "customer"
      })
    });

    expect(() =>
      generateResourceFromFile({
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).toThrow(/blocking issues/i);
  });

  it("allows explicitly approved planner warnings for fixture-style generation", () => {
    const repoRoot = createRepo(createdRoots, {
      "apps/web/src/features/customer/index.ts": "export const existing = true;\n",
      "specs/customer.json": readFixture("customer.json")
    });

    expect(() =>
      generateResourceFromFile({
        allowedWarningCodes: ["existing-module-conflict"],
        outputPath: ".generated/customer-preview",
        repoRoot,
        specPath: "specs/customer.json"
      })
    ).not.toThrow();
  });

  it("supports the CLI add resource command with --output", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    const result = executeSaasCli({
      args: [
        "add",
        "resource",
        "specs/customer.json",
        "--output",
        ".generated/customer-preview"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Generated resource preview: customer");
  });

  it("generates a working Postgres repo template instead of TODO stubs", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/customer.json": readFixture("customer.json")
    });

    generateResourceFromFile({
      outputPath: ".generated/customer-preview",
      repoRoot,
      specPath: "specs/customer.json"
    });

    const postgresRepo = readGenerated(
      repoRoot,
      ".generated/customer-preview/apps/api/src/modules/generated/customer/postgres-repo.ts"
    );

    expect(postgresRepo).toContain("db.insert(customerTable)");
    expect(postgresRepo).toContain("db.select().from(customerTable)");
    expect(postgresRepo).toContain("db.update(customerTable)");
    expect(postgresRepo).not.toContain("TODO: implement customer");
  });

  it("renders platform belongs-to relations as foreign keys in schema and migrations", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/task.json": resourceSpecJson({
        fields: [
          { name: "title", required: true, type: "string" }
        ],
        label: "Task",
        ownership: "organization",
        relations: [
          {
            kind: "belongs-to",
            name: "project",
            required: true,
            target: "project",
            targetScope: "platform"
          },
          {
            kind: "belongs-to",
            name: "assignee",
            required: false,
            target: "user",
            targetScope: "platform"
          }
        ],
        resource: "task"
      })
    });

    generateResourceFromFile({
      outputPath: ".generated/task-preview",
      repoRoot,
      specPath: "specs/task.json"
    });
    applyResourceFromFile({
      force: true,
      repoRoot,
      specPath: "specs/task.json",
      targetPath: ".generated/task-applied"
    });

    const dbSchema = readGenerated(
      repoRoot,
      ".generated/task-preview/packages/db/src/schema/task.ts"
    );
    const domainIndex = readGenerated(
      repoRoot,
      ".generated/task-preview/packages/domain/src/generated/task/index.ts"
    );
    const webTable = readGenerated(
      repoRoot,
      ".generated/task-preview/apps/web/src/features/task/components/task-table.tsx"
    );
    const webForm = readGenerated(
      repoRoot,
      ".generated/task-preview/apps/web/src/features/task/components/task-form.tsx"
    );
    const migration = readGenerated(
      repoRoot,
      ".generated/task-applied/packages/db/src/migrations/0000_task.sql"
    );

    expect(dbSchema).toContain('import { organizations, projects, users } from "./identity.js";');
    expect(dbSchema).toContain(
      'projectId: uuid("project_id").notNull().references(() => projects.id),'
    );
    expect(dbSchema).toContain(
      'assigneeId: uuid("assignee_id").references(() => users.id),'
    );
    expect(dbSchema).toContain(
      'index("tasks_project_id_idx").on(table.projectId)'
    );
    expect(domainIndex).toContain("projectId: z.string().uuid()");
    expect(domainIndex).toContain("assigneeId: z.string().uuid().optional()");
    expect(webTable).toContain("relationPresentations?: TaskRelationPresentations;");
    expect(webTable).toContain('renderRelationAwareValue(item.id, "projectId", item.projectId, input.relationPresentations)');
    expect(webTable).toContain('renderRelationAwareValue(item.id, "assigneeId", item.assigneeId, input.relationPresentations)');
    expect(webForm).toContain("fieldErrors?: Partial<Record<keyof TaskRecord, string>>;");
    expect(webForm).toContain("relationOptions?: Partial<Record<keyof TaskRecord, readonly TaskFormRelationOption[]>>;");
    expect(webForm).toContain('{input.relationOptions?.projectId && input.relationOptions.projectId.length > 0 ? (');
    expect(webForm).toContain('{input.relationOptions?.assigneeId && input.relationOptions.assigneeId.length > 0 ? (');
    expect(migration).toContain('"project_id" uuid references "projects"("id") not null');
    expect(migration).toContain('"assignee_id" uuid references "users"("id")');
  });

  it("renders generated-resource belongs-to targets with local schema imports", () => {
    const repoRoot = createRepo(createdRoots, {
      "specs/comment.json": resourceSpecJson({
        fields: [
          { name: "body", required: true, type: "text" }
        ],
        label: "Comment",
        ownership: "organization",
        relations: [
          {
            kind: "belongs-to",
            name: "task",
            required: true,
            target: "task"
          }
        ],
        resource: "comment"
      }),
      "packages/db/src/schema/task.ts": "export const taskTable = { id: 'id' };\n",
      "packages/domain/src/generated/task/index.ts": "export const taskDomain = true;\n"
    });

    generateResourceFromFile({
      outputPath: ".generated/comment-preview",
      repoRoot,
      specPath: "specs/comment.json"
    });

    const dbSchema = readGenerated(
      repoRoot,
      ".generated/comment-preview/packages/db/src/schema/comment.ts"
    );

    expect(dbSchema).toContain('import { taskTable } from "./task.js";');
    expect(dbSchema).toContain(
      'taskId: uuid("task_id").notNull().references(() => taskTable.id),'
    );
  });
});

function createRepo(createdRoots: string[], files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-resource-generator-"));

  createdRoots.push(root);

  for (const [path, contents] of Object.entries(files)) {
    const absolutePath = join(root, path);

    mkdirSync(join(absolutePath, ".."), {
      recursive: true
    });
    writeFileSync(absolutePath, contents);
  }

  return root;
}

function readFixture(name: string) {
  return readFileSync(
    resolve(
      process.cwd(),
      "tools/saas/__fixtures__/resources",
      name
    ),
    "utf8"
  );
}

function readGenerated(repoRoot: string, path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function resourceSpecJson(spec: Record<string, unknown>) {
  return JSON.stringify(
    {
      ui: {
        nav: false
      },
      ...spec
    },
    null,
    2
  );
}
