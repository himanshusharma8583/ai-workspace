import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspace";
import { Role } from "@/generated/prisma/enums";

// Invites can grant any role except OWNER — ownership isn't given via link
const createSchema = z.object({
  role: z.enum([Role.ADMIN, Role.MEMBER, Role.VIEWER]).default(Role.MEMBER),
});

const INVITE_TTL_DAYS = 7;

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (ctx.role !== Role.OWNER && ctx.role !== Role.ADMIN) {
    return NextResponse.json(
      { error: "Only owners and admins can invite members." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const invitation = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.create({
      data: {
        role: parsed.data.role,
        expiresAt,
        organizationId: ctx.organizationId,
        invitedById: ctx.userId,
      },
      select: { token: true, role: true, expiresAt: true },
    });
    await tx.activityLog.create({
      data: {
        action: "member.invite_created",
        metadata: { role: parsed.data.role },
        userId: ctx.userId,
        organizationId: ctx.organizationId,
      },
    });
    return invitation;
  });

  return NextResponse.json(
    {
      url: `${new URL(request.url).origin}/invite/${invitation.token}`,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
    { status: 201 }
  );
}
