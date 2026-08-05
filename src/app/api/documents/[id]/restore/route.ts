import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, canEdit } from "@/lib/workspace";
import { reindexDocument } from "@/lib/rag";

const requestSchema = z.object({ versionId: z.string().min(1) });

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/documents/[id]/restore">
) {
  const workspace = await getWorkspaceContext();
  if (!workspace) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(workspace.role)) {
    return NextResponse.json(
      { error: "Viewers cannot restore versions." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id } = await ctx.params;

  // Version must belong to this document AND the document to this org
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: parsed.data.versionId,
      document: { id, organizationId: workspace.organizationId },
    },
    select: { content: true },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const snapshot = version.content as { title?: string; body?: string } | null;
  const title = snapshot?.title ?? "Untitled";
  const content = snapshot?.body ?? "";

  const document = await prisma.$transaction(async (tx) => {
    const document = await tx.document.update({
      where: { id },
      data: { title, content },
      select: { id: true, title: true, content: true, updatedAt: true },
    });
    // The restore itself becomes a new version — history is never rewritten
    await tx.documentVersion.create({
      data: { documentId: id, content: { title, body: content } },
    });
    await tx.activityLog.create({
      data: {
        action: "document.restore",
        metadata: { documentId: id, title },
        userId: workspace.userId,
        organizationId: workspace.organizationId,
      },
    });
    return document;
  });

  try {
    await reindexDocument(id, workspace.organizationId, title, content);
  } catch (error) {
    console.error("Reindex failed for document", id, error);
  }

  return NextResponse.json(document);
}
