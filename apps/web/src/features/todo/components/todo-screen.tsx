import type { TodoRecord } from "../domain/schemas";

import { TodoEmptyState } from "./todo-empty-state";
import { TodoTable } from "./todo-table";

type TodoRelationPresentation = {
  href?: string;
  label: string;
};

type TodoRelationPresentations = Record<
  string,
  Partial<Record<string, TodoRelationPresentation>>
>;

export function TodoScreen(input: {
  items: readonly TodoRecord[];
  organizationId?: string;
  projectId?: string;
  relationPresentations?: TodoRelationPresentations;
  resourceQuery?: string;
  resourceBasePath?: string;
}) {
  if (input.items.length === 0) {
    return <TodoEmptyState />;
  }

  return (
    <TodoTable
      items={input.items}
      organizationId={input.organizationId}
      projectId={input.projectId}
      relationPresentations={input.relationPresentations}
      resourceQuery={input.resourceQuery}
      resourceBasePath={input.resourceBasePath}
    />
  );
}
