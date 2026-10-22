import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DATA_DIR, deleteLegacy, getLegacySummary } from "@/lib/db";
import { deleteVoice, voiceConfigured } from "@/lib/elevenlabs";
import { handle, requireLegacy, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  return NextResponse.json({ legacy: getLegacySummary(legacy.id), voiceConfigured: voiceConfigured() });
});

/** Deletes everything: database rows, local voice samples and the cloned voice at ElevenLabs. */
export const DELETE = handle(async (_req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  if (legacy.voiceId && voiceConfigured()) {
    await deleteVoice(legacy.voiceId).catch((e) => console.error("Voice delete failed:", e));
  }
  await fs.rm(path.join(DATA_DIR, "voice-samples", legacy.id), { recursive: true, force: true });
  deleteLegacy(legacy.id);
  return NextResponse.json({ ok: true });
});
