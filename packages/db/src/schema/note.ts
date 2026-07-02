import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { dealTable } from "./deal.js";
import { organizations } from "./identity.js";

export const noteTable = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    body: text("body").notNull(),
    dealId: uuid("deal_id").notNull().references(() => dealTable.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("notes_organization_id_idx").on(table.organizationId),
    index("notes_deal_id_idx").on(table.dealId)
  ]
);
