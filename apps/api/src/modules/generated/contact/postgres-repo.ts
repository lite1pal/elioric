import type { ContactRecord, ListContactsInput, ListContactsResponse } from "@auditrail/domain/generated/contact";
import { contactTable } from "@auditrail/db/schema";
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../plugins/database.js";
import type { ContactRepo } from "./repo.js";
export function createPostgresContactRepo(db: AppDatabase): ContactRepo {
  return {
    async archive(input) {
      const [record] = await db.update(contactTable).set({
        archivedAt: new Date(),
        updatedAt: new Date()
      }).where(
        and(
          eq(contactTable.id, input.id),
          eq(contactTable.organizationId, input.organizationId),
          isNull(contactTable.archivedAt)
        )
      ).returning();

      return record ? toContactRecord(record) : undefined;
    },
    async create(input) {
      const [record] = await db.insert(contactTable).values({
        organizationId: input.organizationId,
        name: input.data.name,
        email: input.data.email,
        title: input.data.title,
        companyId: input.data.companyId,
      }).returning();
      return toContactRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(contactTable).where(
        and(
          eq(contactTable.id, input.id),
          eq(contactTable.organizationId, input.organizationId)
        )
      ).limit(1);
      return record ? toContactRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const sortBy = input.filters.sortBy ?? "createdAt";
      const sortDirection = input.filters.sortDirection ?? "desc";
      const archived = input.filters.archived ?? "exclude";
      const [cursorRecord] = input.filters.cursor ? await db.select({
        sortValue: resolveGeneratedListSortColumn(sortBy),
        id: contactTable.id
      }).from(contactTable).where(
        and(
          eq(contactTable.id, input.filters.cursor),
          eq(contactTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      if (input.filters.cursor && !cursorRecord) {
        throw new Error("invalid_cursor");
      }
      const records = await db.select().from(contactTable).where(
        and(
          eq(contactTable.organizationId, input.organizationId),
          archived === "only"
            ? isNotNull(contactTable.archivedAt)
            : archived === "include"
              ? undefined
              : isNull(contactTable.archivedAt),
          input.filters.companyId !== undefined ? eq(contactTable.companyId, input.filters.companyId) : undefined,
          pattern
            ? or(
      ilike(sql`cast(${contactTable.name} as text)`, pattern),
      ilike(sql`cast(${contactTable.email} as text)`, pattern),
      ilike(sql`cast(${contactTable.title} as text)`, pattern)
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
        items: pageRecords.map(toContactRecord),
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null
        }
      };
    },
    async unarchive(input) {
      const [record] = await db.update(contactTable).set({
        archivedAt: null,
        updatedAt: new Date()
      }).where(
        and(
          eq(contactTable.id, input.id),
          eq(contactTable.organizationId, input.organizationId),
          isNotNull(contactTable.archivedAt)
        )
      ).returning();

      return record ? toContactRecord(record) : undefined;
    },
    async update(input) {
      const [record] = await db.update(contactTable).set({
        name: input.data.name !== undefined ? input.data.name : undefined,
        email: input.data.email !== undefined ? input.data.email : undefined,
        title: input.data.title !== undefined ? input.data.title : undefined,
        companyId: input.data.companyId !== undefined ? input.data.companyId : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(contactTable.id, input.id),
          eq(contactTable.organizationId, input.organizationId)
        )
      ).returning();
      return record ? toContactRecord(record) : undefined;
    }
  };
}
function resolveGeneratedListSortColumn(
  sortBy: ListContactsInput["sortBy"] extends infer T ? NonNullable<T> : never
) {
  switch (sortBy) {
    case "createdAt":
      return contactTable.createdAt;
    case "updatedAt":
      return contactTable.updatedAt;
    case "name":
      return contactTable.name;
    default:
      return contactTable.createdAt;
  }
}
function resolveGeneratedListOrder(
  sortBy: ListContactsInput["sortBy"] extends infer T ? NonNullable<T> : never,
  sortDirection: "asc" | "desc"
) {
  const sortColumn = resolveGeneratedListSortColumn(sortBy);
  return sortDirection === "asc"
    ? [asc(sortColumn), asc(contactTable.id)] as const
    : [desc(sortColumn), desc(contactTable.id)] as const;
}
function buildGeneratedListCursorClause(input: {
  cursorRecord: {
    id: string;
    sortValue: unknown;
  };
  sortBy: ListContactsInput["sortBy"] extends infer T ? NonNullable<T> : never;
  sortDirection: "asc" | "desc";
}) {
  switch (input.sortBy) {
    case "createdAt":
      return input.sortDirection === "asc"
        ? or(
            gt(contactTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(contactTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              gt(contactTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(contactTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(contactTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              lt(contactTable.id, input.cursorRecord.id)
            )
          );
    case "updatedAt":
      return input.sortDirection === "asc"
        ? or(
            gt(contactTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(contactTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              gt(contactTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(contactTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(contactTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              lt(contactTable.id, input.cursorRecord.id)
            )
          );
    case "name":
      return input.sortDirection === "asc"
        ? or(
            gt(contactTable.name, input.cursorRecord.sortValue as string),
            and(
              eq(contactTable.name, input.cursorRecord.sortValue as string),
              gt(contactTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(contactTable.name, input.cursorRecord.sortValue as string),
            and(
              eq(contactTable.name, input.cursorRecord.sortValue as string),
              lt(contactTable.id, input.cursorRecord.id)
            )
          );
    default:
      return undefined;
  }
}
function toContactRecord(
  record: typeof contactTable.$inferSelect
): ContactRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    email: record.email ?? undefined,
    title: record.title ?? undefined,
    companyId: record.companyId,
    archivedAt: record.archivedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
