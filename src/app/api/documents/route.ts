import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, canEdit } from "@/lib/workspace";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

// Cursor pagination instead of page numbers: OFFSET pagination re-scans all
// skipped rows (page 500 of a big org = slow), a cursor jumps straight to
// the next batch via the [organizationId, updatedAt] index.
const LIST_LIMIT = 20;

export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cursor = request.nextUrl.searchParams.get("cursor");

  const documents = await prisma.document.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: LIST_LIMIT + 1, // fetch one extra to know if there's a next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      updatedAt: true,
      author: { select: { name: true } },
      _count: { select: { versions: true } },
    },
  });

  const hasMore = documents.length > LIST_LIMIT;
  const page = hasMore ? documents.slice(0, LIST_LIMIT) : documents;

  return NextResponse.json({
    documents: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!canEdit(ctx.role)) {
    return NextResponse.json(
      { error: "Viewers cannot create documents." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const title = parsed.data.title ?? "Untitled";

  const document = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        content: "",
        authorId: ctx.userId,
        organizationId: ctx.organizationId,
      },
      select: { id: true, title: true },
    });
    await tx.activityLog.create({
      data: {
        action: "document.create",
        metadata: { documentId: document.id, title },
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });
    return document;
  });

  return NextResponse.json(document, { status: 201 });
}
