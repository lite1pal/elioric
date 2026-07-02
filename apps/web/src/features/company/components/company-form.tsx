import type { ReactNode } from "react";

import type { CompanyRecord } from "../domain/schemas.js";

export function CompanyForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<CompanyRecord>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.children}
      <label key={"name"} className="grid gap-2">
        <span>Name</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.name ?? ""}
          name="name"
          required
          type="text"
        />
      </label>
      <label key={"domain"} className="grid gap-2">
        <span>Domain</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.domain ?? ""}
          name="domain"
          
          type="text"
        />
      </label>
      <label key={"status"} className="grid gap-2">
        <span>Status</span>
        <select
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.status ?? "lead"}
          name="status"
          required
        >
          <option value="lead">Lead</option>
          <option value="customer">Customer</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Company"}</button>
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
