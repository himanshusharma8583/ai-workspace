import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Logo, AuroraBackground } from "@/components/auth/AuthShell";
import { ArrowRightIcon } from "@/components/auth/icons";

export default async function Home() {
  const session = await auth();

  return (
    <main className="relative flex min-h-screen flex-col bg-[#07070d] text-white">
      <AuroraBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-12">
        <Logo />
        <nav className="flex items-center gap-3">
          {session?.user ? (
            <>
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
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <span className="mb-6 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-indigo-300">
          AI generation &amp; chat with your docs — live now
        </span>

        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Your team&rsquo;s work,{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            with a brain
          </span>
          .
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/50 sm:text-lg">
          Documents, AI generation, org-scoped chat with your knowledge, roles
          and version history — one workspace instead of five tabs.
        </p>

        <div className="mt-10 flex items-center gap-4">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold shadow-lg shadow-indigo-950/50 transition hover:brightness-110"
            >
              Open your dashboard
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold shadow-lg shadow-indigo-950/50 transition hover:brightness-110"
              >
                Create your workspace
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
