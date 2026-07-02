import type { ContactRecord } from "../domain/schemas";

import { ContactEmptyState } from "./contact-empty-state";
import { ContactTable } from "./contact-table";

type ContactRelationPresentation = {
  href?: string;
  label: string;
};

type ContactRelationPresentations = Record<
  string,
  Partial<Record<string, ContactRelationPresentation>>
>;

export function ContactScreen(input: {
  items: readonly ContactRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: ContactRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <ContactEmptyState />;
  }

  return (
    <ContactTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      relationPresentations={input.relationPresentations}
      resourceQuery={input.resourceQuery}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
