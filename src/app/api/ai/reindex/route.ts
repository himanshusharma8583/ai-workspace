import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspaceContext } from "@/lib/workspace";
import { reindexDocument } from "@/lib/rag";
import { Role } from "@/generated/prisma/enums";
import { aiLimiter, enforceRateLimit } from "@/lib/ratelimit";

// Rebuilds the whole org's search index. Admin-only: it makes one embedding
// API call per document, so it's not something every member should trigger.
export async function POST() {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (ctx.role !== Role.OWNER && ctx.role !== Role.ADMIN) {
    return NextResponse.json(
      { error: "Only owners and admins can rebuild the index." },
      { status: 403 }
    );
  }

  // One reindex makes an embedding call per document — the strictest budget
  // of any endpoint, so it shares the tight AI limiter.
  const limited = await enforceRateLimit(aiLimiter, ctx.userId);
  if (limited) return limited;

  const documents = await prisma.document.findMany({
    where: { organizationId: ctx.organizationId },
    select: { id: true, title: true, content: true },
  });

  let indexed = 0;
  const failures: string[] = [];
  for (const doc of documents) {
    try {
      await reindexDocument(
        doc.id,
        ctx.organizationId,
        doc.title,
        typeof doc.content === "string" ? doc.content : ""
      );
      indexed++;
    } catch (error) {
      console.error("Reindex failed for document", doc.id, error);
      failures.push(doc.id);
    }
  }

  return NextResponse.json({ indexed, failed: failures.length });
}
