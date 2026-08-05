import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuroraBackground, Logo } from "@/components/auth/AuthShell";
import { AcceptInviteButton } from "@/components/members/AcceptInviteButton";

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const session = await auth();

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      role: true,
      expiresAt: true,
      acceptedById: true,
      organization: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  const invalid =
    !invitation || invitation.acceptedById || invitation.expiresAt < new Date();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#07070d] px-6 text-white">
      <AuroraBackground />
      <div className="relative z-10 mb-10">
        <Logo />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-xl">
        {invalid ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight">
              This invite link is no longer valid
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              It may have expired or already been used. Ask the person who
              invited you for a fresh link.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              Go to homepage
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-indigo-300">
              {invitation.invitedBy.name ?? "A teammate"} invited you to join
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {invitation.organization.name}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              You&rsquo;ll join as{" "}
              <span className="font-medium text-white/70">
                {invitation.role.toLowerCase()}
              </span>
              .
            </p>

            <div className="mt-7">
              {session?.user ? (
                <AcceptInviteButton token={token} />
              ) : (
                <div className="space-y-3">
                  <Link
                    href={`/signup?invite=${token}`}
                    className="block rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110"
                  >
                    Create an account &amp; join
                  </Link>
                  <p className="text-xs text-white/35">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      Sign in
                    </Link>{" "}
                    first, then open this link again.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
