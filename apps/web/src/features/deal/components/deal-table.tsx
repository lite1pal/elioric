import type { DealRecord } from "../domain/schemas";

type DealRelationPresentation = {
  href?: string;
  label: string;
};

type DealRelationPresentations = Record<
  string,
  Partial<Record<string, DealRelationPresentation>>
>;

export function DealTable(input: {
  items: readonly DealRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: DealRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Stage</th>
          <th>Amount</th>
          <th>Company Id</th>
          <th>Owner Id</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.name?.toString()}</td>
            <td>{item.stage?.toString()}</td>
            <td>{item.amount?.toString()}</td>
            <td>{renderRelationAwareValue(item.id, "companyId", item.companyId, input.relationPresentations)}</td>
            <td>{renderRelationAwareValue(item.id, "ownerId", item.ownerId, input.relationPresentations)}</td>
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
  relationPresentations?: DealRelationPresentations
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
  input: Pick<DealTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
  id: string
) {
  if (input.resourceQuery) {
    return `${input.resourceBasePath}/${id}?${input.resourceQuery}`;
  }

  const query = new URLSearchParams({
    organizationId: input.organizationId ?? ""
  });

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  return `${input.resourceBasePath}/${id}?${query.toString()}`;
}

function buildEditHref(
  input: Pick<DealTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
  id: string
) {
  if (input.resourceQuery) {
    return `${input.resourceBasePath}/${id}/edit?${input.resourceQuery}`;
  }

  const query = new URLSearchParams({
    organizationId: input.organizationId ?? ""
  });

  if (input.projectId) {
    query.set("projectId", input.projectId);
  }

  return `${input.resourceBasePath}/${id}/edit?${query.toString()}`;
}

interface DealTableParameters {
  items: readonly DealRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: DealRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}
