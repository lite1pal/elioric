import { describe, expect, it } from "vitest";

import { createWorkspaceAccessService } from "../access.js";

describe("createWorkspaceAccessService", () => {
  it("allows default organization-role access for viewers on reads", async () => {
    const service = createWorkspaceAccessService({
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "viewer",
          userId: "user-1"
        };
      },
      async findProject() {
        return undefined;
      },
      async isOrganizationProductInstalled() {
        return true;
      }
    });

    await expect(
      service.assertResourceAccess({
        action: "read",
        organizationId: "org-1",
        policy: {
          mode: "organization-role"
        },
        resource: {
          id: "record-1"
        },
        userId: "user-1"
      })
    ).resolves.toBeUndefined();
  });

  it("rejects member access to ownership-aware records they do not own", async () => {
    const service = createWorkspaceAccessService({
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        };
      },
      async findProject() {
        return undefined;
      },
      async isOrganizationProductInstalled() {
        return true;
      }
    });

    await expect(
      service.assertResourceAccess({
        action: "write",
        organizationId: "org-1",
        policy: {
          mode: "ownership-aware",
          ownerField: "ownerId"
        },
        resource: {
          id: "record-1",
          ownerId: "user-2"
        },
        userId: "user-1"
      })
    ).rejects.toThrow("forbidden");
  });

  it("allows member access to ownership-aware records they own", async () => {
    const service = createWorkspaceAccessService({
      async findMembership() {
        return {
          id: "membership-1",
          organizationId: "org-1",
          role: "member",
          userId: "user-1"
        };
      },
      async findProject() {
        return undefined;
      },
      async isOrganizationProductInstalled() {
        return true;
      }
    });

    await expect(
      service.assertResourceAccess({
        action: "archive",
        organizationId: "org-1",
        policy: {
          mode: "ownership-aware",
          ownerField: "ownerId"
        },
        resource: {
          id: "record-1",
          ownerId: "user-1"
        },
        userId: "user-1"
      })
    ).resolves.toBeUndefined();
  });
});
