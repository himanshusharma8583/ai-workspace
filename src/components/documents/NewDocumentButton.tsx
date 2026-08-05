"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon, FileTextIcon } from "@/components/auth/icons";

export function NewDocumentButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const doc = await res.json();
      router.push(`/documents/${doc.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-60"
    >
      {loading ? (
        <SpinnerIcon className="h-4 w-4 animate-spin" />
      ) : (
        <FileTextIcon className="h-4 w-4" />
      )}
      New document
    </button>
  );
}
