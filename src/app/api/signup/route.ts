import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  inviteToken: z.string().optional(),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Invited signup: join the inviting org instead of creating a personal one
  if (parsed.data.inviteToken) {
    const invitation = await prisma.invitation.findUnique({
      where: { token: parsed.data.inviteToken },
      select: { id: true, role: true, expiresAt: true, acceptedById: true, organizationId: true },
    });
    if (!invitation || invitation.acceptedById || invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invite link is invalid or has expired." },
        { status: 410 }
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedById: user.id },
      });
      await tx.activityLog.create({
        data: {
          action: "member.joined",
          metadata: { role: invitation.role },
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      });
      return user;
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  }

  // Random suffix keeps slugs unique even when two users share a name
  const slug = `${slugify(name) || "workspace"}-${randomBytes(3).toString("hex")}`;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });
      const organization = await tx.organization.create({
        data: { name: `${name}'s Workspace`, slug },
      });
      await tx.membership.create({
        data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
      });
      await tx.activityLog.create({
        data: {
          action: "user.signup",
          userId: user.id,
          organizationId: organization.id,
        },
      });
      return user;
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    // P2002 = unique constraint violation: a duplicate signup slipped past the
    // check above (two requests racing), so answer it the same way
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    throw error;
  }
}
