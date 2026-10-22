import "server-only";
import { ConfigError } from "./ai";

const BASE = "https://api.elevenlabs.io/v1";

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new ConfigError("ELEVENLABS_API_KEY is not set. Add it to .env.local and restart the server.");
  return key;
}

export function voiceConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

async function failure(res: Response, action: string): Promise<Error> {
  let detail = "";
  try {
    const body = (await res.json()) as { detail?: { message?: string } | string };
    detail = typeof body.detail === "string" ? body.detail : body.detail?.message ?? "";
  } catch {
    /* ignore */
  }
  return new Error(`ElevenLabs could not ${action} (HTTP ${res.status})${detail ? `: ${detail}` : ""}`);
}

/** Instant voice cloning from one or more recorded samples. Returns the new voice id. */
export async function cloneVoice(name: string, samples: { data: Blob; filename: string }[]): Promise<string> {
  const form = new FormData();
  form.append("name", `Digital Legacy – ${name}`);
  form.append("description", `Voice of ${name}, recorded with their consent for their Digital Legacy.`);
  form.append("remove_background_noise", "true");
  for (const s of samples) form.append("files", s.data, s.filename);

  const res = await fetch(`${BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey() },
    body: form,
  });
  if (!res.ok) throw await failure(res, "create the voice");
  const json = (await res.json()) as { voice_id?: string };
  if (!json.voice_id) throw new Error("ElevenLabs did not return a voice id.");
  return json.voice_id;
}

export async function deleteVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${BASE}/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey() },
  });
  if (!res.ok && res.status !== 404) throw await failure(res, "delete the voice");
}

/** Text-to-speech in the cloned voice. Returns an MP3 stream. */
export async function speak(voiceId: string, text: string): Promise<Response> {
  const res = await fetch(
    `${BASE}/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok || !res.body) throw await failure(res, "generate speech");
  return res;
}
