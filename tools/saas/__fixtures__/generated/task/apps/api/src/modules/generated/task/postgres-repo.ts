import type { TaskRecord, ListTasksInput, ListTasksResponse } from "@auditrail/domain/generated/task";
import { taskTable } from "@auditrail/db/schema";
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../plugins/database.js";
import type { TaskRepo } from "./repo.js";
export function createPostgresTaskRepo(db: AppDatabase): TaskRepo {
  return {
    async create(input) {
      const [record] = await db.insert(taskTable).values({
        organizationId: input.organizationId,
        title: input.data.title,
        status: input.data.status,
        dueAt: input.data.dueAt ? new Date(input.data.dueAt) : undefined,
        projectId: input.data.projectId,
        assigneeId: input.data.assigneeId,
      }).returning();
      return toTaskRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(taskTable).where(
        and(
          eq(taskTable.id, input.id),
          eq(taskTable.organizationId, input.organizationId)
        )
      ).limit(1);
      return record ? toTaskRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const sortBy = input.filters.sortBy ?? "createdAt";
      const sortDirection = input.filters.sortDirection ?? "desc";
      const [cursorRecord] = input.filters.cursor ? await db.select({
        sortValue: resolveGeneratedListSortColumn(sortBy),
        id: taskTable.id
      }).from(taskTable).where(
        and(
          eq(taskTable.id, input.filters.cursor),
          eq(taskTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      if (input.filters.cursor && !cursorRecord) {
        throw new Error("invalid_cursor");
      }
      const records = await db.select().from(taskTable).where(
        and(
          eq(taskTable.organizationId, input.organizationId),
          pattern
            ? or(
      ilike(sql`cast(${taskTable.title} as text)`, pattern)
            )
            : undefined,
          cursorRecord
            ? buildGeneratedListCursorClause({
                cursorRecord,
                sortBy,
                sortDirection
              })
            : undefined
        )
      ).orderBy(...resolveGeneratedListOrder(sortBy, sortDirection)).limit(limit + 1);
      const hasMore = records.length > limit;
      const pageRecords = hasMore ? records.slice(0, limit) : records;
      return {
        items: pageRecords.map(toTaskRecord),
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null
        }
      };
    },
    async update(input) {
      const [record] = await db.update(taskTable).set({
        title: input.data.title !== undefined ? input.data.title : undefined,
        status: input.data.status !== undefined ? input.data.status : undefined,
        dueAt: input.data.dueAt !== undefined ? input.data.dueAt ? new Date(input.data.dueAt) : undefined : undefined,
        projectId: input.data.projectId !== undefined ? input.data.projectId : undefined,
        assigneeId: input.data.assigneeId !== undefined ? input.data.assigneeId : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(taskTable.id, input.id),
          eq(taskTable.organizationId, input.organizationId)
        )
      ).returning();
      return record ? toTaskRecord(record) : undefined;
    }
  };
}
function resolveGeneratedListSortColumn(
  sortBy: ListTasksInput["sortBy"] extends infer T ? NonNullable<T> : never
) {
  switch (sortBy) {
    case "createdAt":
      return taskTable.createdAt;
    case "updatedAt":
      return taskTable.updatedAt;
    default:
      return taskTable.createdAt;
  }
}
function resolveGeneratedListOrder(
  sortBy: ListTasksInput["sortBy"] extends infer T ? NonNullable<T> : never,
  sortDirection: "asc" | "desc"
) {
  const sortColumn = resolveGeneratedListSortColumn(sortBy);
  return sortDirection === "asc"
    ? [asc(sortColumn), asc(taskTable.id)] as const
    : [desc(sortColumn), desc(taskTable.id)] as const;
}
function buildGeneratedListCursorClause(input: {
  cursorRecord: {
    id: string;
    sortValue: unknown;
  };
  sortBy: ListTasksInput["sortBy"] extends infer T ? NonNullable<T> : never;
  sortDirection: "asc" | "desc";
}) {
  switch (input.sortBy) {
    case "createdAt":
      return input.sortDirection === "asc"
        ? or(
            gt(taskTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(taskTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              gt(taskTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(taskTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(taskTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              lt(taskTable.id, input.cursorRecord.id)
            )
          );
    case "updatedAt":
      return input.sortDirection === "asc"
        ? or(
            gt(taskTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(taskTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              gt(taskTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(taskTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(taskTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              lt(taskTable.id, input.cursorRecord.id)
            )
          );
    default:
      return undefined;
  }
}
function toTaskRecord(
  record: typeof taskTable.$inferSelect
): TaskRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    title: record.title,
    status: record.status as TaskRecord["status"],
    dueAt: record.dueAt?.toISOString(),
    projectId: record.projectId,
    assigneeId: record.assigneeId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
