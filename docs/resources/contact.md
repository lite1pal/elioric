# Contact Resource Preview

This preview was generated from a validated `contact` resource spec.

## Supported assumptions

- ownership: `organization`
- CRUD: `list`, `create`, `read`, `update`
- delete generation: disabled for this resource spec
- output mode: preview-only under `.generated/` or `tmp/`

## Fields

- `name`: `string` required
- `email`: `email`
- `title`: `string`
- `companyId`: `uuid` required

## Generated file groups

- `packages/domain/src/generated/contact/index.ts`
- `packages/db/src/schema/contact.ts`
- `apps/api/src/modules/generated/contact/routes.ts`
- `apps/api/src/modules/generated/contact/service.ts`
- `apps/api/src/modules/generated/contact/repo.ts`
- `apps/api/src/modules/generated/contact/postgres-repo.ts`
- `apps/api/src/modules/generated/contact/__tests__/routes.test.ts`
- `apps/api/src/modules/generated/contact/__tests__/routes.integration.test.ts`
- `apps/api/src/modules/generated/contact/__tests__/service.test.ts`
- `apps/web/src/features/contact/index.ts`
- `apps/web/src/features/contact/api/contact-client.ts`
- `apps/web/src/features/contact/components/contact-screen.tsx`
- `apps/web/src/features/contact/components/contact-form.tsx`
- `apps/web/src/features/contact/components/contact-table.tsx`
- `apps/web/src/features/contact/components/contact-empty-state.tsx`
- `apps/web/src/features/contact/domain/schemas.ts`
- `apps/web/src/features/contact/__tests__/contact-screen.test.tsx`
- `apps/web/src/features/contact/__tests__/contact-client.test.ts`
- `docs/resources/contact.md`
- `docs/resources/contact-customization.md`

## Manual follow-up

- add domain and DB barrel exports if this preview is promoted into real repo source
- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly
- write a real migration after picking the next migration identifier
