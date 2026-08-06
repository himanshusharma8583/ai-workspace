"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SparklesIcon,
  FileTextIcon,
  ArrowRightIcon,
} from "@/components/auth/icons";

type Source = { id: string; title: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const SUGGESTIONS = [
  "Summarize what's in our workspace",
  "What are our API pagination rules?",
  "What goes into an incident postmortem?",
];

export function ChatPanel({ orgName }: { orgName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    setInput("");
    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          // Send recent turns so follow-up questions have context
          history: messages.slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setMessages(messages);
        return;
      }
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch {
      setError("Could not reach the server.");
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-6">
      <div className="flex-1 space-y-5 overflow-y-auto py-8">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-indigo-300">
              <SparklesIcon className="h-5 w-5" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-tight">
              Chat with {orgName}
            </h1>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/40">
              Ask anything about your documents. Answers are grounded in your
              workspace and cite their sources.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] text-white/60 transition hover:border-indigo-400/40 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, i) =>
          message.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm leading-relaxed text-white shadow-lg shadow-indigo-950/40">
                {message.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
                <div className="prose prose-sm prose-invert max-w-none text-white/85 prose-headings:text-white/90 prose-headings:text-[13px] prose-headings:font-semibold prose-strong:text-white prose-a:text-indigo-300 prose-code:text-indigo-300 prose-code:before:content-none prose-code:after:content-none prose-li:my-0.5 prose-p:my-2 prose-table:text-[13px] prose-th:text-white/70 prose-td:border-white/10 prose-th:border-white/10">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-2.5">
                    {message.sources.map((source) => (
                      <Link
                        key={source.id}
                        href={`/documents/${source.id}`}
                        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition hover:border-indigo-400/40"
                      >
                        <FileTextIcon className="h-3 w-3" />
                        {source.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-300 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-300 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-300 [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="pb-6">
        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-200">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl focus-within:border-indigo-400/40"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your workspace…"
            maxLength={1000}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-white/25 outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-950/50 transition hover:brightness-110 disabled:opacity-40"
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
