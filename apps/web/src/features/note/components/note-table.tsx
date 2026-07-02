import type { NoteRecord } from "../domain/schemas";

type NoteRelationPresentation = {
  href?: string;
  label: string;
};

type NoteRelationPresentations = Record<
  string,
  Partial<Record<string, NoteRelationPresentation>>
>;

export function NoteTable(input: {
  items: readonly NoteRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: NoteRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Body</th>
          <th>Deal Id</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.body?.toString()}</td>
            <td>{renderRelationAwareValue(item.id, "dealId", item.dealId, input.relationPresentations)}</td>
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
  relationPresentations?: NoteRelationPresentations
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
  input: Pick<NoteTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
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
  input: Pick<NoteTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
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

interface NoteTableParameters {
  items: readonly NoteRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: NoteRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}
