import type { CompanyRecord, ListCompaniesInput, ListCompaniesResponse } from "@auditrail/domain/generated/company";
import { companyTable } from "@auditrail/db/schema";
import { and, asc, desc, eq, gt, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { AppDatabase } from "../../../plugins/database.js";
import type { CompanyRepo } from "./repo.js";
export function createPostgresCompanyRepo(db: AppDatabase): CompanyRepo {
  return {
    async archive(input) {
      const [record] = await db.update(companyTable).set({
        archivedAt: new Date(),
        updatedAt: new Date()
      }).where(
        and(
          eq(companyTable.id, input.id),
          eq(companyTable.organizationId, input.organizationId),
          isNull(companyTable.archivedAt)
        )
      ).returning();

      return record ? toCompanyRecord(record) : undefined;
    },
    async create(input) {
      const [record] = await db.insert(companyTable).values({
        organizationId: input.organizationId,
        name: input.data.name,
        domain: input.data.domain,
        status: input.data.status,
      }).returning();
      return toCompanyRecord(record);
    },
    async findById(input) {
      const [record] = await db.select().from(companyTable).where(
        and(
          eq(companyTable.id, input.id),
          eq(companyTable.organizationId, input.organizationId)
        )
      ).limit(1);
      return record ? toCompanyRecord(record) : undefined;
    },
    async list(input) {
      const limit = Math.min(input.filters.limit ?? 50, 100);
      const pattern = input.filters.query ? `%${input.filters.query}%` : undefined;
      const sortBy = input.filters.sortBy ?? "createdAt";
      const sortDirection = input.filters.sortDirection ?? "desc";
      const archived = input.filters.archived ?? "exclude";
      const [cursorRecord] = input.filters.cursor ? await db.select({
        sortValue: resolveGeneratedListSortColumn(sortBy),
        id: companyTable.id
      }).from(companyTable).where(
        and(
          eq(companyTable.id, input.filters.cursor),
          eq(companyTable.organizationId, input.organizationId)
        )
      ).limit(1) : [];
      if (input.filters.cursor && !cursorRecord) {
        throw new Error("invalid_cursor");
      }
      const records = await db.select().from(companyTable).where(
        and(
          eq(companyTable.organizationId, input.organizationId),
          archived === "only"
            ? isNotNull(companyTable.archivedAt)
            : archived === "include"
              ? undefined
              : isNull(companyTable.archivedAt),
          input.filters.status !== undefined ? eq(companyTable.status, input.filters.status) : undefined,
          pattern
            ? or(
      ilike(sql`cast(${companyTable.name} as text)`, pattern),
      ilike(sql`cast(${companyTable.domain} as text)`, pattern)
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
        items: pageRecords.map(toCompanyRecord),
        pageInfo: {
          hasMore,
          nextCursor: hasMore ? pageRecords.at(-1)?.id ?? null : null
        }
      };
    },
    async unarchive(input) {
      const [record] = await db.update(companyTable).set({
        archivedAt: null,
        updatedAt: new Date()
      }).where(
        and(
          eq(companyTable.id, input.id),
          eq(companyTable.organizationId, input.organizationId),
          isNotNull(companyTable.archivedAt)
        )
      ).returning();

      return record ? toCompanyRecord(record) : undefined;
    },
    async update(input) {
      const [record] = await db.update(companyTable).set({
        name: input.data.name !== undefined ? input.data.name : undefined,
        domain: input.data.domain !== undefined ? input.data.domain : undefined,
        status: input.data.status !== undefined ? input.data.status : undefined,
        updatedAt: new Date()
      }).where(
        and(
          eq(companyTable.id, input.id),
          eq(companyTable.organizationId, input.organizationId)
        )
      ).returning();
      return record ? toCompanyRecord(record) : undefined;
    }
  };
}
function resolveGeneratedListSortColumn(
  sortBy: ListCompaniesInput["sortBy"] extends infer T ? NonNullable<T> : never
) {
  switch (sortBy) {
    case "createdAt":
      return companyTable.createdAt;
    case "updatedAt":
      return companyTable.updatedAt;
    case "name":
      return companyTable.name;
    default:
      return companyTable.createdAt;
  }
}
function resolveGeneratedListOrder(
  sortBy: ListCompaniesInput["sortBy"] extends infer T ? NonNullable<T> : never,
  sortDirection: "asc" | "desc"
) {
  const sortColumn = resolveGeneratedListSortColumn(sortBy);
  return sortDirection === "asc"
    ? [asc(sortColumn), asc(companyTable.id)] as const
    : [desc(sortColumn), desc(companyTable.id)] as const;
}
function buildGeneratedListCursorClause(input: {
  cursorRecord: {
    id: string;
    sortValue: unknown;
  };
  sortBy: ListCompaniesInput["sortBy"] extends infer T ? NonNullable<T> : never;
  sortDirection: "asc" | "desc";
}) {
  switch (input.sortBy) {
    case "createdAt":
      return input.sortDirection === "asc"
        ? or(
            gt(companyTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(companyTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              gt(companyTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(companyTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(companyTable.createdAt, new Date(String(input.cursorRecord.sortValue))),
              lt(companyTable.id, input.cursorRecord.id)
            )
          );
    case "updatedAt":
      return input.sortDirection === "asc"
        ? or(
            gt(companyTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(companyTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              gt(companyTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(companyTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
            and(
              eq(companyTable.updatedAt, new Date(String(input.cursorRecord.sortValue))),
              lt(companyTable.id, input.cursorRecord.id)
            )
          );
    case "name":
      return input.sortDirection === "asc"
        ? or(
            gt(companyTable.name, input.cursorRecord.sortValue as string),
            and(
              eq(companyTable.name, input.cursorRecord.sortValue as string),
              gt(companyTable.id, input.cursorRecord.id)
            )
          )
        : or(
            lt(companyTable.name, input.cursorRecord.sortValue as string),
            and(
              eq(companyTable.name, input.cursorRecord.sortValue as string),
              lt(companyTable.id, input.cursorRecord.id)
            )
          );
    default:
      return undefined;
  }
}
function toCompanyRecord(
  record: typeof companyTable.$inferSelect
): CompanyRecord {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    domain: record.domain ?? undefined,
    status: record.status as CompanyRecord["status"],
    archivedAt: record.archivedAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
