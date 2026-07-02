import type { CustomerRecord } from "../domain/schemas";

import { CustomerEmptyState } from "./customer-empty-state";
import { CustomerTable } from "./customer-table";

type CustomerRelationPresentation = {
  href?: string;
  label: string;
};

type CustomerRelationPresentations = Record<
  string,
  Partial<Record<string, CustomerRelationPresentation>>
>;

export function CustomerScreen(input: {
  items: readonly CustomerRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: CustomerRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <CustomerEmptyState />;
  }

  return (
    <CustomerTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      relationPresentations={input.relationPresentations}
      resourceQuery={input.resourceQuery}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
