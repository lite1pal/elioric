import type { NoteRecord } from "../domain/schemas";

import { NoteEmptyState } from "./note-empty-state";
import { NoteTable } from "./note-table";

type NoteRelationPresentation = {
  href?: string;
  label: string;
};

type NoteRelationPresentations = Record<
  string,
  Partial<Record<string, NoteRelationPresentation>>
>;

export function NoteScreen(input: {
  items: readonly NoteRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: NoteRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <NoteEmptyState />;
  }

  return (
    <NoteTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      relationPresentations={input.relationPresentations}
      resourceQuery={input.resourceQuery}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
