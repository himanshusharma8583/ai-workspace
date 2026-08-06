import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspace";
import { runAgent } from "@/lib/agent";

const requestSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
    )
    .max(10)
    .default([]),
});

const DAILY_LIMIT = 30;

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.activityLog.count({
    where: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "ai.chat",
      createdAt: { gte: startOfDay },
    },
  });
  if (usedToday >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Daily chat limit reached (${DAILY_LIMIT}/day). Try again tomorrow.` },
      { status: 429 }
    );
  }

  try {
    // The agent decides which tools to use: search, read, list, and (for
    // roles that may edit) create or update documents.
    const result = await runAgent(
      ctx,
      parsed.data.question,
      parsed.data.history
    );

    await prisma.activityLog.create({
      data: {
        action: "ai.chat",
        metadata: { question: parsed.data.question },
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat failed:", error);
    return NextResponse.json(
      { error: "The AI couldn't answer right now. Please try again." },
      { status: 502 }
    );
  }
}
