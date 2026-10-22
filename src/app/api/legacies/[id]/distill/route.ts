import { NextResponse } from "next/server";
import { distillAnswers } from "@/lib/ai";
import { addMemories, listTurns, markTurnsDistilled, saveProfile } from "@/lib/db";
import { handle, requireLegacy, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 25;

/**
 * Turns new interview answers into first-person memories and updates the
 * personality profile. Processes answers in batches so large backlogs work.
 */
export const POST = handle(async (_req: Request, ctx: RouteCtx) => {
  let legacy = await requireLegacy(ctx);
  const pending = listTurns(legacy.id).filter((t) => t.answer && !t.distilled);
  if (pending.length === 0) return NextResponse.json({ added: 0, processed: 0 });

  let added = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const result = await distillAnswers(legacy, batch);
    addMemories(legacy.id, result.memories);
    saveProfile(legacy.id, result.profile);
    markTurnsDistilled(batch.map((t) => t.id));
    legacy = { ...legacy, profile: result.profile };
    added += result.memories.length;
  }
  return NextResponse.json({ added, processed: pending.length, profile: legacy.profile });
});
