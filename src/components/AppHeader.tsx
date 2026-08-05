import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Logo } from "@/components/auth/AuthShell";

const NAV = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" },
  { href: "/documents", label: "Documents", key: "documents" },
] as const;

export function AppHeader({
  orgName,
  email,
  active,
}: {
  orgName: string;
  email?: string | null;
  active: (typeof NAV)[number]["key"];
}) {
  return (
    <header className="relative z-10 flex items-center justify-between border-b border-white/5 px-6 py-4 sm:px-10">
      <div className="flex items-center gap-5">
        <Logo />
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 md:block">
          {orgName}
        </span>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                item.key === active
                  ? "rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg px-3 py-1.5 text-sm font-medium text-white/50 transition hover:text-white"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {email && (
          <span className="hidden text-sm text-white/50 lg:block">{email}</span>
        )}
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
  );
}
