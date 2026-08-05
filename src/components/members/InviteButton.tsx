"use client";

import { useState } from "react";
import { UserIcon, SpinnerIcon } from "@/components/auth/icons";

const ROLES = [
  { value: "MEMBER", label: "Member", hint: "can create and edit documents" },
  { value: "ADMIN", label: "Admin", hint: "can also invite and manage" },
  { value: "VIEWER", label: "Viewer", hint: "read-only access" },
] as const;

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("MEMBER");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create invite.");
        return;
      }
      setInviteUrl(data.url);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function close() {
    setOpen(false);
    setInviteUrl(null);
    setCopied(false);
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110"
      >
        <UserIcon className="h-4 w-4" />
        Invite teammate
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d16] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold">Invite a teammate</h2>

            {!inviteUrl ? (
              <>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                  Choose their role, then share the link — it works for 7 days.
                </p>
                {error && (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-200">
                    {error}
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {ROLES.map((r) => (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        role === r.value
                          ? "border-indigo-400/50 bg-indigo-500/10"
                          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={() => setRole(r.value)}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm font-medium text-white/85">
                        {r.label}
                      </span>
                      <span className="text-xs text-white/35">— {r.hint}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    onClick={close}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white/50 transition hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {loading && <SpinnerIcon className="h-4 w-4 animate-spin" />}
                    Create invite link
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                  Send this link to your teammate. It expires in 7 days and can
                  be used once.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-indigo-200">
                    {inviteUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={close}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white/50 transition hover:text-white"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
