"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MicIcon, SpinnerIcon } from "@/components/auth/icons";

export function SummarizeMeetingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSummarize() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
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
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
      >
        <MicIcon className="h-4 w-4" />
        Summarize meeting
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d0d16] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-indigo-300">
              <MicIcon className="h-4 w-4" />
              <h2 className="text-[15px] font-semibold text-white">
                Summarize a meeting
              </h2>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
              Paste the transcript or your raw notes. You&rsquo;ll get a
              structured summary — decisions, action items with owners, open
              questions — saved as a document your team can chat with.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-200">
                {error}
              </div>
            )}

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              autoFocus
              rows={10}
              maxLength={60000}
              placeholder={
                "10:02 Priya: Let's finalize the launch date...\n10:03 Marco: Marketing needs two weeks after code freeze...\n\n(any format works — timestamps and names help)"
              }
              className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 font-mono text-[13px] leading-relaxed text-white placeholder-white/25 outline-none transition focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
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
                onClick={handleSummarize}
                disabled={loading || transcript.trim().length < 100}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                    Summarizing…
                  </>
                ) : (
                  "Summarize"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
