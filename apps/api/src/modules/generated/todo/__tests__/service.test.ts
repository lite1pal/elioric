import { describe, expect, it } from "vitest";
import { createTodoService } from "../service.js";
describe("createTodoService", () => {
  it("validates create input before writing todo records", async () => {
    const service = createTodoService({
      async archive() {
        return undefined;
      },
      async create(input) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: input.organizationId,
          title: "title value",
          details: "details value",
          status: "todo",
          dueAt: "2026-06-29T00:00:00.000Z",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        };
      },
      async findById() {
        return undefined;
      },
      async list() {
        return [];
      },
      async unarchive() {
        return undefined;
      },
      async update() {
        return undefined;
      }
    });
    await expect(
      service.create({
        data: {
          title: "title value",
          details: "details value",
          status: "todo",
          dueAt: "2026-06-29T00:00:00.000Z",
        },
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).resolves.toMatchObject({
      title: "title value",
      details: "details value",
      status: "todo",
      dueAt: "2026-06-29T00:00:00.000Z",
    });
  });

  it("rejects create input that skips the initial workflow state", async () => {
    const service = createTodoService({
      async archive() {
        return undefined;
      },
      async create() {
        throw new Error("should not create");
      },
      async findById() {
        return undefined;
      },
      async list() {
        return [];
      },
      async unarchive() {
        return undefined;
      },
      async update() {
        return undefined;
      }
    });

    await expect(
      service.create({
        data: {
          title: "title value",
          status: "done"
        },
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).rejects.toThrow("New Todo records must start in todo.");
  });

  it("rejects workflow transitions that are not declared", async () => {
    const service = createTodoService({
      async archive() {
        return undefined;
      },
      async create() {
        throw new Error("not used");
      },
      async findById() {
        return {
          archivedAt: undefined,
          createdAt: "2026-06-29T00:00:00.000Z",
          details: "details value",
          dueAt: "2026-06-29T00:00:00.000Z",
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: "00000000-0000-0000-0000-000000000001",
          status: "done" as const,
          title: "title value",
          updatedAt: "2026-06-29T00:00:00.000Z"
        };
      },
      async list() {
        return [];
      },
      async unarchive() {
        return undefined;
      },
      async update() {
        return undefined;
      }
    });

    await expect(
      service.update({
        data: {
          status: "todo"
        },
        id: "00000000-0000-0000-0000-000000000001",
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).rejects.toThrow("Cannot move status from done to todo.");
  });
});
