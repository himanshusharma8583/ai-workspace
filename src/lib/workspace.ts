import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export type WorkspaceContext = {
  userId: string;
  role: Role;
  organizationId: string;
  organization: { id: string; name: string; slug: string };
};

// Resolves the current user and their organization in one indexed query.
// Every API route and page goes through this — it is the tenant boundary.
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organizationId: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!membership) return null;

  return {
    userId: session.user.id,
    role: membership.role,
    organizationId: membership.organizationId,
    organization: membership.organization,
  };
}

// VIEWERs can read everything in their org but never mutate.
export function canEdit(role: Role): boolean {
  return role === Role.OWNER || role === Role.ADMIN || role === Role.MEMBER;
}

// Deleting is stricter: admins can delete anything, members only their own.
export function canDelete(role: Role, isAuthor: boolean): boolean {
  return role === Role.OWNER || role === Role.ADMIN || (role === Role.MEMBER && isAuthor);
}
