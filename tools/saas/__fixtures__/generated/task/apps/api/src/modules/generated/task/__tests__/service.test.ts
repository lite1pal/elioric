import { describe, expect, it } from "vitest";
import { createTaskService } from "../service.js";
describe("createTaskService", () => {
  it("validates create input before writing task records", async () => {
    const service = createTaskService({
      async create(input) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: input.organizationId,
          title: "title value",
          status: "todo",
          dueAt: "2026-06-29T00:00:00.000Z",
          projectId: "11111111-1111-4111-8111-111111111111",
          assigneeId: "11111111-1111-4111-8111-111111111111",
          createdAt: "2026-06-29T00:00:00.000Z",
          updatedAt: "2026-06-29T00:00:00.000Z"
        };
      },
      async findById() {
        return undefined;
      },
      async list() {
        return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
      },
      async update() {
        return undefined;
      }
    });
    await expect(
      service.create({
        data: {
          title: "title value",
          status: "todo",
          dueAt: "2026-06-29T00:00:00.000Z",
          projectId: "11111111-1111-4111-8111-111111111111",
          assigneeId: "11111111-1111-4111-8111-111111111111",
        },
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).resolves.toMatchObject({
      title: "title value",
      status: "todo",
      dueAt: "2026-06-29T00:00:00.000Z",
      projectId: "11111111-1111-4111-8111-111111111111",
      assigneeId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
