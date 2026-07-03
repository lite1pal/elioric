import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";

describe("saas product install", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("installs a simple todo product without manual runtime edits", () => {
    const repoRoot = createSeededRepo(createdRoots);

    const initResult = executeSaasCli({
      args: [
        "init",
        "product",
        "todo",
        "--template",
        "todo",
        "--output",
        "specs/todo.product.json"
      ],
      repoRoot
    });
    const installResult = executeSaasCli({
      args: ["install", "product", "specs/todo.product.json"],
      repoRoot
    });

    expect(initResult.exitCode).toBe(0);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stdout).toContain("Installed product: todo");
    expect(installResult.stdout).toContain("resources: todo");
    expect(readGenerated(repoRoot, "apps/api/src/product-module.ts")).toContain(
      'import { todoProductModule } from "@auditrail/domain/todo";'
    );
    expect(readGenerated(repoRoot, "apps/web/app/product-module.ts")).toContain(
      'import { todoProductModule } from "@auditrail/domain/todo";'
    );
    expect(readGenerated(repoRoot, "packages/domain/package.json")).toContain(
      '"./todo"'
    );
    expect(readGenerated(repoRoot, "packages/domain/src/index.ts")).toContain(
      'export * from "./todo/index";'
    );
    expect(readGenerated(repoRoot, "packages/domain/src/todo/product.ts")).toContain(
      "todoProduct"
    );
    expect(readGenerated(repoRoot, "apps/web/app/todo/page.tsx")).toContain(
      'getProductMetadata("todo")'
    );
    expect(readGenerated(repoRoot, "apps/web/app/todo/page.tsx")).toContain(
      "workspace.activeOrganizationId"
    );
    expect(readGenerated(repoRoot, "apps/web/app/todo/page.tsx")).toContain(
      'query.set("organizationId", organizationId);'
    );
    expect(readGenerated(repoRoot, "apps/web/app/todo/todos/page.tsx")).toContain(
      "createTodoWorkspaceAction"
    );
    expect(readGenerated(repoRoot, "apps/web/app/todo/todos/page.tsx")).toContain(
      "No workspace with the Todo product is enabled for this account yet."
    );
    expect(readGenerated(repoRoot, "apps/web/app/todo/todos/page.tsx")).toContain(
      'value={data.workspace.activeOrganizationId}'
    );
    expect(
      readGenerated(repoRoot, "apps/web/app/todo/todos/[todoId]/page.tsx")
    ).toContain("loadTodoWorkspaceDetailPage");
    expect(
      readGenerated(repoRoot, "apps/web/app/todo/todos/[todoId]/page.tsx")
    ).toContain("!data.workspace.activeOrganizationId");
    expect(
      readGenerated(repoRoot, "apps/web/app/todo/todos/[todoId]/edit/page.tsx")
    ).toContain("updateTodoWorkspaceAction");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/todo-product/server/todo-workspace.ts")
    ).toContain("Enable the Todo product for a workspace before managing todos.");
    expect(
      readGenerated(repoRoot, "apps/web/app/todo/todos/[todoId]/page.tsx")
    ).toContain("archiveTodoWorkspaceAction");
    expect(
      readGenerated(repoRoot, "apps/web/app/todo/todos/[todoId]/page.tsx")
    ).toContain("unarchiveTodoWorkspaceAction");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/todo/components/todo-form.tsx")
    ).toContain("defaultValues?: Partial<TodoRecord>;");
    expect(
      readGenerated(repoRoot, "apps/api/src/modules/generated/todo/routes.ts")
    ).toContain('app.post("/v1/organizations/:organizationId/todos/:id/archive"');
    expect(
      readGenerated(repoRoot, "apps/api/src/modules/generated/todo/routes.ts")
    ).toContain("assertResourceAccess");
    expect(readGenerated(repoRoot, "apps/api/src/app.ts")).toContain(
      "registerTodoRoutes"
    );
    expect(readGenerated(repoRoot, "apps/api/src/__tests__/product-module.test.ts")).toContain(
      'id: "todo"'
    );
    expect(() =>
      statSync(resolve(repoRoot, "apps/web/app/todos/page.tsx"))
    ).toThrow();
  });

  it("can reinstall the same generated product with --force", () => {
    const repoRoot = createSeededRepo(createdRoots);

    executeSaasCli({
      args: [
        "init",
        "product",
        "todo",
        "--template",
        "todo",
        "--output",
        "specs/todo.product.json"
      ],
      repoRoot
    });

    const firstInstall = executeSaasCli({
      args: ["install", "product", "specs/todo.product.json"],
      repoRoot
    });
    const secondInstall = executeSaasCli({
      args: ["install", "product", "specs/todo.product.json", "--force"],
      repoRoot
    });

    expect(firstInstall.exitCode).toBe(0);
    expect(secondInstall.exitCode).toBe(0);
    expect(secondInstall.stdout).toContain(
      "generated file changes: 0 created, 0 updated"
    );
    expect(secondInstall.stdout).toContain("shared root patches: 0 updated");
    expect(readGenerated(repoRoot, "apps/api/src/product-module.ts")).toContain(
      'import { todoProductModule } from "@auditrail/domain/todo";'
    );
    expect(
      readGenerated(repoRoot, "apps/api/src/product-module.ts").match(
        /todoProductModule/g
      )?.length
    ).toBe(2);
    expect(
      readGenerated(repoRoot, "apps/web/app/product-module.ts").match(
        /todoProductModule/g
      )?.length
    ).toBe(2);
    expect(
      readGenerated(repoRoot, "packages/domain/src/index.ts").match(
        /export \* from "\.\/todo\/index";/g
      )?.length
    ).toBe(1);
  });

  it("can upgrade an installed multi-resource product with --force without duplicating shared runtime seams", () => {
    const repoRoot = createSeededRepo(createdRoots);

    executeSaasCli({
      args: [
        "init",
        "product",
        "crm",
        "--template",
        "crm",
        "--output",
        "specs/crm.product.json"
      ],
      repoRoot
    });

    const firstInstall = executeSaasCli({
      args: ["install", "product", "specs/crm.product.json"],
      repoRoot
    });

    const specPath = resolve(repoRoot, "specs/crm.product.json");
    const spec = JSON.parse(readFileSync(specPath, "utf8")) as {
      home: { title: string };
      name: string;
      resources: Array<{ navLabel: string; resource: { resource: string } }>;
    };
    spec.name = "Revenue CRM";
    spec.home.title = "Revenue workspace";
    const companyResource = spec.resources.find(
      (resource) => resource.resource.resource === "company"
    );

    if (!companyResource) {
      throw new Error("Expected company resource in CRM spec.");
    }

    companyResource.navLabel = "Accounts";
    writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);

    const secondInstall = executeSaasCli({
      args: ["install", "product", "specs/crm.product.json", "--force"],
      repoRoot
    });

    expect(firstInstall.exitCode).toBe(0);
    expect(secondInstall.exitCode).toBe(0);
    expect(secondInstall.stdout).toContain("Installed product: crm");
    expect(secondInstall.stdout).toContain("generated file changes: 0 created");
    expect(secondInstall.stdout).toContain("shared root patches: 0 updated");
    expect(
      readGenerated(repoRoot, "packages/domain/src/crm/product.ts")
    ).toContain('"name": "Revenue CRM"');
    expect(
      readGenerated(repoRoot, "packages/domain/src/crm/product.ts")
    ).toContain('"label": "Accounts"');
    expect(
      readGenerated(repoRoot, "apps/web/app/crm/page.tsx")
    ).toContain("workspace.activeOrganizationId");
    expect(
      readGenerated(repoRoot, "apps/web/app/crm/deals/page.tsx")
    ).toContain("No workspace with the Revenue CRM product is enabled for this account yet.");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/crm-product/server/deal-workspace.ts")
    ).toContain("Enable the Revenue CRM product for a workspace before managing deals.");
    expect(
      readGenerated(repoRoot, "apps/api/src/product-module.ts").match(
        /crmProductModule/g
      )?.length
    ).toBe(2);
    expect(
      readGenerated(repoRoot, "apps/web/app/product-module.ts").match(
        /crmProductModule/g
      )?.length
    ).toBe(2);
  });

  it("installs relation-aware product pages for generated resource targets", () => {
    const repoRoot = createSeededRepo(createdRoots);

    const initResult = executeSaasCli({
      args: [
        "init",
        "product",
        "crm",
        "--template",
        "crm",
        "--output",
        "specs/crm.product.json"
      ],
      repoRoot
    });

    const installResult = executeSaasCli({
      args: ["install", "product", "specs/crm.product.json"],
      repoRoot
    });

    expect(initResult.exitCode).toBe(0);
    expect(installResult.exitCode).toBe(0);
    expect(installResult.stdout).toContain("Installed product: crm");
    expect(installResult.stdout).toContain("resources: company, contact, deal, note");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/crm-product/server/deal-workspace.ts")
    ).toContain(
      'import { createResourceClient as createCompanyResourceClient } from "@/src/features/company/api/company-client";'
    );
    expect(
      readGenerated(repoRoot, "apps/web/src/features/crm-product/server/deal-workspace.ts")
    ).toContain("resolveDealRelationPresentations");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/crm-product/server/deal-workspace.ts")
    ).toContain("resolveDealFormOptions");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/crm-product/server/deal-workspace.ts")
    ).toContain("fieldErrors: readFieldErrors(searchParams)");
    expect(
      readGenerated(repoRoot, "apps/web/app/crm/deals/page.tsx")
    ).toContain("relationPresentations={data.relationPresentations}");
    expect(
      readGenerated(repoRoot, "apps/web/app/crm/deals/page.tsx")
    ).toContain("relationOptions={data.formOptions}");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/deal/components/deal-form.tsx")
    ).toContain("fieldErrors?: Partial<Record<keyof DealRecord, string>>;");
    expect(
      readGenerated(repoRoot, "apps/web/src/features/deal/components/deal-form.tsx")
    ).toContain('{input.relationOptions?.companyId && input.relationOptions.companyId.length > 0 ? (');
    expect(
      readGenerated(repoRoot, "apps/web/app/crm/deals/[dealId]/page.tsx")
    ).toContain("renderRelationAwareDetailValue");
    expect(
      readGenerated(repoRoot, "apps/web/app/crm/notes/page.tsx")
    ).toContain("createNoteWorkspaceAction");
    expect(
      readGenerated(repoRoot, "apps/api/src/modules/generated/deal/routes.ts")
    ).toContain('ownerField: "ownerId"');
  });
});

function createSeededRepo(createdRoots: string[]) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-product-install-"));

  createdRoots.push(root);

  const requiredFiles = [
    "apps/api/src/app.ts",
    "apps/api/src/product-module.ts",
    "apps/api/src/__tests__/product-module.test.ts",
    "apps/web/app/product-module.ts",
    "packages/db/src/migrations/meta/_journal.json",
    "packages/db/src/schema/index.ts",
    "packages/domain/package.json",
    "packages/domain/src/index.ts"
  ] as const;

  for (const filePath of requiredFiles) {
    writeRepoFile(root, filePath, readGenerated(process.cwd(), filePath));
  }

  return root;
}

function writeRepoFile(repoRoot: string, filePath: string, contents: string) {
  const absolutePath = resolve(repoRoot, filePath);

  mkdirSync(join(absolutePath, ".."), {
    recursive: true
  });
  writeFileSync(absolutePath, contents);
}

function readGenerated(repoRoot: string, filePath: string) {
  return readFileSync(resolve(repoRoot, filePath), "utf8");
}
