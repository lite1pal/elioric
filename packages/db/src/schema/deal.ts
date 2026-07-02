import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companyTable } from "./company.js";
import { organizations, users } from "./identity.js";

export const dealTable = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    stage: text("stage").notNull(),
    amount: text("amount"),
    companyId: uuid("company_id").notNull().references(() => companyTable.id),
    ownerId: uuid("owner_id").references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("deals_organization_id_idx").on(table.organizationId),
    index("deals_company_id_idx").on(table.companyId),
    index("deals_owner_id_idx").on(table.ownerId)
  ]
);
