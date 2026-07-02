import type { ReactNode } from "react";

import type { ContactRecord } from "../domain/schemas.js";

export function ContactForm(input: {
  action?: (formData: FormData) => void | Promise<void>;
  children?: ReactNode;
  defaultValues?: Partial<ContactRecord>;
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
      <label key={"email"} className="grid gap-2">
        <span>Email</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.email ?? ""}
          name="email"
          
          type="email"
        />
      </label>
      <label key={"title"} className="grid gap-2">
        <span>Title</span>
        <input
          className="rounded-md border border-[var(--border)] px-3 py-2"
          defaultValue={input.defaultValues?.title ?? ""}
          name="title"
          
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
