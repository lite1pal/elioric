import type { TaskRecord } from "../domain/schemas.js";

type TaskRelationPresentation = {
  href?: string;
  label: string;
};

type TaskRelationPresentations = Record<
  string,
  Partial<Record<string, TaskRelationPresentation>>
>;

export function TaskTable(input: {
  items: readonly TaskRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: TaskRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  const showActions = Boolean(input.organizationId && input.resourceBasePath);

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Due At</th>
          <th>Project Id</th>
          <th>Assignee Id</th>
          {showActions ? <th>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {input.items.map((item) => (
          <tr key={item.id}>
            <td>{item.title?.toString()}</td>
            <td>{item.status?.toString()}</td>
            <td>{item.dueAt?.toString()}</td>
            <td>{renderRelationAwareValue(item.id, "projectId", item.projectId, input.relationPresentations)}</td>
            <td>{renderRelationAwareValue(item.id, "assigneeId", item.assigneeId, input.relationPresentations)}</td>
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
  relationPresentations?: TaskRelationPresentations
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
  input: Pick<TaskTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
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
  input: Pick<TaskTableParameters, "organizationId" | "projectId" | "resourceBasePath" | "resourceQuery">,
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

interface TaskTableParameters {
  items: readonly TaskRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: TaskRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}
