import type { CompanyRecord } from "../domain/schemas.js";

import { CompanyEmptyState } from "./company-empty-state.js";
import { CompanyTable } from "./company-table.js";

type CompanyRelationPresentation = {
  href?: string;
  label: string;
};

type CompanyRelationPresentations = Record<
  string,
  Partial<Record<string, CompanyRelationPresentation>>
>;

export function CompanyScreen(input: {
  items: readonly CompanyRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: CompanyRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <CompanyEmptyState />;
  }

  return (
    <CompanyTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      relationPresentations={input.relationPresentations}
      resourceQuery={input.resourceQuery}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
