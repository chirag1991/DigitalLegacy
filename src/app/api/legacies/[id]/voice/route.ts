import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DATA_DIR, setVoice } from "@/lib/db";
import { cloneVoice, deleteVoice, voiceConfigured } from "@/lib/elevenlabs";
import { cleanText, handle, HttpError, requireLegacy, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_SAMPLE_BYTES = 20 * 1024 * 1024;
const MAX_SAMPLES = 25;
const EXT_BY_TYPE: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
};
const TYPE_BY_EXT: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  ogg: "audio/ogg",
};

const samplesDir = (legacyId: string) => path.join(DATA_DIR, "voice-samples", legacyId);
const SAFE_NAME = /^[a-f0-9-]+\.(wav|mp3|m4a|webm|ogg)$/;

async function listSamples(legacyId: string) {
  const dir = samplesDir(legacyId);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const out = [];
  for (const name of names.filter((n) => SAFE_NAME.test(n))) {
    const stat = await fs.stat(path.join(dir, name));
    out.push({ name, bytes: stat.size, createdAt: stat.mtime.toISOString() });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Voice status and recorded samples. With ?sample=<name>, streams that recording for playback. */
export const GET = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const sample = new URL(req.url).searchParams.get("sample");
  if (sample) {
    if (!SAFE_NAME.test(sample)) throw new HttpError(400, "Invalid sample name.");
    const data = await fs.readFile(path.join(samplesDir(legacy.id), sample)).catch(() => null);
    if (!data) throw new HttpError(404, "Sample not found.");
    const ext = sample.split(".").pop()!;
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPE_BY_EXT[ext] ?? "application/octet-stream" } });
  }
  return NextResponse.json({
    voiceId: legacy.voiceId,
    consentAt: legacy.voiceConsentAt,
    configured: voiceConfigured(),
    samples: await listSamples(legacy.id),
  });
});

/**
 * multipart/form-data with field "action":
 *  - "upload": field "file" (an audio recording) → saved as a voice sample
 *  - "clone":  fields "consent" = "yes" and "consentName" (must match the person's name)
 *              → creates (or re-creates) the cloned voice from all saved samples
 */
export const POST = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Expected form data.");
  });
  const action = form.get("action");

  if (action === "upload") {
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "No audio file received.");
    if (file.size > MAX_SAMPLE_BYTES) throw new HttpError(413, "That recording is too large (20 MB max).");
    const type = (file.type || "").split(";")[0].toLowerCase();
    const ext = EXT_BY_TYPE[type];
    if (!ext) throw new HttpError(415, "Please upload a WAV, MP3, M4A, WebM or OGG audio file.");
    const existing = await listSamples(legacy.id);
    if (existing.length >= MAX_SAMPLES) throw new HttpError(400, `You can keep up to ${MAX_SAMPLES} samples.`);

    await fs.mkdir(samplesDir(legacy.id), { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(samplesDir(legacy.id), name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ samples: await listSamples(legacy.id) }, { status: 201 });
  }

  if (action === "clone") {
    if (form.get("consent") !== "yes") throw new HttpError(400, "Consent is required before creating a voice.");
    const typed = cleanText(form.get("consentName"), 200).toLowerCase();
    if (typed !== legacy.name.trim().toLowerCase()) {
      throw new HttpError(400, `To confirm consent, type the name exactly as saved: ${legacy.name}`);
    }
    const samples = await listSamples(legacy.id);
    if (samples.length === 0) throw new HttpError(400, "Record or upload at least one voice sample first.");

    const files = await Promise.all(
      samples.map(async (s) => {
        const data = await fs.readFile(path.join(samplesDir(legacy.id), s.name));
        const ext = s.name.split(".").pop()!;
        return { data: new Blob([new Uint8Array(data)], { type: TYPE_BY_EXT[ext] }), filename: s.name };
      }),
    );

    const newVoiceId = await cloneVoice(legacy.name, files);
    if (legacy.voiceId) await deleteVoice(legacy.voiceId).catch((e) => console.error("Old voice delete failed:", e));
    setVoice(legacy.id, newVoiceId, new Date().toISOString());
    return NextResponse.json({ voiceId: newVoiceId });
  }

  throw new HttpError(400, "Unknown action.");
});

/** With ?sample=<name> deletes one recording; otherwise deletes the cloned voice (samples are kept). */
export const DELETE = handle(async (req: Request, ctx: RouteCtx) => {
  const legacy = await requireLegacy(ctx);
  const sample = new URL(req.url).searchParams.get("sample");
  if (sample) {
    if (!SAFE_NAME.test(sample)) throw new HttpError(400, "Invalid sample name.");
    await fs.rm(path.join(samplesDir(legacy.id), sample), { force: true });
    return NextResponse.json({ samples: await listSamples(legacy.id) });
  }
  if (legacy.voiceId) await deleteVoice(legacy.voiceId);
  setVoice(legacy.id, null, null);
  return NextResponse.json({ ok: true });
});
