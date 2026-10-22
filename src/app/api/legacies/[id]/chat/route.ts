import { NextResponse } from "next/server";
import { findRelevantMemories, streamPersonaReply } from "@/lib/ai";
import { addChat, clearChat, listChat, listMemories, listTurns } from "@/lib/db";
import { cleanText, handle, HttpError, readJson, requireLegacy, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = handle(async (_req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  return NextResponse.json({ messages: listChat(legacy.id) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  clearChat(legacy.id);
  return NextResponse.json({ ok: true });
});

/** Sends a message and streams the persona's reply as plain text. The reply is saved when complete. */
export const POST = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const body = await readJson<{ message?: unknown; speaker?: unknown }>(req);
  const message = cleanText(body.message, 8000);
  const speaker = cleanText(body.speaker, 120) || null;
  if (!message) throw new HttpError(400, "Message is empty.");

  const memories = listMemories(legacy.id);
  const turns = listTurns(legacy.id);
  if (memories.length === 0 && !turns.some((t) => t.answer)) {
    throw new HttpError(400, `${legacy.name}'s legacy has no memories yet. Start with the interview.`);
  }

  // Retrieve using the new message plus the last thing the persona said, for conversational context.
  const history = listChat(legacy.id, 40);
  const lastReply = [...history].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const relevant = findRelevantMemories(`${message} ${message} ${lastReply}`, memories, turns);

  addChat(legacy.id, "user", message, speaker);
  const stream = streamPersonaReply({ legacy, history: listChat(legacy.id, 40), relevant, speaker });

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        if (full.trim()) addChat(legacy.id, "assistant", full.trim(), null);
      } catch (err) {
        console.error("Chat stream failed:", err);
        controller.enqueue(encoder.encode("\n\n[Sorry — the connection was interrupted. Please try again.]"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body$, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
});
