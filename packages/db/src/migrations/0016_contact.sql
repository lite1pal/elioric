create table if not exists "contacts" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "name" text not null,
  "email" text,
  "title" text,
  "company_id" uuid references "companies"("id") not null,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "contacts_organization_id_idx"
  on "contacts" ("organization_id");
--> statement-breakpoint
create index if not exists "contacts_company_id_idx"
  on "contacts" ("company_id");