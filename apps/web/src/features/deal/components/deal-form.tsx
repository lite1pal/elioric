import type { ReactNode } from "react";

import type { DealRecord } from "../domain/schemas.js";

type DealFormRelationOption = {
  label: string;
  value: string;
};

export function DealForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<DealRecord>;
  fieldErrors?: Partial<Record<keyof DealRecord, string>>;
  formError?: string;
  relationOptions?: Partial<Record<keyof DealRecord, readonly DealFormRelationOption[]>>;
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
      <label key={"stage"} className="grid gap-2">
        <span className="text-sm font-medium">Stage</span>
        <select
          className={input.fieldErrors?.stage ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.stage ?? "lead"}
          name="stage"
          required
          aria-describedby={"stage-error"}
          aria-invalid={input.fieldErrors?.stage ? true : undefined}
        >
          <option value="lead">Lead</option>
          <option value="qualified">Qualified</option>
          <option value="proposal">Proposal</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        {input.fieldErrors?.stage ? <span className="text-xs text-red-600" id="stage-error">{input.fieldErrors?.stage}</span> : null}
      </label>
      <label key={"amount"} className="grid gap-2">
        <span className="text-sm font-medium">Amount</span>
        <input
          className={input.fieldErrors?.amount ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.amount ?? ""}
          name="amount"
          
          aria-describedby={"amount-error"}
          aria-invalid={input.fieldErrors?.amount ? true : undefined}
          type="text"
        />
        {input.fieldErrors?.amount ? <span className="text-xs text-red-600" id="amount-error">{input.fieldErrors?.amount}</span> : null}
      </label>
      <label key={"companyId"} className="grid gap-2">
        <span className="text-sm font-medium">Company</span>
        {input.relationOptions?.companyId && input.relationOptions.companyId.length > 0 ? (
          <select
            className={input.fieldErrors?.companyId ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
            defaultValue={input.defaultValues?.companyId ?? ""}
            name="companyId"
            required
          aria-describedby={"companyId-hint companyId-error"}
          aria-invalid={input.fieldErrors?.companyId ? true : undefined}
          >
            <option value="">Select company</option>
            {input.relationOptions.companyId.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={input.fieldErrors?.companyId ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
            defaultValue={input.defaultValues?.companyId ?? ""}
            name="companyId"
            required
          aria-describedby={"companyId-hint companyId-error"}
          aria-invalid={input.fieldErrors?.companyId ? true : undefined}
            type="text"
          />
        )}
        <span className="text-xs text-[var(--muted)]" id="companyId-hint">Reference to Company</span>
        {input.fieldErrors?.companyId ? <span className="text-xs text-red-600" id="companyId-error">{input.fieldErrors?.companyId}</span> : null}
      </label>
      <label key={"ownerId"} className="grid gap-2">
        <span className="text-sm font-medium">Owner</span>
        {input.relationOptions?.ownerId && input.relationOptions.ownerId.length > 0 ? (
          <select
            className={input.fieldErrors?.ownerId ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
            defaultValue={input.defaultValues?.ownerId ?? ""}
            name="ownerId"
            
          aria-describedby={"ownerId-hint ownerId-error"}
          aria-invalid={input.fieldErrors?.ownerId ? true : undefined}
          >
            <option value="">No owner selected</option>
            {input.relationOptions.ownerId.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={input.fieldErrors?.ownerId ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
            defaultValue={input.defaultValues?.ownerId ?? ""}
            name="ownerId"
            
          aria-describedby={"ownerId-hint ownerId-error"}
          aria-invalid={input.fieldErrors?.ownerId ? true : undefined}
            type="text"
          />
        )}
        <span className="text-xs text-[var(--muted)]" id="ownerId-hint">Reference to Owner</span>
        {input.fieldErrors?.ownerId ? <span className="text-xs text-red-600" id="ownerId-error">{input.fieldErrors?.ownerId}</span> : null}
      </label>
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Deal"}</button>
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
