# Note Resource Preview

This preview was generated from a validated `note` resource spec.

## Supported assumptions

- ownership: `organization`
- CRUD: `list`, `create`, `read`, `update`
- delete generation: disabled for this resource spec
- output mode: preview-only under `.generated/` or `tmp/`

## Fields

- `body`: `text` required
- `dealId`: `uuid` required

## Generated file groups

- `packages/domain/src/generated/note/index.ts`
- `packages/db/src/schema/note.ts`
- `apps/api/src/modules/generated/note/routes.ts`
- `apps/api/src/modules/generated/note/service.ts`
- `apps/api/src/modules/generated/note/repo.ts`
- `apps/api/src/modules/generated/note/postgres-repo.ts`
- `apps/api/src/modules/generated/note/__tests__/routes.test.ts`
- `apps/api/src/modules/generated/note/__tests__/routes.integration.test.ts`
- `apps/api/src/modules/generated/note/__tests__/service.test.ts`
- `apps/web/src/features/note/index.ts`
- `apps/web/src/features/note/api/note-client.ts`
- `apps/web/src/features/note/components/note-screen.tsx`
- `apps/web/src/features/note/components/note-form.tsx`
- `apps/web/src/features/note/components/note-table.tsx`
- `apps/web/src/features/note/components/note-empty-state.tsx`
- `apps/web/src/features/note/domain/schemas.ts`
- `apps/web/src/features/note/__tests__/note-screen.test.tsx`
- `apps/web/src/features/note/__tests__/note-client.test.ts`
- `docs/resources/note.md`
- `docs/resources/note-customization.md`

## Manual follow-up

- add domain and DB barrel exports if this preview is promoted into real repo source
- register routes intentionally instead of copying generated preview files into `apps/api/src/app.ts` blindly
- write a real migration after picking the next migration identifier
