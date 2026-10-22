import { speak } from "@/lib/elevenlabs";
import { cleanText, handle, HttpError, readJson, requireLegacy, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Speaks text in the person's cloned voice. Returns audio/mpeg. */
export const POST = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  if (!legacy.voiceId) throw new HttpError(400, "No voice has been created for this legacy yet.");
  const { text } = await readJson<{ text?: unknown }>(req);
  const clean = cleanText(text, 4000);
  if (!clean) throw new HttpError(400, "Nothing to say.");

  const upstream = await speak(legacy.voiceId, clean);
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
});
