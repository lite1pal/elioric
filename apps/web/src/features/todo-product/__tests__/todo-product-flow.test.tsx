import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResourceDetailPage from "@/app/todo/todos/[todoId]/page";
import ResourceEditPage from "@/app/todo/todos/[todoId]/edit/page";
import type { CurrentUserResponse } from "@/src/features/auth/domain/schemas";
import type { TodoRecord } from "@/src/features/todo/domain/schemas";
import ResourcePage from "@/app/todo/todos/page";
import {
  archiveTodoWorkspaceAction,
  createTodoWorkspaceAction,
  loadTodoWorkspaceDetailPage,
  loadTodoWorkspacePage,
  unarchiveTodoWorkspaceAction,
  updateTodoWorkspaceAction
} from "@/src/features/todo-product/server/todo-workspace";

const records: TodoRecord[] = [];
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
    productName: "Todo"
  }))
}));

vi.mock("@/src/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock("@/src/features/todo/api/todo-client", () => ({
  createResourceClient: vi.fn(() => ({
    async create(organizationId: string, body: Record<string, unknown>) {
      const nextRecord: TodoRecord = {
        createdAt: "2026-07-01T09:00:00.000Z",
        details:
          typeof body.details === "string" ? body.details : undefined,
        dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
        id: "todo-1",
        organizationId,
        status: body.status === "done" ? "done" : "todo",
        title: String(body.title),
        updatedAt: "2026-07-01T09:00:00.000Z"
      };

      records.splice(0, records.length, nextRecord);

      return nextRecord;
    },
    async get() {
      return records[0];
    },
    async list(
      _organizationId: string,
      options?: { archived?: "exclude" | "include" | "only" }
    ) {
      const archived = options?.archived ?? "exclude";
      const items =
        archived === "only"
          ? records.filter((record) => record.archivedAt)
          : archived === "include"
            ? [...records]
            : records.filter((record) => !record.archivedAt);

      return {
        items,
        pageInfo: {
          hasMore: false,
          nextCursor: null
        }
      };
    },
    async archive() {
      const existing = records[0];

      if (!existing) {
        throw new Error("missing_todo");
      }

      const nextRecord: TodoRecord = {
        ...existing,
        archivedAt: "2026-07-01T11:00:00.000Z",
        updatedAt: "2026-07-01T11:00:00.000Z"
      };

      records.splice(0, records.length, nextRecord);

      return nextRecord;
    },
    async unarchive() {
      const existing = records[0];

      if (!existing) {
        throw new Error("missing_todo");
      }

      const nextRecord: TodoRecord = {
        ...existing,
        archivedAt: undefined,
        updatedAt: "2026-07-01T12:00:00.000Z"
      };

      records.splice(0, records.length, nextRecord);

      return nextRecord;
    },
    async update(
      _organizationId: string,
      _id: string,
      body: Record<string, unknown>
    ) {
      const existing = records[0];

      if (!existing) {
        throw new Error("missing_todo");
      }
      const nextStatus = body.status === "done" ? "done" : "todo";

      if (existing.status === "done" && nextStatus === "todo") {
        throw new Error("Cannot move status from done to todo.");
      }

      const nextRecord: TodoRecord = {
        ...existing,
        details:
          typeof body.details === "string" ? body.details : undefined,
        dueAt: typeof body.dueAt === "string" ? body.dueAt : undefined,
        status: nextStatus,
        title: String(body.title),
        updatedAt: "2026-07-01T10:00:00.000Z"
      };

      records.splice(0, records.length, nextRecord);

      return nextRecord;
    }
  }))
}));

describe("generated todo product flow", () => {
  beforeEach(() => {
    records.splice(0, records.length);
    revalidatePathMock.mockReset();
    redirectMock.mockReset();
    requireCurrentUserMock.mockReset();
    requireCurrentUserMock.mockResolvedValue(createCurrentUser());
  });

  it("loads the workspace, surfaces validation feedback, creates a todo, opens detail, edits it, archives it, and restores it through the generated flow", async () => {
    const currentUser = createCurrentUser();
    const emptyPage = await loadTodoWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(emptyPage.workspace.activeOrganizationId).toBe("org-1");
    expect(emptyPage.workspace.activeProjectId).toBe("project-1");
    expect(emptyPage.items).toEqual([]);

    const invalidFormData = new FormData();
    invalidFormData.set("organizationId", "org-1");
    invalidFormData.set("projectId", "project-1");
    invalidFormData.set("title", "");
    invalidFormData.set("details", "Create and list one todo through the generated page");
    invalidFormData.set("status", "todo");
    invalidFormData.set("dueAt", "2026-07-01T12:30");

    await createTodoWorkspaceAction(invalidFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1&archived=exclude&feedback=Too+small%3A+expected+string+to+have+%3E%3D1+characters&draft_details=Create+and+list+one+todo+through+the+generated+page&draft_status=todo&draft_dueAt=2026-07-01T12%3A30"
    );

    const invalidPage = await loadTodoWorkspacePage(
      {
        draft_details: "Create and list one todo through the generated page",
        draft_dueAt: "2026-07-01T12:30",
        draft_status: "todo",
        feedback: "Too small: expected string to have >=1 characters",
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(invalidPage.feedback).toBe(
      "Too small: expected string to have >=1 characters"
    );
    expect(invalidPage.draftValues).toEqual(
      expect.objectContaining({
        details: "Create and list one todo through the generated page",
        dueAt: "2026-07-01T12:30",
        status: "todo"
      })
    );
    expect(invalidPage.items).toEqual([]);

    redirectMock.mockReset();

    const formData = new FormData();
    formData.set("organizationId", "org-1");
    formData.set("projectId", "project-1");
    formData.set("title", "Ship generated proof");
    formData.set("details", "Create and list one todo through the generated page");
    formData.set("status", "todo");
    formData.set("dueAt", "2026-07-01T12:30");

    await createTodoWorkspaceAction(formData);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1&archived=exclude"
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const detailPage = await loadTodoWorkspaceDetailPage(
      {
        searchParams: {
          organizationId: "org-1",
          projectId: "project-1"
        },
        todoId: "todo-1"
      },
      {
        currentUser
      }
    );

    expect(detailPage.item).toEqual(
      expect.objectContaining({
        title: "Ship generated proof"
      })
    );

    const updateFormData = new FormData();
    updateFormData.set("todoId", "todo-1");
    updateFormData.set("organizationId", "org-1");
    updateFormData.set("projectId", "project-1");
    updateFormData.set("title", "Ship generated detail flow");
    updateFormData.set("details", "Detail and edit now come from generated product routes");
    updateFormData.set("status", "done");
    updateFormData.set("dueAt", "2026-07-01T14:45");

    await updateTodoWorkspaceAction(updateFormData);

    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/todo/todos/todo-1?organizationId=org-1&projectId=project-1&archived=exclude"
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1&archived=exclude"
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos/todo-1?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const populatedPage = await loadTodoWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(populatedPage.items).toEqual([
      expect.objectContaining({
        details: "Detail and edit now come from generated product routes",
        dueAt: expect.any(String),
        organizationId: "org-1",
        status: "done",
        title: "Ship generated detail flow"
      })
    ]);

    redirectMock.mockReset();

    const invalidTransitionFormData = new FormData();
    invalidTransitionFormData.set("todoId", "todo-1");
    invalidTransitionFormData.set("organizationId", "org-1");
    invalidTransitionFormData.set("projectId", "project-1");
    invalidTransitionFormData.set("title", "Ship generated detail flow");
    invalidTransitionFormData.set("details", "Detail and edit now come from generated product routes");
    invalidTransitionFormData.set("status", "todo");
    invalidTransitionFormData.set("dueAt", "2026-07-01T14:45");

    await updateTodoWorkspaceAction(invalidTransitionFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos/todo-1/edit?organizationId=org-1&projectId=project-1&archived=exclude&feedback=Cannot+move+status+from+done+to+todo.&draft_title=Ship+generated+detail+flow&draft_details=Detail+and+edit+now+come+from+generated+product+routes&draft_status=todo&draft_dueAt=2026-07-01T14%3A45"
    );

    const invalidTransitionDetailPage = await loadTodoWorkspaceDetailPage(
      {
        searchParams: {
          draft_details:
            "Detail and edit now come from generated product routes",
          draft_dueAt: "2026-07-01T14:45",
          draft_status: "todo",
          draft_title: "Ship generated detail flow",
          feedback: "Cannot move status from done to todo.",
          organizationId: "org-1",
          projectId: "project-1"
        },
        todoId: "todo-1"
      },
      {
        currentUser
      }
    );

    expect(invalidTransitionDetailPage.feedback).toBe(
      "Cannot move status from done to todo."
    );
    expect(invalidTransitionDetailPage.item).toEqual(
      expect.objectContaining({
        status: "done"
      })
    );

    redirectMock.mockReset();

    const archiveFormData = new FormData();
    archiveFormData.set("todoId", "todo-1");
    archiveFormData.set("organizationId", "org-1");
    archiveFormData.set("projectId", "project-1");
    archiveFormData.set("archived", "exclude");

    await archiveTodoWorkspaceAction(archiveFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const emptyAgain = await loadTodoWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(emptyAgain.items).toEqual([]);

    const archivedOnlyPage = await loadTodoWorkspacePage(
      {
        archived: "only",
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(archivedOnlyPage.items).toEqual([
      expect.objectContaining({
        archivedAt: "2026-07-01T11:00:00.000Z",
        title: "Ship generated detail flow"
      })
    ]);

    const unarchiveFormData = new FormData();
    unarchiveFormData.set("todoId", "todo-1");
    unarchiveFormData.set("organizationId", "org-1");
    unarchiveFormData.set("projectId", "project-1");
    unarchiveFormData.set("archived", "only");

    await unarchiveTodoWorkspaceAction(unarchiveFormData);

    expect(redirectMock).toHaveBeenCalledWith(
      "/todo/todos/todo-1?organizationId=org-1&projectId=project-1&archived=exclude"
    );

    const restoredPage = await loadTodoWorkspacePage(
      {
        organizationId: "org-1",
        projectId: "project-1"
      },
      {
        currentUser
      }
    );

    expect(restoredPage.items).toEqual([
      expect.objectContaining({
        archivedAt: undefined,
        title: "Ship generated detail flow"
      })
    ]);
  });

  it("renders the generated todo list, detail, and edit pages with feedback and destructive actions visible", async () => {
    records.splice(0, records.length, {
      createdAt: "2026-07-01T09:00:00.000Z",
      details: "Detail and edit now come from generated product routes",
      dueAt: "2026-07-01T12:30:00.000Z",
      id: "todo-1",
      organizationId: "org-1",
      status: "done",
      title: "Ship generated detail flow",
      updatedAt: "2026-07-01T09:00:00.000Z"
    });

    render(
      await ResourcePage({
        searchParams: Promise.resolve({
          draft_details: "Detail and edit now come from generated product routes",
          draft_dueAt: "2026-07-01T12:30",
          draft_status: "done",
          feedback: "Title is required",
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Todos" })
    ).toBeTruthy();
    expect(screen.getByText("Title is required")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Todo" })).toBeTruthy();
    expect(
      screen.getByDisplayValue("Detail and edit now come from generated product routes")
    ).toBeTruthy();
    expect(screen.getByText("Ship generated detail flow")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();

    render(
      await ResourceDetailPage({
        params: Promise.resolve({
          todoId: "todo-1"
        }),
        searchParams: Promise.resolve({
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Ship generated detail flow" })[0]
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to list" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive Todo" })).toBeTruthy();

    render(
      await ResourceEditPage({
        params: Promise.resolve({
          todoId: "todo-1"
        }),
        searchParams: Promise.resolve({
          draft_details: "Updated from validation feedback",
          feedback: "Status is required",
          organizationId: "org-1",
          projectId: "project-1"
        })
      })
    );

    expect(screen.getByRole("heading", { level: 1, name: "Edit Todo" })).toBeTruthy();
    expect(screen.getByText("Status is required")).toBeTruthy();
    expect(screen.getByDisplayValue("Ship generated detail flow")).toBeTruthy();
    expect(screen.getByDisplayValue("Updated from validation feedback")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Todo" })).toBeTruthy();
  });
});

function createCurrentUser(): CurrentUserResponse {
  return {
    memberships: [
      {
        installedProducts: [
          {
            enabled: true,
            productId: "todo"
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
      id: "user-1",
      name: "Owner"
    }
  };
}
