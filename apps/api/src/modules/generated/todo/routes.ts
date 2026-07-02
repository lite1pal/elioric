import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import type { createTodoService } from "./service.js";

const organizationParamsSchema = z.object({
  organizationId: z.string().uuid()
});

const listQuerySchema = z.object({
  archived: z.enum(["exclude", "include", "only"]).optional()
});

const resourceIdParamsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid()
});

type GeneratedResourceAccessRole = "owner" | "admin" | "member" | "viewer";
type GeneratedResourcePolicyAction = "archive" | "read" | "workflow" | "write";
type GeneratedResourcePolicyMode = "organization-role" | "ownership-aware";

interface GeneratedResourcePolicyRule {
  mode: GeneratedResourcePolicyMode;
  ownerField?: string;
}

const generatedResourcePolicy = {
  archive: { mode: "organization-role" },
  read: { mode: "organization-role" },
  workflow: { mode: "organization-role" },
  write: { mode: "organization-role" }
} as const satisfies Record<GeneratedResourcePolicyAction, GeneratedResourcePolicyRule>;

export interface TodoRoutesOptions {
  access: {
    assertOrganizationAccess(input: {
      allowedRoles: readonly GeneratedResourceAccessRole[];
      organizationId: string;
      userId: string;
    }): Promise<void>;
    assertResourceAccess(input: {
      action: GeneratedResourcePolicyAction;
      organizationId: string;
      policy: GeneratedResourcePolicyRule;
      resource: Record<string, unknown>;
      userId: string;
    }): Promise<void>;
  };
  service: ReturnType<typeof createTodoService>;
}

export async function registerTodoRoutes(
  app: FastifyInstance,
  options: TodoRoutesOptions
) {
  app.get("/v1/organizations/:organizationId/todos", async (request, reply) => {
    const user = request.sessionUser;
    const params = organizationParamsSchema.safeParse(request.params);
    const query = listQuerySchema.safeParse(request.query);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success || !query.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await options.access.assertOrganizationAccess({
        allowedRoles: ["owner", "admin", "member", "viewer"],
        organizationId: params.data.organizationId,
        userId: user.id
      });

      return {
        items: await options.service.list({
          archived: query.data.archived,
          cursor: undefined,
          limit: undefined,
          organizationId: params.data.organizationId,
          query: undefined
        })
      };
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.post("/v1/organizations/:organizationId/todos", async (request, reply) => {
    const user = request.sessionUser;
    const params = organizationParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      await options.access.assertOrganizationAccess({
        allowedRoles: ["owner", "admin", "member"],
        organizationId: params.data.organizationId,
        userId: user.id
      });

      return reply.code(201).send(
        await options.service.create({
          data: request.body as Parameters<typeof options.service.create>[0]["data"],
          organizationId: params.data.organizationId
        })
      );
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.get("/v1/organizations/:organizationId/todos/:id", async (request, reply) => {
    const user = request.sessionUser;
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      const resource = await options.service.get({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!resource) {
        return reply.code(404).send({ error: "not_found" });
      }

      await options.access.assertResourceAccess({
        action: "read",
        organizationId: params.data.organizationId,
        policy: generatedResourcePolicy.read,
        resource,
        userId: user.id
      });

      return resource;
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.patch("/v1/organizations/:organizationId/todos/:id", async (request, reply) => {
    const user = request.sessionUser;
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      const currentResource = await options.service.get({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!currentResource) {
        return reply.code(404).send({ error: "not_found" });
      }

      await options.access.assertResourceAccess({
        action: "write",
        organizationId: params.data.organizationId,
        policy: generatedResourcePolicy.write,
        resource: currentResource,
        userId: user.id
      });

      const resource = await options.service.update({
        data: request.body as Parameters<typeof options.service.update>[0]["data"],
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!resource) {
        return reply.code(404).send({ error: "not_found" });
      }

      return resource;
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.post("/v1/organizations/:organizationId/todos/:id/archive", async (request, reply) => {
    const user = request.sessionUser;
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      const currentResource = await options.service.get({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!currentResource) {
        return reply.code(404).send({ error: "not_found" });
      }

      await options.access.assertResourceAccess({
        action: "archive",
        organizationId: params.data.organizationId,
        policy: generatedResourcePolicy.archive,
        resource: currentResource,
        userId: user.id
      });

      const resource = await options.service.archive({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!resource) {
        return reply.code(404).send({ error: "not_found" });
      }

      return resource;
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });

  app.post("/v1/organizations/:organizationId/todos/:id/unarchive", async (request, reply) => {
    const user = request.sessionUser;
    const params = resourceIdParamsSchema.safeParse(request.params);

    if (!user) {
      return reply.code(401).send({ error: "missing_session" });
    }

    if (!params.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    try {
      const currentResource = await options.service.get({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!currentResource) {
        return reply.code(404).send({ error: "not_found" });
      }

      await options.access.assertResourceAccess({
        action: "archive",
        organizationId: params.data.organizationId,
        policy: generatedResourcePolicy.archive,
        resource: currentResource,
        userId: user.id
      });

      const resource = await options.service.unarchive({
        id: params.data.id,
        organizationId: params.data.organizationId
      });

      if (!resource) {
        return reply.code(404).send({ error: "not_found" });
      }

      return resource;
    } catch (error) {
      return mapGeneratedResourceAccessError(reply, error);
    }
  });
}

function mapGeneratedResourceAccessError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error && error.message === "forbidden") {
    return reply.code(403).send({ error: "forbidden" });
  }

  throw error;
}
