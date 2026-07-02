import type { NoteRecord, ListNotesInput, ListNotesResponse } from "@auditrail/domain/generated/note";
import { noteTable } from "@auditrail/db/schema";
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../plugins/database.js";
import type { NoteRepo } from "./repo.js";
export function createPostgresNoteRepo(db: AppDatabase): NoteRepo {
  return {
    async archive(input) {
      const [record] = await db.update(noteTable).set({
        archivedAt: new Date(),
        updatedAt: new Date()
      }).where(
        and(
          eq(noteTable.id, input.id),
          eq(noteTable.organizationId, input.organizationId),
          isNull(noteTable.archivedAt)
        )
      ).returning();

      return record ? toNoteRecord(record) : undefined;
    },
    async create(input) {
      const [record] = await db.insert(noteTable).values({
        organizationId: input.organizationId,
        body: input.data.body,
        dealId: input.data.dealId,
      }).returning();
      return toNoteRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(noteTable).where(
        and(
          eq(noteTable.id, input.id),
          eq(noteTable.organizationId, input.organizationId)
        )
      ).limit(1);
      return record ? toNoteRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const sortBy = input.filters.sortBy ?? "createdAt";
      const sortDirection = input.filters.sortDirection ?? "desc";
      const archived = input.filters.archived ?? "exclude";
      const [cursorRecord] = input.filters.cursor ? await db.select({
        sortValue: resolveGeneratedListSortColumn(sortBy),
        id: noteTable.id
      }).from(noteTable).where(
        and(
          eq(noteTable.id, input.filters.cursor),
          eq(noteTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      if (input.filters.cursor && !cursorRecord) {
        throw new Error("invalid_cursor");
      }
      const records = await db.select().from(noteTable).where(
        and(
          eq(noteTable.organizationId, input.organizationId),
          archived === "only"
            ? isNotNull(noteTable.archivedAt)
            : archived === "include"
              ? undefined
              : isNull(noteTable.archivedAt),
          input.filters.dealId !== undefined ? eq(noteTable.dealId, input.filters.dealId) : undefined,
          pattern
            ? or(
      ilike(sql`cast(${noteTable.body} as text)`, pattern)
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
        items: pageRecords.map(toNoteRecord),
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null
        }
      };
    },
    async unarchive(input) {
      const [record] = await db.update(noteTable).set({
        archivedAt: null,
        updatedAt: new Date()
      }).where(
        and(
          eq(noteTable.id, input.id),
          eq(noteTable.organizationId, input.organizationId),
          isNotNull(noteTable.archivedAt)
        )
      ).returning();

      return record ? toNoteRecord(record) : undefined;
    },
    async update(input) {
      const [record] = await db.update(noteTable).set({
        body: input.data.body !== undefined ? input.data.body : undefined,
        dealId: input.data.dealId !== undefined ? input.data.dealId : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(noteTable.id, input.id),
          eq(noteTable.organizationId, input.organizationId)
        )
      ).returning();
      return record ? toNoteRecord(record) : undefined;
    }
  };
}
function resolveGeneratedListSortColumn(
  sortBy: ListNotesInput["sortBy"] extends infer T ? NonNullable<T> : never
) {
  switch (sortBy) {
    case "createdAt":
      return noteTable.createdAt;
    case "updatedAt":
      return noteTable.updatedAt;
    default:
      return noteTable.createdAt;
  }
}
function resolveGeneratedListOrder(
  sortBy: ListNotesInput["sortBy"] extends infer T ? NonNullable<T> : never,
  sortDirection: "asc" | "desc"
) {
  const sortColumn = resolveGeneratedListSortColumn(sortBy);
  return sortDirection === "asc"
    ? [asc(sortColumn), asc(noteTable.id)] as const
    : [desc(sortColumn), desc(noteTable.id)] as const;
}
function buildGeneratedListCursorClause(input: {
  cursorRecord: {
    id: string;
    sortValue: unknown;
  };
  sortBy: ListNotesInput["sortBy"] extends infer T ? NonNullable<T> : never;
  sortDirection: "asc" | "desc";
}) {
  switch (input.sortBy) {
    case "createdAt":
      return input.sortDirection === "asc"
        ? or(
            gt(noteTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(noteTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              gt(noteTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(noteTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(noteTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              lt(noteTable.id, input.cursorRecord.id)
            )
          );
    case "updatedAt":
      return input.sortDirection === "asc"
        ? or(
            gt(noteTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(noteTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              gt(noteTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(noteTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(noteTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              lt(noteTable.id, input.cursorRecord.id)
            )
          );
    default:
      return undefined;
  }
}
function toNoteRecord(
  record: typeof noteTable.$inferSelect
): NoteRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    body: record.body,
    dealId: record.dealId,
    archivedAt: record.archivedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
