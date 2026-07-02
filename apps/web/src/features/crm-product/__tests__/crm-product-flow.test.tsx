import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DealDetailPage from "@/app/crm/deals/[dealId]/page";
import DealEditPage from "@/app/crm/deals/[dealId]/edit/page";
import DealPage from "@/app/crm/deals/page";
import NotePage from "@/app/crm/notes/page";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { CompanyRecord } from "@/src/features/company/domain/schemas";
import type { ContactRecord } from "@/src/features/contact/domain/schemas";
import type { DealRecord } from "@/src/features/deal/domain/schemas";
import type { NoteRecord } from "@/src/features/note/domain/schemas";
import {
  createCompanyWorkspaceAction,
  loadCompanyWorkspacePage
} from "@/src/features/crm-product/server/company-workspace";
import {
  createContactWorkspaceAction,
  loadContactWorkspacePage
} from "@/src/features/crm-product/server/contact-workspace";
import {
  archiveDealWorkspaceAction,
  createDealWorkspaceAction,
  loadDealWorkspaceDetailPage,
  loadDealWorkspacePage,
  updateDealWorkspaceAction
} from "@/src/features/crm-product/server/deal-workspace";
import {
  createNoteWorkspaceAction,
  loadNoteWorkspacePage
} from "@/src/features/crm-product/server/note-workspace";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const DEAL_ID = "33333333-3333-4333-8333-333333333333";
const NOTE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

const companies: CompanyRecord[] = [];
const contacts: ContactRecord[] = [];
const deals: DealRecord[] = [];
const notes: NoteRecord[] = [];

const revalidatePathMock = vi.fn();
const redirectMock = vi.fn();
const requireCurrentUserMock = vi.fn<() => Promise<CurrentUserResponse>>();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args)
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args)
}));

vi.mock("@/src/lib/api/server-api-client", () => ({
  createServerApiClient: vi.fn(() => ({}))
}));

vi.mock("@/src/features/auth/server/auth-server", () => ({
  requireCurrentUser: () => requireCurrentUserMock()
}));

vi.mock("@/app/product-module", () => ({
  getShellProductConfig: vi.fn(() => ({
    availableProducts: [],
    navItems: [],
    productName: "CRM"
  }))
}));

vi.mock("@/src/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("@/src/features/company/api/company-client", () => ({
  createResourceClient: vi.fn(() => ({
    async create(organizationId: string, body: Record<string, unknown>) {
      const nextRecord: CompanyRecord = {
        archivedAt: undefined,
        createdAt: "2026-07-02T08:00:00.000Z",
        domain: typeof body.domain === "string" ? body.domain : undefined,
        id: COMPANY_ID,
        name: String(body.name),
        organizationId,
        status: body.status === "customer" || body.status === "inactive" ? body.status : "lead",
        updatedAt: "2026-07-02T08:00:00.000Z"
      };

      companies.splice(0, companies.length, nextRecord);
      return nextRecord;
    },
    async get(_organizationId: string, id: string) {
      const record = companies.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_company");
      }
      return record;
    },
    async list(_organizationId: string, options?: { archived?: "exclude" | "include" | "only"; query?: string }) {
      return {
        items: filterRecords(companies, options),
        pageInfo: {
          hasMore: false,
          nextCursor: null
        }
      };
    },
    async update(_organizationId: string, id: string, body: Record<string, unknown>) {
      const record = companies.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_company");
      }
      const nextRecord: CompanyRecord = {
        ...record,
        domain: typeof body.domain === "string" ? body.domain : undefined,
        name: String(body.name),
        status: body.status === "customer" || body.status === "inactive" ? body.status : "lead",
        updatedAt: "2026-07-02T09:00:00.000Z"
      };
      replaceRecord(companies, nextRecord);
      return nextRecord;
    },
    async archive(_organizationId: string, id: string) {
      const record = companies.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_company");
      }
      const nextRecord: CompanyRecord = {
        ...record,
        archivedAt: "2026-07-02T10:00:00.000Z",
        updatedAt: "2026-07-02T10:00:00.000Z"
      };
      replaceRecord(companies, nextRecord);
      return nextRecord;
    },
    async unarchive(_organizationId: string, id: string) {
      const record = companies.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_company");
      }
      const nextRecord: CompanyRecord = {
        ...record,
        archivedAt: undefined,
        updatedAt: "2026-07-02T11:00:00.000Z"
      };
      replaceRecord(companies, nextRecord);
      return nextRecord;
    }
  }))
}));

vi.mock("@/src/features/contact/api/contact-client", () => ({
  createResourceClient: vi.fn(() => ({
    async create(organizationId: string, body: Record<string, unknown>) {
      const nextRecord: ContactRecord = {
        archivedAt: undefined,
        companyId: String(body.companyId),
        createdAt: "2026-07-02T08:15:00.000Z",
        email: typeof body.email === "string" ? body.email : undefined,
        id: CONTACT_ID,
        name: String(body.name),
        organizationId,
        title: typeof body.title === "string" ? body.title : undefined,
        updatedAt: "2026-07-02T08:15:00.000Z"
      };

      contacts.splice(0, contacts.length, nextRecord);
      return nextRecord;
    },
    async get(_organizationId: string, id: string) {
      const record = contacts.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_contact");
      }
      return record;
    },
    async list(
      _organizationId: string,
      options?: { archived?: "exclude" | "include" | "only"; query?: string; companyId?: string }
    ) {
      let items = filterRecords(contacts, options);
      if (options?.companyId) {
        items = items.filter((item) => item.companyId === options.companyId);
      }
      return {
        items,
        pageInfo: {
          hasMore: false,
          nextCursor: null
        }
      };
    },
    async update(_organizationId: string, id: string, body: Record<string, unknown>) {
      const record = contacts.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_contact");
      }
      const nextRecord: ContactRecord = {
        ...record,
        companyId: String(body.companyId),
        email: typeof body.email === "string" ? body.email : undefined,
        name: String(body.name),
        title: typeof body.title === "string" ? body.title : undefined,
        updatedAt: "2026-07-02T09:15:00.000Z"
      };
      replaceRecord(contacts, nextRecord);
      return nextRecord;
    },
    async archive(_organizationId: string, id: string) {
      const record = contacts.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_contact");
      }
      const nextRecord: ContactRecord = {
        ...record,
        archivedAt: "2026-07-02T10:15:00.000Z",
        updatedAt: "2026-07-02T10:15:00.000Z"
      };
      replaceRecord(contacts, nextRecord);
      return nextRecord;
    },
    async unarchive(_organizationId: string, id: string) {
      const record = contacts.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_contact");
      }
      const nextRecord: ContactRecord = {
        ...record,
        archivedAt: undefined,
        updatedAt: "2026-07-02T11:15:00.000Z"
      };
      replaceRecord(contacts, nextRecord);
      return nextRecord;
    }
  }))
}));

vi.mock("@/src/features/deal/api/deal-client", () => ({
  createResourceClient: vi.fn(() => ({
    async create(organizationId: string, body: Record<string, unknown>) {
      const nextRecord: DealRecord = {
        amount: typeof body.amount === "string" ? body.amount : undefined,
        archivedAt: undefined,
        companyId: String(body.companyId),
        createdAt: "2026-07-02T08:30:00.000Z",
        id: DEAL_ID,
        name: String(body.name),
        organizationId,
        ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
        stage:
          body.stage === "qualified" ||
          body.stage === "proposal" ||
          body.stage === "won" ||
          body.stage === "lost"
            ? body.stage
            : "lead",
        updatedAt: "2026-07-02T08:30:00.000Z"
      };

      deals.splice(0, deals.length, nextRecord);
      return nextRecord;
    },
    async get(_organizationId: string, id: string) {
      const record = deals.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_deal");
      }
      return record;
    },
    async list(
      _organizationId: string,
      options?: {
        archived?: "exclude" | "include" | "only";
        query?: string;
        companyId?: string;
        ownerId?: string;
        stage?: string;
      }
    ) {
      let items = filterRecords(deals, options);
      if (options?.companyId) {
        items = items.filter((item) => item.companyId === options.companyId);
      }
      if (options?.ownerId) {
        items = items.filter((item) => item.ownerId === options.ownerId);
      }
      if (options?.stage) {
        items = items.filter((item) => item.stage === options.stage);
      }
      return {
        items,
        pageInfo: {
          hasMore: false,
          nextCursor: null
        }
      };
    },
    async update(_organizationId: string, id: string, body: Record<string, unknown>) {
      const record = deals.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_deal");
      }
      const nextRecord: DealRecord = {
        ...record,
        amount: typeof body.amount === "string" ? body.amount : undefined,
        companyId: String(body.companyId),
        name: String(body.name),
        ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
        stage:
          body.stage === "qualified" ||
          body.stage === "proposal" ||
          body.stage === "won" ||
          body.stage === "lost"
            ? body.stage
            : "lead",
        updatedAt: "2026-07-02T09:30:00.000Z"
      };
      replaceRecord(deals, nextRecord);
      return nextRecord;
    },
    async archive(_organizationId: string, id: string) {
      const record = deals.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_deal");
      }
      const nextRecord: DealRecord = {
        ...record,
        archivedAt: "2026-07-02T10:30:00.000Z",
        updatedAt: "2026-07-02T10:30:00.000Z"
      };
      replaceRecord(deals, nextRecord);
      return nextRecord;
    },
    async unarchive(_organizationId: string, id: string) {
      const record = deals.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_deal");
      }
      const nextRecord: DealRecord = {
        ...record,
        archivedAt: undefined,
        updatedAt: "2026-07-02T11:30:00.000Z"
      };
      replaceRecord(deals, nextRecord);
      return nextRecord;
    }
  }))
}));

vi.mock("@/src/features/note/api/note-client", () => ({
  createResourceClient: vi.fn(() => ({
    async create(organizationId: string, body: Record<string, unknown>) {
      const nextRecord: NoteRecord = {
        archivedAt: undefined,
        body: String(body.body),
        createdAt: "2026-07-02T08:45:00.000Z",
        dealId: String(body.dealId),
        id: NOTE_ID,
        organizationId,
        updatedAt: "2026-07-02T08:45:00.000Z"
      };

      notes.splice(0, notes.length, nextRecord);
      return nextRecord;
    },
    async get(_organizationId: string, id: string) {
      const record = notes.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_note");
      }
      return record;
    },
    async list(
      _organizationId: string,
      options?: { archived?: "exclude" | "include" | "only"; query?: string; dealId?: string }
    ) {
      let items = filterRecords(notes, options);
      if (options?.dealId) {
        items = items.filter((item) => item.dealId === options.dealId);
      }
      return {
        items,
        pageInfo: {
          hasMore: false,
          nextCursor: null
        }
      };
    },
    async update(_organizationId: string, id: string, body: Record<string, unknown>) {
      const record = notes.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_note");
      }
      const nextRecord: NoteRecord = {
        ...record,
        body: String(body.body),
        dealId: String(body.dealId),
        updatedAt: "2026-07-02T09:45:00.000Z"
      };
      replaceRecord(notes, nextRecord);
      return nextRecord;
    },
    async archive(_organizationId: string, id: string) {
      const record = notes.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_note");
      }
      const nextRecord: NoteRecord = {
        ...record,
        archivedAt: "2026-07-02T10:45:00.000Z",
        updatedAt: "2026-07-02T10:45:00.000Z"
      };
      replaceRecord(notes, nextRecord);
      return nextRecord;
    },
    async unarchive(_organizationId: string, id: string) {
      const record = notes.find((item) => item.id === id);
      if (!record) {
        throw new Error("missing_note");
      }
      const nextRecord: NoteRecord = {
        ...record,
        archivedAt: undefined,
        updatedAt: "2026-07-02T11:45:00.000Z"
      };
      replaceRecord(notes, nextRecord);
      return nextRecord;
    }
  }))
}));

describe("generated crm product flow", () => {
  beforeEach(() => {
    companies.splice(0, companies.length);
    contacts.splice(0, contacts.length);
    deals.splice(0, deals.length);
    notes.splice(0, notes.length);
    revalidatePathMock.mockReset();
    redirectMock.mockReset();
    requireCurrentUserMock.mockReset();
    requireCurrentUserMock.mockResolvedValue(createCurrentUser());
  });

  it("creates a company, contact, deal, and note through generated crm workspaces, then advances and archives the deal", async () => {
    const currentUser = createCurrentUser();

    const emptyCompanies = await loadCompanyWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      { currentUser }
    );

    expect(emptyCompanies.items).toEqual([]);

    const companyFormData = new FormData();
    companyFormData.set("organizationId", "org-1");
    companyFormData.set("projectId", "project-1");
    companyFormData.set("name", "Acme");
    companyFormData.set("domain", "acme.test");
    companyFormData.set("status", "lead");

    await createCompanyWorkspaceAction(companyFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/crm/companies?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const companyPage = await loadCompanyWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      { currentUser }
    );

    expect(companyPage.items).toEqual([
      expect.objectContaining({
        domain: "acme.test",
        name: "Acme",
        status: "lead"
      })
    ]);

    redirectMock.mockReset();

    const contactFormData = new FormData();
    contactFormData.set("organizationId", "org-1");
    contactFormData.set("projectId", "project-1");
    contactFormData.set("name", "Taylor Champion");
    contactFormData.set("email", "taylor@acme.test");
    contactFormData.set("title", "VP Operations");
    contactFormData.set("companyId", COMPANY_ID);

    await createContactWorkspaceAction(contactFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/crm/contacts?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const contactPage = await loadContactWorkspacePage(
      {
        companyId: COMPANY_ID,
        organizationId: "org-1",
        projectId: "project-1"
      },
      { currentUser }
    );

    expect(contactPage.items).toEqual([
      expect.objectContaining({
        companyId: COMPANY_ID,
        name: "Taylor Champion"
      })
    ]);
    expect(contactPage.relationPresentations[CONTACT_ID]?.companyId).toEqual({
      href: `/crm/companies/${COMPANY_ID}?organizationId=org-1&projectId=project-1&archived=exclude`,
      label: "Acme"
    });

    redirectMock.mockReset();

    const dealFormData = new FormData();
    dealFormData.set("organizationId", "org-1");
    dealFormData.set("projectId", "project-1");
    dealFormData.set("name", "Platform Expansion");
    dealFormData.set("stage", "lead");
    dealFormData.set("amount", "12000");
    dealFormData.set("companyId", COMPANY_ID);
    dealFormData.set("ownerId", USER_ID);

    await createDealWorkspaceAction(dealFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/crm/deals?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const dealPage = await loadDealWorkspacePage(
      {
        companyId: COMPANY_ID,
        organizationId: "org-1",
        ownerId: USER_ID,
        projectId: "project-1",
        stage: "lead"
      },
      { currentUser }
    );

    expect(dealPage.formOptions.companyId).toEqual([
      {
        label: "Acme",
        value: COMPANY_ID
      }
    ]);
    expect(dealPage.items).toEqual([
      expect.objectContaining({
        amount: "12000",
        companyId: COMPANY_ID,
        name: "Platform Expansion",
        ownerId: USER_ID,
        stage: "lead"
      })
    ]);
    expect(dealPage.relationPresentations[DEAL_ID]?.companyId).toEqual({
      href: `/crm/companies/${COMPANY_ID}?organizationId=org-1&projectId=project-1&archived=exclude`,
      label: "Acme"
    });

    redirectMock.mockReset();

    const noteFormData = new FormData();
    noteFormData.set("organizationId", "org-1");
    noteFormData.set("projectId", "project-1");
    noteFormData.set("body", "Champion confirmed and budget approved.");
    noteFormData.set("dealId", DEAL_ID);

    await createNoteWorkspaceAction(noteFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/crm/notes?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const notePage = await loadNoteWorkspacePage(
      {
        dealId: DEAL_ID,
        organizationId: "org-1",
        projectId: "project-1"
      },
      { currentUser }
    );

    expect(notePage.items).toEqual([
      expect.objectContaining({
        body: "Champion confirmed and budget approved.",
        dealId: DEAL_ID
      })
    ]);
    expect(notePage.relationPresentations[NOTE_ID]?.dealId).toEqual({
      href: `/crm/deals/${DEAL_ID}?organizationId=org-1&projectId=project-1&archived=exclude`,
      label: "Platform Expansion"
    });

    redirectMock.mockReset();

    const updateDealFormData = new FormData();
    updateDealFormData.set("dealId", DEAL_ID);
    updateDealFormData.set("organizationId", "org-1");
    updateDealFormData.set("projectId", "project-1");
    updateDealFormData.set("name", "Platform Expansion");
    updateDealFormData.set("stage", "qualified");
    updateDealFormData.set("amount", "18000");
    updateDealFormData.set("companyId", COMPANY_ID);
    updateDealFormData.set("ownerId", USER_ID);

    await updateDealWorkspaceAction(updateDealFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      `/crm/deals/${DEAL_ID}?organizationId=org-1&projectId=project-1&archived=exclude`
    );

    const dealDetail = await loadDealWorkspaceDetailPage(
      {
        dealId: DEAL_ID,
        searchParams: {
          organizationId: "org-1",
          projectId: "project-1"
        }
      },
      { currentUser }
    );

    expect(dealDetail.item).toEqual(
      expect.objectContaining({
        amount: "18000",
        stage: "qualified"
      })
    );

    redirectMock.mockReset();

    const archiveDealFormData = new FormData();
    archiveDealFormData.set("dealId", DEAL_ID);
    archiveDealFormData.set("organizationId", "org-1");
    archiveDealFormData.set("projectId", "project-1");
    archiveDealFormData.set("archived", "exclude");

    await archiveDealWorkspaceAction(archiveDealFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/crm/deals?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const activeDeals = await loadDealWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      { currentUser }
    );
    expect(activeDeals.items).toEqual([]);

    const archivedDeals = await loadDealWorkspacePage(
      {
        archived: "only",
        organizationId: "org-1",
        projectId: "project-1"
      },
      { currentUser }
    );
    expect(archivedDeals.items).toEqual([
      expect.objectContaining({
        archivedAt: "2026-07-02T10:30:00.000Z",
        stage: "qualified"
      })
    ]);
  });

  it("renders the generated crm deal and note pages with relation context and destructive actions visible", async () => {
    companies.splice(0, companies.length, {
      archivedAt: undefined,
      createdAt: "2026-07-02T08:00:00.000Z",
      domain: "acme.test",
      id: COMPANY_ID,
      name: "Acme",
      organizationId: "org-1",
      status: "customer",
      updatedAt: "2026-07-02T09:00:00.000Z"
    });
    deals.splice(0, deals.length, {
      amount: "18000",
      archivedAt: undefined,
      companyId: COMPANY_ID,
      createdAt: "2026-07-02T08:30:00.000Z",
      id: DEAL_ID,
      name: "Platform Expansion",
      organizationId: "org-1",
      ownerId: USER_ID,
      stage: "qualified",
      updatedAt: "2026-07-02T09:30:00.000Z"
    });
    notes.splice(0, notes.length, {
      archivedAt: undefined,
      body: "Champion confirmed and budget approved.",
      createdAt: "2026-07-02T08:45:00.000Z",
      dealId: DEAL_ID,
      id: NOTE_ID,
      organizationId: "org-1",
      updatedAt: "2026-07-02T08:45:00.000Z"
    });

    render(
      await DealPage({
        searchParams: Promise.resolve({
          error_stage: "Stage is required",
          feedback: "Stage is required",
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(screen.getByRole("heading", { level: 1, name: "Deals" })).toBeTruthy();
    expect(screen.getAllByText("Stage is required").length).toBe(2);
    expect(screen.getByRole("button", { name: "Create Deal" })).toBeTruthy();
    expect(screen.getAllByRole("combobox", { name: /^Stage/ })[0]?.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByRole("combobox", { name: /^Company/ })[0]).toBeTruthy();
    expect(screen.getByRole("option", { name: "Acme" })).toBeTruthy();
    expect(screen.getByText("Platform Expansion")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acme" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();

    render(
      await DealDetailPage({
        params: Promise.resolve({
          dealId: DEAL_ID
        }),
        searchParams: Promise.resolve({
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Platform Expansion" })[0]
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to list" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Deal" })).toBeTruthy();

    render(
      await DealEditPage({
        params: Promise.resolve({
          dealId: DEAL_ID
        }),
        searchParams: Promise.resolve({
          error_ownerId: "Owner is required",
          feedback: "Owner is required",
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(screen.getByRole("heading", { level: 1, name: "Edit Deal" })).toBeTruthy();
    expect(screen.getAllByText("Owner is required").length).toBe(2);
    expect(screen.getAllByRole("textbox", { name: /^Owner/ }).at(-1)?.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByDisplayValue("Platform Expansion")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Deal" })).toBeTruthy();

    render(
      await NotePage({
        searchParams: Promise.resolve({
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(screen.getByRole("heading", { level: 1, name: "Notes" })).toBeTruthy();
    expect(screen.getByText("Champion confirmed and budget approved.")).toBeTruthy();
    expect(screen.getAllByText("Platform Expansion").length).toBeGreaterThan(0);
  });
});

function createCurrentUser(): CurrentUserResponse {
  return {
    memberships: [
      {
        installedProducts: [
          {
            enabled: true,
            productId: "crm"
          }
        ],
        onboarding: {
          completedRequiredSteps: 0,
          isComplete: false,
          isDismissed: false,
          steps: [],
          totalRequiredSteps: 0
        },
        organization: {
          id: "org-1",
          name: "Acme"
        },
        organizationId: "org-1",
        plan: {
          id: "starter",
          includedEvents: 1000,
          name: "Starter",
          periodEnd: "2026-07-31T00:00:00.000Z",
          periodStart: "2026-07-01T00:00:00.000Z",
          remainingEvents: 1000,
          usedEvents: 0
        },
        projectIds: ["project-1"],
        projects: [
          {
            id: "project-1",
            name: "Platform",
            organizationId: "org-1"
          }
        ],
        role: "owner"
      }
    ],
    user: {
      email: "owner@example.com",
      id: USER_ID,
      name: "Owner"
    }
  };
}

function replaceRecord<T extends { id: string }>(items: T[], nextRecord: T) {
  const index = items.findIndex((item) => item.id === nextRecord.id);
  if (index === -1) {
    items.push(nextRecord);
    return;
  }
  items.splice(index, 1, nextRecord);
}

function filterRecords<T extends { archivedAt?: string; [key: string]: unknown }>(
  items: readonly T[],
  options?: { archived?: "exclude" | "include" | "only"; query?: string }
) {
  const archived = options?.archived ?? "exclude";
  const query = options?.query?.toLowerCase();

  return items.filter((item) => {
    if (archived === "exclude" && item.archivedAt) {
      return false;
    }
    if (archived === "only" && !item.archivedAt) {
      return false;
    }
    if (!query) {
      return true;
    }
    return Object.values(item).some((value) =>
      typeof value === "string" ? value.toLowerCase().includes(query) : false
    );
  });
}
