import type { ReactNode } from "react";

import type { DealRecord } from "../domain/schemas.js";

export function DealForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<DealRecord>;
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
      <label key={"stage"} className="grid gap-2">
        <span>Stage</span>
        <select
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.stage ?? "lead"}
          name="stage"
          required
        >
          <option value="lead">Lead</option>
          <option value="qualified">Qualified</option>
          <option value="proposal">Proposal</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </label>
      <label key={"amount"} className="grid gap-2">
        <span>Amount</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.amount ?? ""}
          name="amount"
          
          type="text"
        />
      </label>
      <label key={"companyId"} className="grid gap-2">
        <span>Company Id</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.companyId ?? ""}
          name="companyId"
          required
          type="text"
        />
      </label>
      <label key={"ownerId"} className="grid gap-2">
        <span>Owner Id</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.ownerId ?? ""}
          name="ownerId"
          
          type="text"
        />
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
