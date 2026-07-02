import type { TodoRecord, ListTodosInput, ListTodosResponse } from "@auditrail/domain/generated/todo";
import { todoTable } from "@auditrail/db/schema";
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../plugins/database.js";
import type { TodoRepo } from "./repo.js";
export function createPostgresTodoRepo(db: AppDatabase): TodoRepo {
  return {
    async archive(input) {
      const [record] = await db.update(todoTable).set({
        archivedAt: new Date(),
        updatedAt: new Date()
      }).where(
        and(
          eq(todoTable.id, input.id),
          eq(todoTable.organizationId, input.organizationId),
          isNull(todoTable.archivedAt)
        )
      ).returning();

      return record ? toTodoRecord(record) : undefined;
    },
    async create(input) {
      const [record] = await db.insert(todoTable).values({
        organizationId: input.organizationId,
        title: input.data.title,
        details: input.data.details,
        status: input.data.status,
        dueAt: input.data.dueAt ? new Date(input.data.dueAt) : undefined,
      }).returning();
      return toTodoRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(todoTable).where(
        and(
          eq(todoTable.id, input.id),
          eq(todoTable.organizationId, input.organizationId)
        )
      ).limit(1);
      return record ? toTodoRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const sortBy = input.filters.sortBy ?? "createdAt";
      const sortDirection = input.filters.sortDirection ?? "desc";
      const archived = input.filters.archived ?? "exclude";
      const [cursorRecord] = input.filters.cursor ? await db.select({
        sortValue: resolveGeneratedListSortColumn(sortBy),
        id: todoTable.id
      }).from(todoTable).where(
        and(
          eq(todoTable.id, input.filters.cursor),
          eq(todoTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      if (input.filters.cursor && !cursorRecord) {
        throw new Error("invalid_cursor");
      }
      const records = await db.select().from(todoTable).where(
        and(
          eq(todoTable.organizationId, input.organizationId),
          archived === "only"
            ? isNotNull(todoTable.archivedAt)
            : archived === "include"
              ? undefined
              : isNull(todoTable.archivedAt),
          input.filters.status !== undefined ? eq(todoTable.status, input.filters.status) : undefined,
          pattern
            ? or(
      ilike(sql`cast(${todoTable.title} as text)`, pattern)
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
        items: pageRecords.map(toTodoRecord),
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null
        }
      };
    },
    async unarchive(input) {
      const [record] = await db.update(todoTable).set({
        archivedAt: null,
        updatedAt: new Date()
      }).where(
        and(
          eq(todoTable.id, input.id),
          eq(todoTable.organizationId, input.organizationId),
          isNotNull(todoTable.archivedAt)
        )
      ).returning();

      return record ? toTodoRecord(record) : undefined;
    },
    async update(input) {
      const [record] = await db.update(todoTable).set({
        title: input.data.title !== undefined ? input.data.title : undefined,
        details: input.data.details !== undefined ? input.data.details : undefined,
        status: input.data.status !== undefined ? input.data.status : undefined,
        dueAt: input.data.dueAt !== undefined ? input.data.dueAt ? new Date(input.data.dueAt) : undefined : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(todoTable.id, input.id),
          eq(todoTable.organizationId, input.organizationId)
        )
      ).returning();
      return record ? toTodoRecord(record) : undefined;
    }
  };
}
function resolveGeneratedListSortColumn(
  sortBy: ListTodosInput["sortBy"] extends infer T ? NonNullable<T> : never
) {
  switch (sortBy) {
    case "createdAt":
      return todoTable.createdAt;
    case "updatedAt":
      return todoTable.updatedAt;
    case "title":
      return todoTable.title;
    default:
      return todoTable.createdAt;
  }
}
function resolveGeneratedListOrder(
  sortBy: ListTodosInput["sortBy"] extends infer T ? NonNullable<T> : never,
  sortDirection: "asc" | "desc"
) {
  const sortColumn = resolveGeneratedListSortColumn(sortBy);
  return sortDirection === "asc"
    ? [asc(sortColumn), asc(todoTable.id)] as const
    : [desc(sortColumn), desc(todoTable.id)] as const;
}
function buildGeneratedListCursorClause(input: {
  cursorRecord: {
    id: string;
    sortValue: unknown;
  };
  sortBy: ListTodosInput["sortBy"] extends infer T ? NonNullable<T> : never;
  sortDirection: "asc" | "desc";
}) {
  switch (input.sortBy) {
    case "createdAt":
      return input.sortDirection === "asc"
        ? or(
            gt(todoTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(todoTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              gt(todoTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(todoTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(todoTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              lt(todoTable.id, input.cursorRecord.id)
            )
          );
    case "updatedAt":
      return input.sortDirection === "asc"
        ? or(
            gt(todoTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(todoTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              gt(todoTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(todoTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(todoTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              lt(todoTable.id, input.cursorRecord.id)
            )
          );
    case "title":
      return input.sortDirection === "asc"
        ? or(
            gt(todoTable.title, input.cursorRecord.sortValue as string),
            and(
              eq(todoTable.title, input.cursorRecord.sortValue as string),
              gt(todoTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(todoTable.title, input.cursorRecord.sortValue as string),
            and(
              eq(todoTable.title, input.cursorRecord.sortValue as string),
              lt(todoTable.id, input.cursorRecord.id)
            )
          );
    default:
      return undefined;
  }
}
function toTodoRecord(
  record: typeof todoTable.$inferSelect
): TodoRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    title: record.title,
    details: record.details ?? undefined,
    status: record.status as TodoRecord["status"],
    dueAt: record.dueAt?.toISOString(),
    archivedAt: record.archivedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
