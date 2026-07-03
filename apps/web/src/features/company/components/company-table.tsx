import type { CompanyRecord } from "../domain/schemas.js";

type CompanyRelationPresentation = {
  href?: string;
  label: string;
};

type CompanyRelationPresentations = Record<
  string,
  Partial<Record<string, CompanyRelationPresentation>>
>;

export function CompanyTable(input: {
  items: readonly CompanyRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: CompanyRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Domain</th>
          <th>Status</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.name?.toString()}</td>
            <td>{item.domain?.toString()}</td>
            <td>{item.status?.toString()}</td>
            {showActions ? (
              <td>
                <div className="flex gap-3">
                  <a href={buildResourceHref(input, item.id)}>View</a>
                  <a href={buildEditHref(input, item.id)}>Edit</a>
                </div>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderRelationAwareValue(
  recordId: string,
  fieldName: string,
  value: unknown,
  relationPresentations?: CompanyRelationPresentations
) {
  const relation = relationPresentations?.[recordId]?.[fieldName];

  if (relation?.href) {
    return <a href={relation.href}>{relation.label}</a>;
  }

  if (relation) {
    return relation.label;
  }

  return value?.toString() ?? "";
}

function buildResourceHref(
  input: Pick<CompanyTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
  id: string
) {
  if (input.resourceQuery) {
    return `${input.resourceBasePath}/${id}?${input.resourceQuery}`;
  }

  const query = new URLSearchParams();

  if (input.organizationId) {
    query.set("organizationId", input.organizationId);
  }

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  return `${input.resourceBasePath}/${id}?${query.toString()}`;
}

function buildEditHref(
  input: Pick<CompanyTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
  id: string
) {
  if (input.resourceQuery) {
    return `${input.resourceBasePath}/${id}/edit?${input.resourceQuery}`;
  }

  const query = new URLSearchParams();

  if (input.organizationId) {
    query.set("organizationId", input.organizationId);
  }

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  return `${input.resourceBasePath}/${id}/edit?${query.toString()}`;
}

interface CompanyTableParameters {
  items: readonly CompanyRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: CompanyRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}
