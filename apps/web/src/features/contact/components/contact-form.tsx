import type { ReactNode } from "react";

import type { ContactRecord } from "../domain/schemas.js";

type ContactFormRelationOption = {
  label: string;
  value: string;
};

export function ContactForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<ContactRecord>;
  fieldErrors?: Partial<Record<keyof ContactRecord, string>>;
  formError?: string;
  relationOptions?: Partial<Record<keyof ContactRecord, readonly ContactFormRelationOption[]>>;
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
      <label key={"email"} className="grid gap-2">
        <span className="text-sm font-medium">Email</span>
        <input
          className={input.fieldErrors?.email ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.email ?? ""}
          name="email"
          
          aria-describedby={"email-error"}
          aria-invalid={input.fieldErrors?.email ? true : undefined}
          type="email"
        />
        {input.fieldErrors?.email ? <span className="text-xs text-red-600" id="email-error">{input.fieldErrors?.email}</span> : null}
      </label>
      <label key={"title"} className="grid gap-2">
        <span className="text-sm font-medium">Title</span>
        <input
          className={input.fieldErrors?.title ? "rounded-md border border-red-500 px-3 py-2" : "rounded-md border border-[var(--border)] px-3 py-2"}
          defaultValue={input.defaultValues?.title ?? ""}
          name="title"
          
          aria-describedby={"title-error"}
          aria-invalid={input.fieldErrors?.title ? true : undefined}
          type="text"
        />
        {input.fieldErrors?.title ? <span className="text-xs text-red-600" id="title-error">{input.fieldErrors?.title}</span> : null}
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
      <button className="w-fit rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium" type="submit">{input.submitLabel ?? "Save Contact"}</button>
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
