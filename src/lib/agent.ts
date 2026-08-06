import { z } from "zod";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { prisma } from "@/lib/prisma";
import { searchChunks, reindexDocument } from "@/lib/rag";
import { geminiModel, groqModel, contentToText, type ChatTurn } from "@/lib/ai";
import { canEdit, type WorkspaceContext } from "@/lib/workspace";

export type AgentAction = {
  type: "created" | "updated";
  documentId: string;
  title: string;
};

export type AgentResult = {
  answer: string;
  sources: { id: string; title: string }[];
  actions: AgentAction[];
};

const MAX_ITERATIONS = 8;

const AGENT_SYSTEM_PROMPT = `You are the AI agent for a team workspace. You can search, read, create and update the organization's documents using tools.

Rules:
- For knowledge questions, ALWAYS use search_documents first; answer only from what you find and mention document titles. If nothing relevant is found, say so.
- When asked to create or update a document, do it with the tools, then briefly confirm what you did. Write document bodies in well-structured Markdown.
- Before updating a document, read it first so you preserve what should be kept.
- Use multiple tool calls when a task needs them (e.g. read several docs, then create a summary).
- Never invent document contents you did not read. Never fabricate owners, dates or decisions.
- Keep final answers concise and in Markdown.`;

// Tools are built per-request as closures over the caller's workspace context:
// every query inside is tenant-scoped, and mutation tools simply don't exist
// for read-only roles.
function buildTools(
  ctx: WorkspaceContext,
  sources: Map<string, { id: string; title: string }>,
  actions: AgentAction[]
): StructuredToolInterface[] {
  const searchDocuments = tool(
    async ({ query }: { query: string }) => {
      const chunks = await searchChunks(ctx.organizationId, query);
      if (chunks.length === 0) return "No matching content found.";
      for (const c of chunks) {
        sources.set(c.documentId, { id: c.documentId, title: c.title });
      }
      return chunks
        .map(
          (c) =>
            `[document: "${c.title}" | id: ${c.documentId}]\n${c.content}`
        )
        .join("\n\n---\n\n");
    },
    {
      name: "search_documents",
      description:
        "Semantic search across the organization's documents. Returns the most relevant excerpts with their document ids.",
      schema: z.object({ query: z.string().describe("What to search for") }),
    }
  );

  const listDocuments = tool(
    async () => {
      const docs = await prisma.document.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 25,
        select: { id: true, title: true, updatedAt: true },
      });
      if (docs.length === 0) return "The workspace has no documents yet.";
      return docs
        .map((d) => `${d.title} (id: ${d.id}, updated ${d.updatedAt.toISOString().slice(0, 10)})`)
        .join("\n");
    },
    {
      name: "list_documents",
      description: "List the organization's documents (newest first).",
      schema: z.object({}),
    }
  );

  const readDocument = tool(
    async ({ documentId }: { documentId: string }) => {
      const doc = await prisma.document.findFirst({
        where: { id: documentId, organizationId: ctx.organizationId },
        select: { id: true, title: true, content: true },
      });
      if (!doc) return "Document not found.";
      sources.set(doc.id, { id: doc.id, title: doc.title });
      const body = typeof doc.content === "string" ? doc.content : "";
      return `# ${doc.title}\n\n${body.slice(0, 12_000)}`;
    },
    {
      name: "read_document",
      description: "Read a document's full content by its id.",
      schema: z.object({ documentId: z.string() }),
    }
  );

  const listRecentActivity = tool(
    async () => {
      const entries = await prisma.activityLog.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          action: true,
          createdAt: true,
          metadata: true,
          user: { select: { name: true, email: true } },
        },
      });
      return entries
        .map((e) => {
          const meta = e.metadata as { title?: string } | null;
          return `${e.createdAt.toISOString()} ${e.user.name ?? e.user.email} ${e.action}${meta?.title ? ` — "${meta.title}"` : ""}`;
        })
        .join("\n");
    },
    {
      name: "list_recent_activity",
      description:
        "List the organization's recent activity log entries (who did what, when).",
      schema: z.object({}),
    }
  );

  const createDocument = tool(
    async ({ title, body }: { title: string; body: string }) => {
      const document = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            title: title.slice(0, 200),
            content: body,
            authorId: ctx.userId,
            organizationId: ctx.organizationId,
          },
          select: { id: true, title: true },
        });
        await tx.documentVersion.create({
          data: { documentId: document.id, content: { title: document.title, body } },
        });
        await tx.activityLog.create({
          data: {
            action: "document.create",
            metadata: { documentId: document.id, title: document.title, via: "agent" },
            userId: ctx.userId,
            organizationId: ctx.organizationId,
          },
        });
        return document;
      });
      actions.push({ type: "created", documentId: document.id, title: document.title });
      try {
        await reindexDocument(document.id, ctx.organizationId, document.title, body);
      } catch (error) {
        console.error("Reindex failed for document", document.id, error);
      }
      return `Created document "${document.title}" (id: ${document.id}).`;
    },
    {
      name: "create_document",
      description:
        "Create a new document in the workspace. Body must be Markdown.",
      schema: z.object({
        title: z.string().describe("Short, specific document title"),
        body: z.string().describe("Full document content in Markdown"),
      }),
    }
  );

  const updateDocument = tool(
    async ({
      documentId,
      title,
      body,
    }: {
      documentId: string;
      title?: string;
      body: string;
    }) => {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.document.findFirst({
          where: { id: documentId, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!existing) return null;
        const document = await tx.document.update({
          where: { id: documentId },
          data: { ...(title && { title: title.slice(0, 200) }), content: body },
          select: { id: true, title: true },
        });
        await tx.documentVersion.create({
          data: { documentId, content: { title: document.title, body } },
        });
        await tx.activityLog.create({
          data: {
            action: "document.update",
            metadata: { documentId, title: document.title, via: "agent" },
            userId: ctx.userId,
            organizationId: ctx.organizationId,
          },
        });
        return document;
      });
      if (!result) return "Document not found.";
      actions.push({ type: "updated", documentId: result.id, title: result.title });
      try {
        await reindexDocument(result.id, ctx.organizationId, result.title, body);
      } catch (error) {
        console.error("Reindex failed for document", result.id, error);
      }
      return `Updated document "${result.title}" (id: ${result.id}). A version snapshot was saved.`;
    },
    {
      name: "update_document",
      description:
        "Replace a document's content (and optionally title). Read the document first. A version snapshot of the new state is stored automatically.",
      schema: z.object({
        documentId: z.string(),
        title: z.string().optional().describe("New title, only if it should change"),
        body: z.string().describe("The complete new Markdown content"),
      }),
    }
  );

  const readTools = [searchDocuments, listDocuments, readDocument, listRecentActivity];
  const writeTools = [createDocument, updateDocument];
  return canEdit(ctx.role) ? [...readTools, ...writeTools] : readTools;
}

export async function runAgent(
  ctx: WorkspaceContext,
  question: string,
  history: ChatTurn[]
): Promise<AgentResult> {
  const sources = new Map<string, { id: string; title: string }>();
  const actions: AgentAction[] = [];
  const tools = buildTools(ctx, sources, actions);
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  // Groq (gpt-oss-120b) is primary — agent loops make several round trips and
  // it's much faster; Gemini is the per-call fallback.
  const groqWithTools = groqModel.bindTools(tools);
  const geminiWithTools = geminiModel.bindTools(tools);

  const messages: BaseMessage[] = [
    new SystemMessage(AGENT_SYSTEM_PROMPT),
    ...history.map((turn) =>
      turn.role === "user"
        ? new HumanMessage(turn.content)
        : new AIMessage(turn.content)
    ),
    new HumanMessage(question),
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response: AIMessage;
    try {
      response = await groqWithTools.invoke(messages);
    } catch (error) {
      console.warn("Groq agent call failed, falling back to Gemini:", error);
      response = await geminiWithTools.invoke(messages);
    }
    messages.push(response);

    const toolCalls = response.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        answer: contentToText(response.content),
        sources: [...sources.values()],
        actions,
      };
    }

    for (const call of toolCalls) {
      const selected = toolsByName.get(call.name);
      let output: string;
      try {
        output = selected
          ? String(await selected.invoke(call.args))
          : `Unknown tool: ${call.name}`;
      } catch (error) {
        output = `Tool failed: ${error instanceof Error ? error.message : "unknown error"}`;
      }
      messages.push(
        new ToolMessage({ content: output, tool_call_id: call.id ?? call.name })
      );
    }
  }

  return {
    answer:
      "I ran out of steps before finishing. Try breaking the request into smaller parts.",
    sources: [...sources.values()],
    actions,
  };
}
