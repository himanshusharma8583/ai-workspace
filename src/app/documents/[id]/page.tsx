import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, canEdit } from "@/lib/workspace";
import { AuroraBackground } from "@/components/auth/AuthShell";
import { AppHeader } from "@/components/AppHeader";
import { DocumentEditor } from "@/components/documents/DocumentEditor";

export default async function DocumentPage({
  params,
}: PageProps<"/documents/[id]">) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      authorId: true,
      _count: { select: { versions: true } },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, createdAt: true },
      },
    },
  });
  if (!document) notFound();

  const body = typeof document.content === "string" ? document.content : "";

  return (
    <main className="relative min-h-screen bg-[#07070d] text-white">
      <AuroraBackground />
      <AppHeader
        orgName={ctx.organization.name}
        email={null}
        active="documents"
      />

      <DocumentEditor
        id={document.id}
        initialTitle={document.title}
        initialBody={body}
        readOnly={!canEdit(ctx.role)}
        canDelete={
          ctx.role === "OWNER" ||
          ctx.role === "ADMIN" ||
          (ctx.role === "MEMBER" && document.authorId === ctx.userId)
        }
        totalVersions={document._count.versions}
        versions={document.versions.map((v) => ({
          id: v.id,
          createdAt: v.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
