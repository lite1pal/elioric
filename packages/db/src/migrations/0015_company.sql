create table if not exists "companies" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "name" text not null,
  "domain" text,
  "status" text not null,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "companies_organization_id_idx"
  on "companies" ("organization_id");