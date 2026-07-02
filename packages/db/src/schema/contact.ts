import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companyTable } from "./company.js";
import { organizations } from "./identity.js";

export const contactTable = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email"),
    title: text("title"),
    companyId: uuid("company_id").notNull().references(() => companyTable.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("contacts_organization_id_idx").on(table.organizationId),
    index("contacts_company_id_idx").on(table.companyId)
  ]
);
