"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/TextField";
import {
  UserIcon,
  MailIcon,
  LockIcon,
  ArrowRightIcon,
  SpinnerIcon,
} from "@/components/auth/icons";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Account created — sign them straight in with the same credentials
      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (login?.error) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Free while in development. No credit card, obviously."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-300 transition hover:text-indigo-200"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-200"
          >
            {error}
          </div>
        )}

        <TextField
          label="Full name"
          placeholder="Ada Lovelace"
          icon={<UserIcon className="h-4 w-4" />}
          value={name}
          onChange={setName}
          autoComplete="name"
        />
        <TextField
          label="Email"
          type="email"
          placeholder="you@company.com"
          icon={<MailIcon className="h-4 w-4" />}
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <TextField
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          icon={<LockIcon className="h-4 w-4" />}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />

        <button
          type="submit"
          disabled={loading}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Creating workspace…
            </>
          ) : (
            <>
              Create workspace
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        <p className="pt-1 text-center text-xs leading-relaxed text-white/30">
          You&rsquo;ll get your own organization with you as its owner.
        </p>
      </form>
    </AuthShell>
  );
}
