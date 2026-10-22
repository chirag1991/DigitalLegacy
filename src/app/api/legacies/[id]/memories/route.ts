import { NextResponse } from "next/server";
import { addMemories, deleteMemory, listMemories, touchLegacy } from "@/lib/db";
import { cleanText, handle, HttpError, readJson, requireLegacy, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  return NextResponse.json({ memories: listMemories(legacy.id), profile: legacy.profile });
});

/** Add a memory by hand (e.g. a story typed in from a letter or journal). */
export const POST = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const body = await readJson<{ title?: unknown; content?: unknown; era?: unknown; tags?: unknown }>(req);
  const title = cleanText(body.title, 200);
  const content = cleanText(body.content, 10000);
  if (!title || !content) throw new HttpError(400, "A memory needs a title and some text.");
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => cleanText(t, 40)).filter(Boolean).slice(0, 8) : [];
  addMemories(legacy.id, [{ title, content, era: cleanText(body.era, 80), tags }]);
  touchLegacy(legacy.id);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const memoryId = new URL(req.url).searchParams.get("memoryId");
  if (!memoryId) throw new HttpError(400, "memoryId is required.");
  deleteMemory(legacy.id, memoryId);
  return NextResponse.json({ ok: true });
});
