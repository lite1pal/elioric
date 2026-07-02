import type { ReactNode } from "react";

import type { TodoRecord } from "../domain/schemas";

type TodoFormRelationOption = {
  label: string;
  value: string;
};

export function TodoForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<TodoRecord>;
  fieldErrors?: Partial<Record<keyof TodoRecord, string>>;
  formError?: string;
  relationOptions?: Partial<Record<keyof TodoRecord, readonly TodoFormRelationOption[]>>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{input.formError}</p>
      ) : null}
      {input.children}
      <label key={"title"} className="grid gap-2">
        <span className="text-sm font-medium">Title</span>
        <input
          className={input.fieldErrors?.title ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.title ?? ""}
          name="title"
          required
          aria-describedby={"title-error"}
          aria-invalid={input.fieldErrors?.title ? true : undefined}
          type="text"
        />
        {input.fieldErrors?.title ? <span className="text-xs text-red-600" id="title-error">{input.fieldErrors?.title}</span> : null}
      </label>
      <label key={"details"} className="grid gap-2">
        <span className="text-sm font-medium">Details</span>
        <textarea
          className={input.fieldErrors?.details ? "min-h-24 rounded-md border border-red-500 px-3 py-2" : "min-h-24 rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.details ?? ""}
          name="details"
          
          aria-describedby={"details-error"}
          aria-invalid={input.fieldErrors?.details ? true : undefined}
        />
        {input.fieldErrors?.details ? <span className="text-xs text-red-600" id="details-error">{input.fieldErrors?.details}</span> : null}
      </label>
      <label key={"status"} className="grid gap-2">
        <span className="text-sm font-medium">Status</span>
        <select
          className={input.fieldErrors?.status ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.status ?? "todo"}
          name="status"
          required
          aria-describedby={"status-error"}
          aria-invalid={input.fieldErrors?.status ? true : undefined}
        >
          <option value="todo">Todo</option>
          <option value="done">Done</option>
        </select>
        {input.fieldErrors?.status ? <span className="text-xs text-red-600" id="status-error">{input.fieldErrors?.status}</span> : null}
      </label>
      <label key={"dueAt"} className="grid gap-2">
        <span className="text-sm font-medium">Due At</span>
        <input
          className={input.fieldErrors?.dueAt ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={toDateTimeLocalValue(input.defaultValues?.dueAt)}
          name="dueAt"
          
          aria-describedby={"dueAt-error"}
          aria-invalid={input.fieldErrors?.dueAt ? true : undefined}
          type="datetime-local"
        />
        {input.fieldErrors?.dueAt ? <span className="text-xs text-red-600" id="dueAt-error">{input.fieldErrors?.dueAt}</span> : null}
      </label>
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Todo"}</button>
    </form>
  );
}

function toDateTimeLocalValue(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}
