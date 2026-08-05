import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/invitations/[token]/accept">
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const { token } = await ctx.params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      acceptedById: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });
  if (!invitation || invitation.acceptedById || invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This invite link is invalid or has expired." },
      { status: 410 }
    );
  }

  const existing = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: invitation.organizationId,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You are already a member of this workspace." },
      { status: 409 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedById: userId },
    });
    await tx.activityLog.create({
      data: {
        action: "member.joined",
        metadata: { role: invitation.role },
        userId,
        organizationId: invitation.organizationId,
      },
    });
  });

  return NextResponse.json({ ok: true, organization: invitation.organization.name });
}
