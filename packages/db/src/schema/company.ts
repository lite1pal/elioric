import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "./identity.js";

export const companyTable = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    domain: text("domain"),
    status: text("status").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("companies_organization_id_idx").on(table.organizationId)
  ]
);
