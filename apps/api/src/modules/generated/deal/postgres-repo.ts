import type { DealRecord, ListDealsInput, ListDealsResponse } from "@auditrail/domain/generated/deal";
import { dealTable } from "@auditrail/db/schema";
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../plugins/database.js";
import type { DealRepo } from "./repo.js";
export function createPostgresDealRepo(db: AppDatabase): DealRepo {
  return {
    async archive(input) {
      const [record] = await db.update(dealTable).set({
        archivedAt: new Date(),
        updatedAt: new Date()
      }).where(
        and(
          eq(dealTable.id, input.id),
          eq(dealTable.organizationId, input.organizationId),
          isNull(dealTable.archivedAt)
        )
      ).returning();

      return record ? toDealRecord(record) : undefined;
    },
    async create(input) {
      const [record] = await db.insert(dealTable).values({
        organizationId: input.organizationId,
        name: input.data.name,
        stage: input.data.stage,
        amount: input.data.amount,
        companyId: input.data.companyId,
        ownerId: input.data.ownerId,
      }).returning();
      return toDealRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(dealTable).where(
        and(
          eq(dealTable.id, input.id),
          eq(dealTable.organizationId, input.organizationId)
        )
      ).limit(1);
      return record ? toDealRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const sortBy = input.filters.sortBy ?? "createdAt";
      const sortDirection = input.filters.sortDirection ?? "desc";
      const archived = input.filters.archived ?? "exclude";
      const [cursorRecord] = input.filters.cursor ? await db.select({
        sortValue: resolveGeneratedListSortColumn(sortBy),
        id: dealTable.id
      }).from(dealTable).where(
        and(
          eq(dealTable.id, input.filters.cursor),
          eq(dealTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      if (input.filters.cursor && !cursorRecord) {
        throw new Error("invalid_cursor");
      }
      const records = await db.select().from(dealTable).where(
        and(
          eq(dealTable.organizationId, input.organizationId),
          archived === "only"
            ? isNotNull(dealTable.archivedAt)
            : archived === "include"
              ? undefined
              : isNull(dealTable.archivedAt),
          input.filters.stage !== undefined ? eq(dealTable.stage, input.filters.stage) : undefined,
          input.filters.companyId !== undefined ? eq(dealTable.companyId, input.filters.companyId) : undefined,
          input.filters.ownerId !== undefined ? eq(dealTable.ownerId, input.filters.ownerId) : undefined,
          pattern
            ? or(
      ilike(sql`cast(${dealTable.name} as text)`, pattern)
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
        items: pageRecords.map(toDealRecord),
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null
        }
      };
    },
    async unarchive(input) {
      const [record] = await db.update(dealTable).set({
        archivedAt: null,
        updatedAt: new Date()
      }).where(
        and(
          eq(dealTable.id, input.id),
          eq(dealTable.organizationId, input.organizationId),
          isNotNull(dealTable.archivedAt)
        )
      ).returning();

      return record ? toDealRecord(record) : undefined;
    },
    async update(input) {
      const [record] = await db.update(dealTable).set({
        name: input.data.name !== undefined ? input.data.name : undefined,
        stage: input.data.stage !== undefined ? input.data.stage : undefined,
        amount: input.data.amount !== undefined ? input.data.amount : undefined,
        companyId: input.data.companyId !== undefined ? input.data.companyId : undefined,
        ownerId: input.data.ownerId !== undefined ? input.data.ownerId : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(dealTable.id, input.id),
          eq(dealTable.organizationId, input.organizationId)
        )
      ).returning();
      return record ? toDealRecord(record) : undefined;
    }
  };
}
function resolveGeneratedListSortColumn(
  sortBy: ListDealsInput["sortBy"] extends infer T ? NonNullable<T> : never
) {
  switch (sortBy) {
    case "createdAt":
      return dealTable.createdAt;
    case "updatedAt":
      return dealTable.updatedAt;
    case "name":
      return dealTable.name;
    default:
      return dealTable.createdAt;
  }
}
function resolveGeneratedListOrder(
  sortBy: ListDealsInput["sortBy"] extends infer T ? NonNullable<T> : never,
  sortDirection: "asc" | "desc"
) {
  const sortColumn = resolveGeneratedListSortColumn(sortBy);
  return sortDirection === "asc"
    ? [asc(sortColumn), asc(dealTable.id)] as const
    : [desc(sortColumn), desc(dealTable.id)] as const;
}
function buildGeneratedListCursorClause(input: {
  cursorRecord: {
    id: string;
    sortValue: unknown;
  };
  sortBy: ListDealsInput["sortBy"] extends infer T ? NonNullable<T> : never;
  sortDirection: "asc" | "desc";
}) {
  switch (input.sortBy) {
    case "createdAt":
      return input.sortDirection === "asc"
        ? or(
            gt(dealTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(dealTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              gt(dealTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(dealTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(dealTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              lt(dealTable.id, input.cursorRecord.id)
            )
          );
    case "updatedAt":
      return input.sortDirection === "asc"
        ? or(
            gt(dealTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(dealTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              gt(dealTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(dealTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(dealTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              lt(dealTable.id, input.cursorRecord.id)
            )
          );
    case "name":
      return input.sortDirection === "asc"
        ? or(
            gt(dealTable.name, input.cursorRecord.sortValue as string),
            and(
              eq(dealTable.name, input.cursorRecord.sortValue as string),
              gt(dealTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(dealTable.name, input.cursorRecord.sortValue as string),
            and(
              eq(dealTable.name, input.cursorRecord.sortValue as string),
              lt(dealTable.id, input.cursorRecord.id)
            )
          );
    default:
      return undefined;
  }
}
function toDealRecord(
  record: typeof dealTable.$inferSelect
): DealRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    stage: record.stage as DealRecord["stage"],
    amount: record.amount ?? undefined,
    companyId: record.companyId,
    ownerId: record.ownerId ?? undefined,
    archivedAt: record.archivedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
