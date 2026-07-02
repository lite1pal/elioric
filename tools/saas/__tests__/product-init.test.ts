import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeSaasCli } from "../cli.js";

describe("saas product init", () => {
  const createdRoots: string[] = [];

  afterEach(() => {
    for (const root of createdRoots) {
      rmSync(root, {
        force: true,
        recursive: true
      });
    }
  });

  it("creates a todo product spec from terminal flags", () => {
    const repoRoot = createRepo(createdRoots);

    const result = executeSaasCli({
      args: [
        "init",
        "product",
        "todo",
        "--template",
        "todo",
        "--title",
        "Todo",
        "--output",
        "specs/todo.product.json"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Initialized product spec: todo");
    expect(result.stdout).toContain("pnpm saas install product specs/todo.product.json");

    const writtenSpec = JSON.parse(
      readFileSync(resolve(repoRoot, "specs/todo.product.json"), "utf8")
    ) as {
      id: string;
      name: string;
      resources: Array<{
        listPath: string;
        navLabel: string;
        resource: {
          api: { prefix: string };
          resource: string;
          ui: {
            createPage: boolean;
            detailPage: boolean;
            editPage: boolean;
            listPage: boolean;
            nav: boolean;
          };
        };
      }>;
    };

    expect(writtenSpec.id).toBe("todo");
    expect(writtenSpec.name).toBe("Todo");
    expect(writtenSpec.resources).toHaveLength(1);
    expect(writtenSpec.resources[0]).toMatchObject({
      listPath: "/todo/todos",
      navLabel: "Todos",
      resource: {
        api: {
          prefix: "/v1/organizations/:organizationId/todos"
        },
        resource: "todo",
        ui: {
          createPage: false,
          detailPage: false,
          editPage: false,
          listPage: false,
          nav: false
        }
      }
    });
  });

  it("creates a crm product spec from terminal flags", () => {
    const repoRoot = createRepo(createdRoots);

    const result = executeSaasCli({
      args: [
        "init",
        "product",
        "crm",
        "--template",
        "crm",
        "--title",
        "CRM",
        "--output",
        "specs/crm.product.json"
      ],
      repoRoot
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Initialized product spec: crm");
    expect(result.stdout).toContain("pnpm saas install product specs/crm.product.json");

    const writtenSpec = JSON.parse(
      readFileSync(resolve(repoRoot, "specs/crm.product.json"), "utf8")
    ) as {
      id: string;
      name: string;
      resources: Array<{
        listPath: string;
        navLabel: string;
        resource: {
          policy?: {
            archive: { mode: string; ownerField?: string };
            read: { mode: string; ownerField?: string };
            workflow: { mode: string; ownerField?: string };
            write: { mode: string; ownerField?: string };
          };
          relations: Array<{ target: string; targetScope: string }>;
          resource: string;
        };
      }>;
    };

    expect(writtenSpec.id).toBe("crm");
    expect(writtenSpec.name).toBe("CRM");
    expect(writtenSpec.resources.map((resource) => resource.resource.resource)).toEqual([
      "company",
      "contact",
      "deal",
      "note"
    ]);
    expect(writtenSpec.resources.map((resource) => resource.listPath)).toEqual([
      "/crm/companies",
      "/crm/contacts",
      "/crm/deals",
      "/crm/notes"
    ]);
    expect(writtenSpec.resources[1]?.resource.relations).toEqual([
      expect.objectContaining({
        target: "company",
        targetScope: "generated"
      })
    ]);
    expect(writtenSpec.resources[2]?.resource.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "company",
          targetScope: "generated"
        }),
        expect.objectContaining({
          target: "user",
          targetScope: "platform"
        })
      ])
    );
    expect(writtenSpec.resources[2]?.resource.policy).toEqual({
      archive: {
        mode: "ownership-aware",
        ownerField: "ownerId"
      },
      read: {
        mode: "ownership-aware",
        ownerField: "ownerId"
      },
      workflow: {
        mode: "ownership-aware",
        ownerField: "ownerId"
      },
      write: {
        mode: "ownership-aware",
        ownerField: "ownerId"
      }
    });
  });
});

function createRepo(createdRoots: string[]) {
  const root = mkdtempSync(join(tmpdir(), "auditrail-product-init-"));

  createdRoots.push(root);

  return root;
}
