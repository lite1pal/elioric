import type { ReactNode } from "react";

import type { NoteRecord } from "../domain/schemas.js";

export function NoteForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<NoteRecord>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.children}
      <label key={"body"} className="grid gap-2">
        <span>Body</span>
        <textarea
          className="min-h-24 rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.body ?? ""}
          name="body"
          required
        />
      </label>
      <label key={"dealId"} className="grid gap-2">
        <span>Deal Id</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.dealId ?? ""}
          name="dealId"
          required
          type="text"
        />
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
