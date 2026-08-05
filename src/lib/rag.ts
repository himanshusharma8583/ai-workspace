import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// --- Embeddings (Gemini free embedding model, 768 dims) ---

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 768;

async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMS,
        })),
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { embeddings: { values: number[] }[] };

  // Truncated-dimension embeddings aren't pre-normalized; normalize so cosine
  // distance behaves consistently
  return data.embeddings.map(({ values }) => {
    const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
    return values.map((v) => v / norm);
  });
}

// --- Chunking ---

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    // Prefer to break at a paragraph or line boundary near the end
    if (end < clean.length) {
      const paragraphBreak = clean.lastIndexOf("\n\n", end);
      const lineBreak = clean.lastIndexOf("\n", end);
      const breakAt = paragraphBreak > start + CHUNK_SIZE / 2 ? paragraphBreak : lineBreak;
      if (breakAt > start + CHUNK_SIZE / 2) end = breakAt;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.filter(Boolean);
}

// --- Indexing ---

// Rebuilds the search index for one document. Called after saves; callers
// catch errors so an embedding hiccup never breaks a save.
export async function reindexDocument(
  documentId: string,
  organizationId: string,
  title: string,
  body: string
): Promise<void> {
  const chunks = chunkText(`${title}\n\n${body}`);

  await prisma.documentChunk.deleteMany({ where: { documentId } });
  if (chunks.length === 0) return;

  const embeddings = await embedTexts(chunks, "RETRIEVAL_DOCUMENT");

  await prisma.$transaction(
    chunks.map((content, i) => {
      const vector = JSON.stringify(embeddings[i]);
      return prisma.$executeRaw`
        INSERT INTO "DocumentChunk"
          ("id", "chunkIndex", "content", "embedding", "documentId", "organizationId")
        VALUES
          (${randomUUID()}, ${i}, ${content}, ${vector}::vector, ${documentId}, ${organizationId})`;
    })
  );
}

// --- Retrieval ---

export type RetrievedChunk = {
  content: string;
  documentId: string;
  title: string;
  similarity: number;
};

export async function searchChunks(
  organizationId: string,
  query: string,
  limit = 6
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await embedTexts([query], "RETRIEVAL_QUERY");
  const vector = JSON.stringify(queryEmbedding);

  // Tenant filter and vector search in one indexed query
  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      dc."content",
      dc."documentId",
      d."title",
      1 - (dc."embedding" <=> ${vector}::vector) AS "similarity"
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d."id" = dc."documentId"
    WHERE dc."organizationId" = ${organizationId}
      AND dc."embedding" IS NOT NULL
    ORDER BY dc."embedding" <=> ${vector}::vector
    LIMIT ${limit}`;
}
