import { afterAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { z } from "zod";

import { API_VERSION_PREFIX } from "../api-version.js";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { loadEnvFiles } from "../env-files.js";
import { hashToken } from "../modules/auth/tokens.js";
import { seedDemoProject } from "../../../../packages/db/src/seed.js";

const config = loadConfig(loadEnvFiles());
const integrationEnv = z
  .object({
    TEST_DATABASE_URL: z.string().url()
  })
  .parse(loadEnvFiles());
const databaseUrl = integrationEnv.TEST_DATABASE_URL;
const authTokenSecret = config.AUTH_TOKEN_SECRET!;

describe("crm generated product integration", () => {
  const pool = new pg.Pool({
    connectionString: databaseUrl
  });
  const app = buildApp({
    infrastructure: {
      databaseUrl
    },
    useInfrastructure: true,
    useRateLimit: false
  });

  beforeEach(async () => {
    try {
      await truncateAll();
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "3D000") {
        throw new Error(
          "TEST_DATABASE_URL database does not exist. Run `pnpm db:create:test && pnpm db:migrate:test` first."
        );
      }
      throw error;
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("creates a bounded crm flow through installed generated routes", async () => {
    const session = await createSessionMember();

    const companyResponse = await app.inject({
      method: "POST",
      headers: {
        cookie: session.cookie
      },
      payload: {
        name: "Acme",
        domain: "acme.test",
        status: "lead"
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/companies`
    });

    expect(companyResponse.statusCode).toBe(201);
    expect(companyResponse.json()).toMatchObject({
      domain: "acme.test",
      name: "Acme",
      organizationId: session.organizationId,
      status: "lead"
    });
    const companyId = companyResponse.json().id as string;

    const contactResponse = await app.inject({
      method: "POST",
      headers: {
        cookie: session.cookie
      },
      payload: {
        companyId,
        email: "taylor@acme.test",
        name: "Taylor Champion",
        title: "VP Operations"
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/contacts`
    });

    expect(contactResponse.statusCode).toBe(201);
    expect(contactResponse.json()).toMatchObject({
      companyId,
      email: "taylor@acme.test",
      name: "Taylor Champion",
      organizationId: session.organizationId,
      title: "VP Operations"
    });

    const contactListResponse = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/contacts?companyId=${companyId}`
    });

    expect(contactListResponse.statusCode).toBe(200);
    expect(contactListResponse.json()).toEqual({
      items: [
        expect.objectContaining({
          companyId,
          email: "taylor@acme.test",
          name: "Taylor Champion"
        })
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    const dealResponse = await app.inject({
      method: "POST",
      headers: {
        cookie: session.cookie
      },
      payload: {
        amount: "12000",
        companyId,
        name: "Platform Expansion",
        ownerId: session.userId,
        stage: "lead"
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/deals`
    });

    expect(dealResponse.statusCode).toBe(201);
    expect(dealResponse.json()).toMatchObject({
      amount: "12000",
      companyId,
      name: "Platform Expansion",
      ownerId: session.userId,
      organizationId: session.organizationId,
      stage: "lead"
    });
    const dealId = dealResponse.json().id as string;

    const updateDealResponse = await app.inject({
      method: "PATCH",
      headers: {
        cookie: session.cookie
      },
      payload: {
        amount: "18000",
        companyId,
        name: "Platform Expansion",
        ownerId: session.userId,
        stage: "qualified"
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/deals/${dealId}`
    });

    expect(updateDealResponse.statusCode).toBe(200);
    expect(updateDealResponse.json()).toMatchObject({
      amount: "18000",
      companyId,
      id: dealId,
      name: "Platform Expansion",
      ownerId: session.userId,
      stage: "qualified"
    });

    const wonDealsResponse = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/deals?stage=qualified&ownerId=${session.userId}&companyId=${companyId}`
    });

    expect(wonDealsResponse.statusCode).toBe(200);
    expect(wonDealsResponse.json()).toEqual({
      items: [
        expect.objectContaining({
          amount: "18000",
          companyId,
          id: dealId,
          ownerId: session.userId,
          stage: "qualified"
        })
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    const noteResponse = await app.inject({
      method: "POST",
      headers: {
        cookie: session.cookie
      },
      payload: {
        body: "Champion confirmed and budget approved.",
        dealId
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/notes`
    });

    expect(noteResponse.statusCode).toBe(201);
    expect(noteResponse.json()).toMatchObject({
      body: "Champion confirmed and budget approved.",
      dealId,
      organizationId: session.organizationId
    });

    const noteListResponse = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/notes?dealId=${dealId}`
    });

    expect(noteListResponse.statusCode).toBe(200);
    expect(noteListResponse.json()).toEqual({
      items: [
        expect.objectContaining({
          body: "Champion confirmed and budget approved.",
          dealId
        })
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });

    const archiveDealResponse = await app.inject({
      method: "POST",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/deals/${dealId}/archive`
    });

    expect(archiveDealResponse.statusCode).toBe(200);
    expect(archiveDealResponse.json()).toMatchObject({
      archivedAt: expect.any(String)
    });

    const archivedDealsResponse = await app.inject({
      method: "GET",
      headers: {
        cookie: session.cookie
      },
      url: `${API_VERSION_PREFIX}/organizations/${session.organizationId}/deals?archived=only&stage=qualified`
    });

    expect(archivedDealsResponse.statusCode).toBe(200);
    expect(archivedDealsResponse.json()).toEqual({
      items: [
        expect.objectContaining({
          archivedAt: expect.any(String),
          companyId,
          id: dealId,
          stage: "qualified"
        })
      ],
      pageInfo: {
        hasMore: false,
        nextCursor: null
      }
    });
  });

  async function truncateAll() {
    await pool.query(`
      TRUNCATE TABLE
        notes,
        deals,
        contacts,
        companies,
        todos,
        customers,
        "job_outbox",
        project_webhook_deliveries,
        project_webhook_endpoints,
        audit_events,
        api_keys,
        auth_sessions,
        auth_magic_links,
        organization_memberships,
        organization_invitations,
        user_organization_onboarding_states,
        organization_installed_products,
        projects,
        organizations,
        users
      RESTART IDENTITY CASCADE
    `);
  }

  async function createSessionMember() {
    const seeded = await seedDemoProject({
      databaseUrl
    });
    const user = await pool.query<{ id: string }>(
      `insert into "users" ("email")
       values ($1)
       returning "id"`,
      ["integration-owner@example.com"]
    );
    const userId = user.rows[0]!.id;
    await pool.query(
      `insert into "organization_memberships" ("organization_id", "user_id", "role")
       values ($1, $2, 'owner')`,
      [seeded.organizationId, userId]
    );
    const sessionToken = "integration-session-token";
    await pool.query(
      `insert into "auth_sessions" ("user_id", "token_hash", "expires_at")
       values ($1, $2, now() + interval '30 day')`,
      [userId, hashToken(sessionToken, { secret: authTokenSecret })]
    );
    return {
      cookie: `${config.AUTH_SESSION_COOKIE_NAME}=${sessionToken}`,
      organizationId: seeded.organizationId,
      userId
    };
  }
});
