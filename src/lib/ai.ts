import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

// The ONLY file that knows which AI provider the app uses. If the Gemini free
// tier changes, swap the model here and nothing else in the app moves.

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

export async function generateDocument(
  prompt: string
): Promise<GeneratedDocument> {
  const response = await model.invoke([
    ["system", SYSTEM_PROMPT],
    ["user", prompt],
  ]);

  const raw =
    typeof response.content === "string"
      ? response.content
      : response.content
          .map((part) =>
            typeof part === "object" && part !== null && "text" in part
              ? String((part as { text: unknown }).text)
              : ""
          )
          .join("");

  // Plain-text format (title line + --- + body) instead of JSON: long Markdown
  // inside a JSON string forces the model to escape every quote and newline,
  // which fails often. Plain text has nothing to escape.
  const match = raw
    .trim()
    .match(/^TITLE:\s*(.+?)\r?\n-{3,}\r?\n([\s\S]+)$/);
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
