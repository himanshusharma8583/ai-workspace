import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo, AuroraBackground } from "@/components/auth/AuthShell";
import {
  FileTextIcon,
  UserIcon,
  ShieldIcon,
  SparklesIcon,
} from "@/components/auth/icons";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function DashboardPage() {
  // The proxy already redirects anonymous visitors, but that check is
  // optimistic (cookie-only) — the page re-verifies before touching data.
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // One indexed query: membership (by userId) joined to the org with counts
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    select: {
      role: true,
      createdAt: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { documents: true, memberships: true } },
        },
      },
    },
  });

  if (!membership) redirect("/signup");

  const org = membership.organization;

  // Second indexed query ([organizationId, createdAt]): latest activity
  const activity = await prisma.activityLog.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      action: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const stats = [
    {
      icon: FileTextIcon,
      label: "Documents",
      value: org._count.documents,
      hint: "CRUD coming next",
    },
    {
      icon: UserIcon,
      label: "Members",
      value: org._count.memberships,
      hint: "invites coming soon",
    },
    {
      icon: ShieldIcon,
      label: "Your role",
      value: membership.role,
      hint: `since ${dateFormat.format(membership.createdAt)}`,
    },
  ];

  return (
    <main className="relative min-h-screen bg-[#07070d] text-white">
      <AuroraBackground />

      <header className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 sm:block">
            {org.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-white/50 sm:block">
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
        <p className="text-sm font-medium text-indigo-300">{org.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Welcome back, {firstName}.
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map(({ icon: Icon, label, value, hint }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 text-white/40">
                <Icon className="h-4 w-4" />
                <span className="text-[13px] font-medium">{label}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {value}
              </p>
              <p className="mt-1 text-xs text-white/30">{hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl lg:col-span-3">
            <h2 className="text-sm font-semibold text-white/80">
              Recent activity
            </h2>
            <ul className="mt-4 space-y-3">
              {activity.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white/80">
                      <span className="font-medium">
                        {entry.user.name ?? entry.user.email}
                      </span>{" "}
                      <span className="text-white/40">·</span>{" "}
                      <code className="text-[13px] text-indigo-300">
                        {entry.action}
                      </code>
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-white/30">
                    {timeFormat.format(entry.createdAt)}
                  </time>
                </li>
              ))}
              {activity.length === 0 && (
                <li className="text-sm text-white/40">No activity yet.</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 lg:col-span-2">
            <div className="flex items-center gap-2 text-indigo-300">
              <SparklesIcon className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Up next</h2>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/50">
              <li>· Documents with version history</li>
              <li>· AI document generation</li>
              <li>· Chat with your org&rsquo;s knowledge</li>
              <li>· Member invites &amp; roles</li>
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-white/30">
              Workspace slug:{" "}
              <code className="text-white/50">{org.slug}</code>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
