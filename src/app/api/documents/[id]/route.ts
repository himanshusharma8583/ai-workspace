import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, canEdit, canDelete } from "@/lib/workspace";
import { reindexDocument } from "@/lib/rag";

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(100_000).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: "Nothing to update",
  });

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const workspace = await getWorkspaceContext();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Scoped by organizationId: a document from another org 404s, even with a
  // valid id — this is the tenant isolation rule.
  const document = await prisma.document.findFirst({
    where: { id, organizationId: workspace.organizationId },
    select: {
      id: true,
      title: true,
      content: true,
      updatedAt: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(document);
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const workspace = await getWorkspaceContext();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(workspace.role)) {
    return NextResponse.json(
      { error: "Viewers cannot edit documents." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id } = await ctx.params;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.document.findFirst({
      where: { id, organizationId: workspace.organizationId },
      select: { id: true },
    });
    if (!existing) return null;

    const document = await tx.document.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.content !== undefined && {
          content: parsed.data.content,
        }),
      },
      select: { id: true, title: true, content: true, updatedAt: true },
    });

    // Version snapshot on every save — this is the version history feature
    await tx.documentVersion.create({
      data: {
        documentId: id,
        content: { title: document.title, body: document.content ?? "" },
      },
    });

    await tx.activityLog.create({
      data: {
        action: "document.update",
        metadata: { documentId: id, title: document.title },
        userId: workspace.userId,
        organizationId: workspace.organizationId,
      },
    });

    return document;
  });

  if (!result) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Refresh the RAG search index; an embedding failure must never fail a save
  try {
    await reindexDocument(
      result.id,
      workspace.organizationId,
      result.title,
      typeof result.content === "string" ? result.content : ""
    );
  } catch (error) {
    console.error("Reindex failed for document", result.id, error);
  }

  return NextResponse.json(result);
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const workspace = await getWorkspaceContext();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const document = await prisma.document.findFirst({
    where: { id, organizationId: workspace.organizationId },
    select: { id: true, title: true, authorId: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!canDelete(workspace.role, document.authorId === workspace.userId)) {
    return NextResponse.json(
      { error: "You don't have permission to delete this document." },
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Versions are removed automatically via onDelete: Cascade
    await tx.document.delete({ where: { id } });
    await tx.activityLog.create({
      data: {
        action: "document.delete",
        metadata: { documentId: id, title: document.title },
        userId: workspace.userId,
        organizationId: workspace.organizationId,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
