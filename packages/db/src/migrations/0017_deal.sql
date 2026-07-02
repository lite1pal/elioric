create table if not exists "deals" (
  "id" uuid primary key default gen_random_uuid() not null,
  "organization_id" uuid not null references "organizations"("id"),
  "name" text not null,
  "stage" text not null,
  "amount" text,
  "company_id" uuid references "companies"("id") not null,
  "owner_id" uuid references "users"("id"),
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
--> statement-breakpoint
create index if not exists "deals_organization_id_idx"
  on "deals" ("organization_id");
--> statement-breakpoint
create index if not exists "deals_company_id_idx"
  on "deals" ("company_id");
--> statement-breakpoint
create index if not exists "deals_owner_id_idx"
  on "deals" ("owner_id");