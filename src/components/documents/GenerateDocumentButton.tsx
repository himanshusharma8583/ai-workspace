"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon, SpinnerIcon } from "@/components/auth/icons";

export function GenerateDocumentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/documents/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-5 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
      >
        <SparklesIcon className="h-4 w-4" />
        Generate with AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d16] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-indigo-300">
              <SparklesIcon className="h-4 w-4" />
              <h2 className="text-[15px] font-semibold text-white">
                Generate a document
              </h2>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
              Describe what you need — the AI drafts it, you get a fully
              editable document with version history.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-200">
                {error}
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              autoFocus
              rows={4}
              maxLength={2000}
              placeholder="e.g. An onboarding checklist for new engineers joining a small startup — tools, accounts, first-week goals"
              className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/50 transition hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || prompt.trim().length < 10}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                    Writing…
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
