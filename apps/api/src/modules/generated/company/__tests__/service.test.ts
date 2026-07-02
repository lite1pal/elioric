import { describe, expect, it } from "vitest";
import { createCompanyService } from "../service.js";
describe("createCompanyService", () => {
  it("validates create input before writing company records", async () => {
    const service = createCompanyService({
      async archive() {
        return undefined;
      },
      async create(input) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: input.organizationId,
          name: "name value",
          domain: "domain value",
          status: "lead",
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
          name: "name value",
          domain: "domain value",
          status: "lead",
        },
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).resolves.toMatchObject({
      name: "name value",
      domain: "domain value",
      status: "lead",
    });
  });
});
