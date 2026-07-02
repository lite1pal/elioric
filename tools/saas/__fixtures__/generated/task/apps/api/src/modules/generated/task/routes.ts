import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { createTaskService } from "./service.js";
const organizationParamsSchema = z.object({
  organizationId: z.string().uuid()
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
export interface TaskRoutesOptions {
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
  service: ReturnType<typeof createTaskService>;
}
export async function registerTaskRoutes(
  app: FastifyInstance,
  options: TaskRoutesOptions
) {
  app.get("/v1/organizations/:organizationId/tasks", async (request, reply) => {
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
        allowedRoles: ["owner", "admin", "member", "viewer"],
        organizationId: params.data.organizationId,
        userId: user.id
      });
      return {
        items: await options.service.list({
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
  app.post("/v1/organizations/:organizationId/tasks", async (request, reply) => {
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
  app.get("/v1/organizations/:organizationId/tasks/:id", async (request, reply) => {
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
  app.patch("/v1/organizations/:organizationId/tasks/:id", async (request, reply) => {
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
}
function mapGeneratedResourceAccessError(reply: FastifyReply, error: unknown) {
  if (error instanceof Error && error.message === "forbidden") {
    return reply.code(403).send({ error: "forbidden" });
  }
  if (error instanceof Error && error.message.startsWith("invalid_workflow_transition:")) {
    return reply.code(400).send({
      error: error.message.slice("invalid_workflow_transition:".length)
    });
  }
  throw error;
}
