"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SpinnerIcon } from "@/components/auth/icons";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function DocumentEditor({
  id,
  initialTitle,
  initialBody,
  readOnly,
  canDelete,
  totalVersions,
  versions,
}: {
  id: string;
  initialTitle: string;
  initialBody: string;
  readOnly: boolean;
  canDelete: boolean;
  totalVersions: number;
  versions: { id: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = title !== initialTitle || body !== initialBody;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || "Untitled", content: body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not save. Please try again.");
        return;
      }
      setSavedAt(new Date());
      // Refresh the server-rendered version list in the sidebar
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/documents");
        router.refresh();
      } else {
        setDeleting(false);
        setConfirmingDelete(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/documents"
            className="text-sm text-white/40 transition hover:text-white/70"
          >
            ← Documents
          </Link>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-rose-300">{error}</span>}
            {!error && savedAt && !dirty && (
              <span className="text-xs text-emerald-300/80">
                Saved {timeFormat.format(savedAt)}
              </span>
            )}
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-40"
              >
                {saving && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          readOnly={readOnly}
          maxLength={200}
          placeholder="Untitled"
          className="mt-6 w-full bg-transparent text-3xl font-semibold tracking-tight text-white placeholder-white/25 outline-none"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          readOnly={readOnly}
          placeholder="Start writing… (AI assistance coming soon)"
          className="mt-4 min-h-[55vh] w-full resize-none bg-transparent text-[15px] leading-relaxed text-white/80 placeholder-white/25 outline-none"
        />
      </div>

      <aside className="lg:border-l lg:border-white/5 lg:pl-6">
        <h2 className="text-[13px] font-semibold text-white/60">
          Version history
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/30">
          A snapshot is stored on every save.
        </p>
        <ul className="mt-4 space-y-2">
          {versions.map((v, i) => (
            <li
              key={v.id}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <span className="text-xs font-medium text-white/60">
                v{totalVersions - i}
              </span>
              <time className="text-[11px] text-white/30">
                {timeFormat.format(new Date(v.createdAt))}
              </time>
            </li>
          ))}
          {versions.length === 0 && (
            <li className="text-xs text-white/30">No versions yet — save to create one.</li>
          )}
        </ul>

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={
              confirmingDelete
                ? "mt-8 w-full rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
                : "mt-8 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/40 transition hover:border-rose-500/30 hover:text-rose-300"
            }
          >
            {deleting
              ? "Deleting…"
              : confirmingDelete
                ? "Click again to permanently delete"
                : "Delete document"}
          </button>
        )}
      </aside>
    </div>
  );
}
