# Company Resource Preview

This preview was generated from a validated `company` resource spec.

## Supported assumptions

- ownership: `organization`
- CRUD: `list`, `create`, `read`, `update`
- delete generation: disabled for this resource spec
- output mode: preview-only under `.generated/` or `tmp/`

## Fields

- `name`: `string` required
- `domain`: `string`
- `status`: `enum` required

## Generated file groups

- `packages/domain/src/generated/company/index.ts`
- `packages/db/src/schema/company.ts`
- `apps/api/src/modules/generated/company/routes.ts`
- `apps/api/src/modules/generated/company/service.ts`
- `apps/api/src/modules/generated/company/repo.ts`
- `apps/api/src/modules/generated/company/postgres-repo.ts`
- `apps/api/src/modules/generated/company/__tests__/routes.test.ts`
- `apps/api/src/modules/generated/company/__tests__/routes.integration.test.ts`
- `apps/api/src/modules/generated/company/__tests__/service.test.ts`
- `apps/web/src/features/company/index.ts`
- `apps/web/src/features/company/api/company-client.ts`
- `apps/web/src/features/company/components/company-screen.tsx`
- `apps/web/src/features/company/components/company-form.tsx`
- `apps/web/src/features/company/components/company-table.tsx`
- `apps/web/src/features/company/components/company-empty-state.tsx`
- `apps/web/src/features/company/domain/schemas.ts`
- `apps/web/src/features/company/__tests__/company-screen.test.tsx`
- `apps/web/src/features/company/__tests__/company-client.test.ts`
- `docs/resources/company.md`
- `docs/resources/company-customization.md`

## Manual follow-up

- add domain and DB barrel exports if this preview is promoted into real repo source
- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly
- write a real migration after picking the next migration identifier
