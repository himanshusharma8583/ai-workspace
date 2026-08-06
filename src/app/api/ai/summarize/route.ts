import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext, canEdit } from "@/lib/workspace";
import { summarizeMeeting } from "@/lib/ai";
import { reindexDocument } from "@/lib/rag";

const requestSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(100, "Paste the full transcript — at least a few lines")
    .max(60_000, "Transcript too long — split it into parts"),
});

const DAILY_LIMIT = 10;

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

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.activityLog.count({
    where: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "document.ai_summarize",
      createdAt: { gte: startOfDay },
    },
  });
  if (usedToday >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Daily summary limit reached (${DAILY_LIMIT}/day). Try again tomorrow.` },
      { status: 429 }
    );
  }

  let generated;
  try {
    generated = await summarizeMeeting(parsed.data.transcript);
  } catch (error) {
    console.error("Meeting summarization failed:", error);
    return NextResponse.json(
      { error: "The AI couldn't summarize this transcript. Please try again." },
      { status: 502 }
    );
  }

  const title = generated.title.slice(0, 200);

  const document = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title,
        content: generated.body,
        authorId: ctx.userId,
        organizationId: ctx.organizationId,
      },
      select: { id: true, title: true },
    });
    await tx.documentVersion.create({
      data: {
        documentId: document.id,
        content: { title, body: generated.body },
      },
    });
    await tx.activityLog.create({
      data: {
        action: "document.ai_summarize",
        metadata: { documentId: document.id, title },
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });
    return document;
  });

  try {
    await reindexDocument(document.id, ctx.organizationId, title, generated.body);
  } catch (error) {
    console.error("Reindex failed for document", document.id, error);
  }

  return NextResponse.json(document, { status: 201 });
}
