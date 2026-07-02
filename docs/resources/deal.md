# Deal Resource Preview

This preview was generated from a validated `deal` resource spec.

## Supported assumptions

- ownership: `organization`
- CRUD: `list`, `create`, `read`, `update`
- delete generation: disabled for this resource spec
- output mode: preview-only under `.generated/` or `tmp/`

## Fields

- `name`: `string` required
- `stage`: `enum` required
- `amount`: `string`
- `companyId`: `uuid` required
- `ownerId`: `uuid`

## Generated file groups

- `packages/domain/src/generated/deal/index.ts`
- `packages/db/src/schema/deal.ts`
- `apps/api/src/modules/generated/deal/routes.ts`
- `apps/api/src/modules/generated/deal/service.ts`
- `apps/api/src/modules/generated/deal/repo.ts`
- `apps/api/src/modules/generated/deal/postgres-repo.ts`
- `apps/api/src/modules/generated/deal/__tests__/routes.test.ts`
- `apps/api/src/modules/generated/deal/__tests__/routes.integration.test.ts`
- `apps/api/src/modules/generated/deal/__tests__/service.test.ts`
- `apps/web/src/features/deal/index.ts`
- `apps/web/src/features/deal/api/deal-client.ts`
- `apps/web/src/features/deal/components/deal-screen.tsx`
- `apps/web/src/features/deal/components/deal-form.tsx`
- `apps/web/src/features/deal/components/deal-table.tsx`
- `apps/web/src/features/deal/components/deal-empty-state.tsx`
- `apps/web/src/features/deal/domain/schemas.ts`
- `apps/web/src/features/deal/__tests__/deal-screen.test.tsx`
- `apps/web/src/features/deal/__tests__/deal-client.test.ts`
- `docs/resources/deal.md`
- `docs/resources/deal-customization.md`

## Manual follow-up

- add domain and DB barrel exports if this preview is promoted into real repo source
- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly
- write a real migration after picking the next migration identifier
