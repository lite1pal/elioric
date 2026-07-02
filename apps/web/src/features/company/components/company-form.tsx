import type { ReactNode } from "react";

import type { CompanyRecord } from "../domain/schemas";

type CompanyFormRelationOption = {
  label: string;
  value: string;
};

export function CompanyForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<CompanyRecord>;
  fieldErrors?: Partial<Record<keyof CompanyRecord, string>>;
  formError?: string;
  relationOptions?: Partial<Record<keyof CompanyRecord, readonly CompanyFormRelationOption[]>>;
  submitLabel?: string;
}) {
  return (
    <form action={input.action} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      {input.formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{input.formError}</p>
      ) : null}
      {input.children}
      <label key={"name"} className="grid gap-2">
        <span className="text-sm font-medium">Name</span>
        <input
          className={input.fieldErrors?.name ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.name ?? ""}
          name="name"
          required
          aria-describedby={"name-error"}
          aria-invalid={input.fieldErrors?.name ? true : undefined}
          type="text"
        />
        {input.fieldErrors?.name ? <span className="text-xs text-red-600" id="name-error">{input.fieldErrors?.name}</span> : null}
      </label>
      <label key={"domain"} className="grid gap-2">
        <span className="text-sm font-medium">Domain</span>
        <input
          className={input.fieldErrors?.domain ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.domain ?? ""}
          name="domain"
          
          aria-describedby={"domain-error"}
          aria-invalid={input.fieldErrors?.domain ? true : undefined}
          type="text"
        />
        {input.fieldErrors?.domain ? <span className="text-xs text-red-600" id="domain-error">{input.fieldErrors?.domain}</span> : null}
      </label>
      <label key={"status"} className="grid gap-2">
        <span className="text-sm font-medium">Status</span>
        <select
          className={input.fieldErrors?.status ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.status ?? "lead"}
          name="status"
          required
          aria-describedby={"status-error"}
          aria-invalid={input.fieldErrors?.status ? true : undefined}
        >
          <option value="lead">Lead</option>
          <option value="customer">Customer</option>
          <option value="inactive">Inactive</option>
        </select>
        {input.fieldErrors?.status ? <span className="text-xs text-red-600" id="status-error">{input.fieldErrors?.status}</span> : null}
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
