import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

// The ONLY file that knows which AI providers the app uses. Tasks are routed
// per model strength: Gemini Flash for document drafting and RAG answers,
// OpenAI's gpt-oss-120b (served free on Groq) for fast meeting summarization.
// If a free tier changes, swap models here and nothing else in the app moves.

const generatedDocumentSchema = z.object({
  title: z
    .string()
    .describe("A short, specific document title. Plain text, max 80 characters."),
  body: z
    .string()
    .describe(
      "The full document content in Markdown: headings, lists, tables where useful."
    ),
});

export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>;

// The "-latest" alias tracks Google's current Flash model — older pinned
// models get retired for new accounts (gemini-2.5-flash already 404s here)
const model = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You write clear, well-structured workplace documents.
Rules:
- Write in Markdown with meaningful headings.
- Be concrete and practical; prefer short paragraphs and lists over walls of text.
- If the request is vague, make sensible assumptions and note them at the end under "Assumptions".
- Never include a top-level title heading in the body — the title is stored separately.

Respond in EXACTLY this format — first line is the title, then a separator line, then the body:
TITLE: <the document title>
---
<the full Markdown content>`;

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part
          ? String((part as { text: unknown }).text)
          : ""
      )
      .join("");
  }
  return "";
}

// Plain-text format (title line + --- + body) instead of JSON: long Markdown
// inside a JSON string forces the model to escape every quote and newline,
// which fails often. Plain text has nothing to escape.
function parseTitleBody(raw: string): GeneratedDocument {
  const match = raw.trim().match(/^TITLE:\s*(.+?)\r?\n-{3,}\r?\n([\s\S]+)$/);
  if (!match) {
    throw new Error("Model response did not match the expected format");
  }
  const parsed = generatedDocumentSchema.safeParse({
    title: match[1].trim(),
    body: match[2].trim(),
  });
  if (!parsed.success) {
    throw new Error(`Model returned unexpected shape: ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function generateDocument(
  prompt: string
): Promise<GeneratedDocument> {
  const response = await model.invoke([
    ["system", SYSTEM_PROMPT],
    ["user", prompt],
  ]);
  return parseTitleBody(contentToText(response.content));
}

// --- Meeting summaries (Groq) ---

const groqModel = new ChatGroq({
  model: "openai/gpt-oss-120b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0.3,
  maxRetries: 2,
});

const MEETING_SYSTEM_PROMPT = `You turn raw meeting transcripts into crisp, actionable summary documents.
Structure the body with these Markdown sections (omit a section only if truly empty):
## Overview — 2-3 sentences: what the meeting was about and its outcome.
## Key decisions — bullet list of decisions actually made.
## Action items — a Markdown table: | Action | Owner | Due |. Use "—" when unknown.
## Open questions — unresolved points needing follow-up.
## Notable discussion — brief context worth remembering, if any.
Rules:
- Only state things supported by the transcript; never invent owners or dates.
- Keep names as they appear in the transcript.
- Title should name the meeting topic, not just say "Meeting summary".

Respond in EXACTLY this format — first line is the title, then a separator line, then the body:
TITLE: <the document title>
---
<the full Markdown content>`;

export async function summarizeMeeting(
  transcript: string
): Promise<GeneratedDocument> {
  const response = await groqModel.invoke([
    ["system", MEETING_SYSTEM_PROMPT],
    ["user", `Meeting transcript:\n\n${transcript}`],
  ]);
  return parseTitleBody(contentToText(response.content));
}

// --- RAG chat ---

export type ChatTurn = { role: "user" | "assistant"; content: string };

const CHAT_SYSTEM_PROMPT = `You are the AI assistant for a team workspace. Answer questions using ONLY the workspace documents provided as context.
Rules:
- Ground every claim in the context. If the context doesn't contain the answer, say so plainly and suggest what document might need to be created.
- Mention document titles when referring to them.
- Be concise and direct. Use Markdown lists when helpful.`;

export async function answerQuestion(
  question: string,
  history: ChatTurn[],
  context: { title: string; content: string }[]
): Promise<string> {
  const contextBlock =
    context.length === 0
      ? "(no relevant documents found)"
      : context
          .map((c, i) => `[${i + 1}] From "${c.title}":\n${c.content}`)
          .join("\n\n---\n\n");

  const response = await model.invoke([
    ["system", CHAT_SYSTEM_PROMPT],
    ...history.map((turn) => [turn.role === "user" ? "user" : "assistant", turn.content] as [string, string]),
    [
      "user",
      `Workspace context:\n\n${contextBlock}\n\n---\n\nQuestion: ${question}`,
    ],
  ]);

  return typeof response.content === "string"
    ? response.content
    : response.content
        .map((part) =>
          typeof part === "object" && part !== null && "text" in part
            ? String((part as { text: unknown }).text)
            : ""
        )
        .join("");
}
