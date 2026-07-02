import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerCompanyRoutes } from "../routes.js";
import type { createCompanyService } from "../service.js";
describe("registerCompanyRoutes", () => {
  it("requires a session before listing companies", async () => {
    const app = buildTestApp({}, { session: false });
    const response = await app.inject({
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/companies?archived=only"
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });
  it("lists companies for the current organization", async () => {
    const app = buildTestApp({
      async list(input) {
        expect(input).toEqual({
          filters: {
            archived: "only",
            cursor: undefined,
            limit: undefined,
            query: undefined,
            sortBy: "createdAt",
            sortDirection: "desc"
          },
          organizationId: "11111111-1111-4111-8111-111111111111",
        });
        return {
          items: [
            {
              createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      domain: "domain value",
      status: "lead",
              id: "22222222-2222-4222-8222-222222222222",
              organizationId: "11111111-1111-4111-8111-111111111111",
              updatedAt: "2026-06-29T00:00:00.000Z"
            }
          ],
          pageInfo: {
            hasMore: false,
            nextCursor: null
          }
        };
      }
    });
    const response = await app.inject({
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/companies?archived=only"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      domain: "domain value",
      status: "lead",
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-06-29T00:00:00.000Z"
        }
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });
  });
  it("maps forbidden organization access to 403", async () => {
    const app = buildTestApp({}, {
      accessError: new Error("forbidden")
    });
    const response = await app.inject({
      method: "POST",
      payload: {
        name: "name value",
        domain: "domain value",
        status: "lead",
      },
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/companies"
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("archives company records for authorized organization members", async () => {
    const app = buildTestApp({
      async get() {
        return {
          createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      domain: "domain value",
      status: "lead",
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-06-29T00:00:00.000Z"
        };
      },
      async archive(input) {
        expect(input).toEqual({
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111"
        });

        return {
          createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      domain: "domain value",
      status: "lead",
          archivedAt: "2026-07-01T00:00:00.000Z",
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-07-01T00:00:00.000Z"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/companies/22222222-2222-4222-8222-222222222222/archive"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ archivedAt: "2026-07-01T00:00:00.000Z" });
  });

  it("unarchives company records for authorized organization members", async () => {
    const app = buildTestApp({
      async get() {
        return {
          archivedAt: "2026-07-01T00:00:00.000Z",
          createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      domain: "domain value",
      status: "lead",
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-07-01T00:00:00.000Z"
        };
      },
      async unarchive(input) {
        expect(input).toEqual({
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111"
        });

        return {
          createdAt: "2026-06-29T00:00:00.000Z",
      name: "name value",
      domain: "domain value",
      status: "lead",
          archivedAt: undefined,
          id: "22222222-2222-4222-8222-222222222222",
          organizationId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-07-01T00:00:00.000Z"
        };
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/companies/22222222-2222-4222-8222-222222222222/unarchive"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).not.toHaveProperty("archivedAt");
  });
});
function buildTestApp(
  overrides: Partial<ReturnType<typeof createCompanyService>>,
  options: {
    accessError?: Error;
    recordAccessError?: Error;
    session?: boolean;
  } = {}
) {
  const app = Fastify();
  const useSession = options.session ?? true;
  app.decorateRequest("sessionUser");
  app.addHook("preHandler", async (request) => {
    request.sessionUser = useSession
      ? {
          email: "user@example.com",
          id: "user-1"
        }
      : undefined;
  });
  app.register(registerCompanyRoutes, {
    access: {
      async assertOrganizationAccess() {
        if (options.accessError) {
          throw options.accessError;
        }
      },
      async assertResourceAccess() {
        if (options.recordAccessError) {
          throw options.recordAccessError;
        }
      }
    },
    service: createCompanyServiceStub(overrides)
  });
  return app;
}
function createCompanyServiceStub(
  overrides: Partial<ReturnType<typeof createCompanyService>>
) {
  return {
    async archive() {
      throw new Error("not implemented");
    },
    async create() {
      throw new Error("not implemented");
    },
    async get() {
      throw new Error("not implemented");
    },
    async list() {
      return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
    },
    async unarchive() {
      throw new Error("not implemented");
    },
    async update() {
      throw new Error("not implemented");
    },
    ...overrides
  };
}
