import type { DealRecord } from "../domain/schemas.js";

import { DealEmptyState } from "./deal-empty-state.js";
import { DealTable } from "./deal-table.js";

type DealRelationPresentation = {
  href?: string;
  label: string;
};

type DealRelationPresentations = Record<
  string,
  Partial<Record<string, DealRelationPresentation>>
>;

export function DealScreen(input: {
  items: readonly DealRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: DealRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <DealEmptyState />;
  }

  return (
    <DealTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      relationPresentations={input.relationPresentations}
      resourceQuery={input.resourceQuery}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
