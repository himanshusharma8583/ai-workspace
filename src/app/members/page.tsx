import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspace";
import { AuroraBackground } from "@/components/auth/AuthShell";
import { AppHeader } from "@/components/AppHeader";
import { InviteButton } from "@/components/members/InviteButton";
import { Role } from "@/generated/prisma/enums";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  ADMIN: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
  MEMBER: "border-indigo-400/30 bg-indigo-400/10 text-indigo-200",
  VIEWER: "border-white/15 bg-white/5 text-white/50",
};

export default async function MembersPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const members = await prisma.membership.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const canInvite = ctx.role === Role.OWNER || ctx.role === Role.ADMIN;

  return (
    <main className="relative min-h-screen bg-[#07070d] text-white">
      <AuroraBackground />
      <AppHeader orgName={ctx.organization.name} email={null} active="members" />

      <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
            <p className="mt-1 text-sm text-white/40">
              {members.length} {members.length === 1 ? "person" : "people"} in{" "}
              {ctx.organization.name}
            </p>
          </div>
          {canInvite && <InviteButton />}
        </div>

        <ul className="mt-8 space-y-2.5">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/60 to-fuchsia-500/60 text-sm font-semibold">
                  {(member.user.name ?? member.user.email)[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white/90">
                    {member.user.name ?? member.user.email}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/35">
                    {member.user.email} · joined{" "}
                    {dateFormat.format(member.createdAt)}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${ROLE_STYLES[member.role]}`}
              >
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
