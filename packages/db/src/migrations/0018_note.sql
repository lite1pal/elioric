create table if not exists "notes" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "body" text not null,
  "deal_id" uuid references "deals"("id") not null,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "notes_organization_id_idx"
  on "notes" ("organization_id");
--> statement-breakpoint
create index if not exists "notes_deal_id_idx"
  on "notes" ("deal_id");