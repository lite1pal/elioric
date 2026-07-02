import type { ReactNode } from "react";

import type { NoteRecord } from "../domain/schemas";

type NoteFormRelationOption = {
  label: string;
  value: string;
};

export function NoteForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<NoteRecord>;
  fieldErrors?: Partial<Record<keyof NoteRecord, string>>;
  formError?: string;
  relationOptions?: Partial<Record<keyof NoteRecord, readonly NoteFormRelationOption[]>>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{input.formError}</p>
      ) : null}
      {input.children}
      <label key={"body"} className="grid gap-2">
        <span className="text-sm font-medium">Body</span>
        <textarea
          className={input.fieldErrors?.body ? "min-h-24 rounded-md border border-red-500 px-3 py-2" : "min-h-24 rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.body ?? ""}
          name="body"
          required
          aria-describedby={"body-error"}
          aria-invalid={input.fieldErrors?.body ? true : undefined}
        />
        {input.fieldErrors?.body ? <span className="text-xs text-red-600" id="body-error">{input.fieldErrors?.body}</span> : null}
      </label>
      <label key={"dealId"} className="grid gap-2">
        <span className="text-sm font-medium">Deal</span>
        {input.relationOptions?.dealId && input.relationOptions.dealId.length > 0 ? (
          <select
            className={input.fieldErrors?.dealId ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
            defaultValue={input.defaultValues?.dealId ?? ""}
            name="dealId"
            required
          aria-describedby={"dealId-hint dealId-error"}
          aria-invalid={input.fieldErrors?.dealId ? true : undefined}
          >
            <option value="">Select deal</option>
            {input.relationOptions.dealId.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={input.fieldErrors?.dealId ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
            defaultValue={input.defaultValues?.dealId ?? ""}
            name="dealId"
            required
          aria-describedby={"dealId-hint dealId-error"}
          aria-invalid={input.fieldErrors?.dealId ? true : undefined}
            type="text"
          />
        )}
        <span className="text-xs text-[var(--muted)]" id="dealId-hint">Reference to Deal</span>
        {input.fieldErrors?.dealId ? <span className="text-xs text-red-600" id="dealId-error">{input.fieldErrors?.dealId}</span> : null}
      </label>
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Note"}</button>
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
