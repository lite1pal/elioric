import { describe, expect, it } from "vitest";
import { createDealService } from "../service.js";
describe("createDealService", () => {
  it("validates create input before writing deal records", async () => {
    const service = createDealService({
      async archive() {
        return undefined;
      },
      async create(input) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          organizationId: input.organizationId,
          name: "name value",
          stage: "lead",
          amount: "amount value",
          companyId: "11111111-1111-4111-8111-111111111111",
          ownerId: "11111111-1111-4111-8111-111111111111",
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
          stage: "lead",
          amount: "amount value",
          companyId: "11111111-1111-4111-8111-111111111111",
          ownerId: "11111111-1111-4111-8111-111111111111",
        },
        organizationId: "00000000-0000-0000-0000-000000000001"
      })
    ).resolves.toMatchObject({
      name: "name value",
      stage: "lead",
      amount: "amount value",
      companyId: "11111111-1111-4111-8111-111111111111",
      ownerId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
