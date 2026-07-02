import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/src/components/ui/page-shell";

export function CrmHomeScreen(input: {
  organizationName?: string;
  resourceLinks: readonly {
    href: string;
    label: string;
  }[];
}) {
  return (
    <PageShell>
      <div className="grid gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">CRM</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            {input.organizationName
              ? `${input.organizationName} crm`
              : "CRM workspace"}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--muted)]">Manage companies, contacts, deals, and notes through one generated multi-resource CRM workspace without hand-editing shared runtime seams.</p>
        </header>
        <div className="flex flex-wrap gap-3">
          {input.resourceLinks.map((resourceLink) => (
            <Link
              key={resourceLink.href}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium"
              href={resourceLink.href as Route}
            >
              {resourceLink.label}
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
