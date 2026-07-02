import type { TodoRecord } from "../domain/schemas.js";

type TodoRelationPresentation = {
  href?: string;
  label: string;
};

type TodoRelationPresentations = Record<
  string,
  Partial<Record<string, TodoRelationPresentation>>
>;

export function TodoTable(input: {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: TodoRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Details</th>
          <th>Status</th>
          <th>Due At</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.title?.toString()}</td>
            <td>{item.details?.toString()}</td>
            <td>{item.status?.toString()}</td>
            <td>{item.dueAt?.toString()}</td>
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
  relationPresentations?: TodoRelationPresentations
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
  input: Pick<TodoTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
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
  input: Pick<TodoTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
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

interface TodoTableParameters {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: TodoRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}
