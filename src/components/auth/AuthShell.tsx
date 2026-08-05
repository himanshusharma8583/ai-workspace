import Link from "next/link";
import {
  SparklesIcon,
  FileTextIcon,
  MessageIcon,
  ShieldIcon,
} from "@/components/auth/icons";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-950/40">
        <SparklesIcon className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">
        AI&nbsp;Workspace
      </span>
    </Link>
  );
}

export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* aurora blobs */}
      <div className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-indigo-600/25 blur-[120px]" />
      <div className="absolute top-1/3 -right-48 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/15 blur-[120px]" />
      <div className="absolute -bottom-48 left-1/4 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[120px]" />
      {/* faint grid, faded out toward the edges */}
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black_30%,transparent_100%)]" />
    </div>
  );
}

const FEATURES = [
  {
    icon: FileTextIcon,
    title: "AI document generation",
    text: "Draft specs, notes and plans in seconds — versioned automatically.",
  },
  {
    icon: MessageIcon,
    title: "Chat with your docs",
    text: "Ask questions, get answers grounded in your organization's knowledge.",
  },
  {
    icon: ShieldIcon,
    title: "Teams with real roles",
    text: "Owners, admins, members and viewers — every action scoped and logged.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full bg-[#07070d] text-white">
      <AuroraBackground />

      {/* Left — brand panel (hidden on small screens) */}
      <section className="relative z-10 hidden w-1/2 flex-col justify-between border-r border-white/5 p-12 lg:flex">
        <Logo />

        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">
            Where your team&rsquo;s knowledge{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              starts thinking back
            </span>
            .
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/50">
            Documents, AI and collaboration in one place — like Notion, ChatGPT
            and GitHub had a very productive meeting.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-indigo-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-white/90">{t}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-white/40">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          {["Next.js 16", "Prisma 7", "Neon Postgres", "pgvector"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-white/40"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Right — form panel */}
      <section className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
            {/* gradient hairline along the top edge of the card */}
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

            <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
            <p className="mt-1.5 text-sm text-white/45">{subtitle}</p>

            <div className="mt-7">{children}</div>
          </div>

          <p className="mt-6 text-center text-sm text-white/40">{footer}</p>
        </div>
      </section>
    </main>
  );
}
