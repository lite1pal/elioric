import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerTaskRoutes } from "../routes.js";
import type { createTaskService } from "../service.js";
describe("registerTaskRoutes", () => {
  it("requires a session before listing tasks", async () => {
    const app = buildTestApp({}, { session: false });
    const response = await app.inject({
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/tasks"
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_session" });
  });
  it("lists tasks for the current organization", async () => {
    const app = buildTestApp({
      async list(input) {
        expect(input).toEqual({
          filters: {
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
      title: "title value",
      status: "todo",
      dueAt: "2026-06-29T00:00:00.000Z",
      projectId: "11111111-1111-4111-8111-111111111111",
      assigneeId: "11111111-1111-4111-8111-111111111111",
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
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/tasks"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          createdAt: "2026-06-29T00:00:00.000Z",
      title: "title value",
      status: "todo",
      dueAt: "2026-06-29T00:00:00.000Z",
      projectId: "11111111-1111-4111-8111-111111111111",
      assigneeId: "11111111-1111-4111-8111-111111111111",
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
        title: "title value",
        status: "todo",
        dueAt: "2026-06-29T00:00:00.000Z",
        projectId: "11111111-1111-4111-8111-111111111111",
        assigneeId: "11111111-1111-4111-8111-111111111111",
      },
      url: "/v1/organizations/11111111-1111-4111-8111-111111111111/tasks"
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });
});
function buildTestApp(
  overrides: Partial<ReturnType<typeof createTaskService>>,
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
  app.register(registerTaskRoutes, {
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
    service: createTaskServiceStub(overrides)
  });
  return app;
}
function createTaskServiceStub(
  overrides: Partial<ReturnType<typeof createTaskService>>
) {
  return {
    async create() {
      throw new Error("not implemented");
    },
    async get() {
      throw new Error("not implemented");
    },
    async list() {
      return { items: [], pageInfo: { hasMore: false, nextCursor: null } };
    },
    async update() {
      throw new Error("not implemented");
    },
    ...overrides
  };
}
