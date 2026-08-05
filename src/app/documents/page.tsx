import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, canEdit } from "@/lib/workspace";
import { AuroraBackground } from "@/components/auth/AuthShell";
import { AppHeader } from "@/components/AppHeader";
import { NewDocumentButton } from "@/components/documents/NewDocumentButton";
import { GenerateDocumentButton } from "@/components/documents/GenerateDocumentButton";
import { FileTextIcon } from "@/components/auth/icons";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function DocumentsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const documents = await prisma.document.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      author: { select: { name: true } },
      _count: { select: { versions: true } },
    },
  });

  return (
    <main className="relative min-h-screen bg-[#07070d] text-white">
      <AuroraBackground />
      <AppHeader
        orgName={ctx.organization.name}
        email={null}
        active="documents"
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Documents</h1>
            <p className="mt-1 text-sm text-white/40">
              Every save creates a version — nothing is ever lost.
            </p>
          </div>
          {canEdit(ctx.role) && (
            <div className="flex items-center gap-3">
              <GenerateDocumentButton />
              <NewDocumentButton />
            </div>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="mt-16 flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-indigo-300">
              <FileTextIcon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-medium text-white/70">
              No documents yet
            </p>
            <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-white/40">
              Create your first document — soon the AI will draft them with
              you.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-2.5">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.id}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl transition hover:border-indigo-400/30 hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-indigo-300">
                      <FileTextIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/90 transition group-hover:text-white">
                        {doc.title}
                      </p>
                      <p className="mt-0.5 text-xs text-white/35">
                        {doc.author.name ?? "Unknown"} · edited{" "}
                        {dateFormat.format(doc.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/40">
                    {doc._count.versions}{" "}
                    {doc._count.versions === 1 ? "version" : "versions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
