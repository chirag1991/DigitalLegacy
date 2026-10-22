"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";
import { toWav } from "./wav";

interface Sample {
  name: string;
  bytes: number;
  createdAt: string;
}
interface VoiceState {
  voiceId: string | null;
  consentAt: string | null;
  configured: boolean;
  samples: Sample[];
}

/** Natural, varied passages to read aloud — varied sentences give a better clone. */
const SCRIPTS = [
  "Let me tell you about the morning I remember best. The kitchen smelled of coffee and toast, the radio was playing something old, and nobody was in a hurry. I didn't know then how much I'd miss ordinary days like that.",
  "If you ever feel lost, here's what I'd say: slow down, take a breath, and do the next right thing. You don't have to solve your whole life today. Just today. And call someone who loves you. That part matters more than you think.",
  "Now, I'm not saying I was always right — ask anyone! But I learned a few things. Work hard, be kind to people who can't do anything for you, and never trust a recipe that says 'quick and easy'.",
  "When I think about the people I love, I feel lucky. Really lucky. We laughed a lot, we argued sometimes, and we always found our way back to the same table. I hope you keep doing that, even when I'm not there.",
  "One, two, three. Monday, Tuesday, Wednesday. Is it raining again? Oh, that's wonderful news! Hmm, let me think about that for a moment. Well, I'll be honest with you — I don't quite remember.",
];

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function VoiceClient({ legacyId, name }: { legacyId: string; name: string }) {
  const [state, setState] = useState<VoiceState | null>(null);
  const [scriptIdx, setScriptIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentName, setConsentName] = useState("");
  const [testText, setTestText] = useState(`Hello, it's me, ${name.split(" ")[0]}. It's so good to hear from you.`);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const base = `/api/legacies/${legacyId}/voice`;
  const load = useCallback(async () => setState(await api<VoiceState>(base)), [base]);

  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [load]);

  async function upload(file: Blob) {
    const form = new FormData();
    form.append("action", "upload");
    form.append("file", file, "sample");
    const res = await api<{ samples: Sample[] }>(base, { method: "POST", body: form });
    setState((s) => (s ? { ...s, samples: res.samples } : s));
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const raw = new Blob(chunksRef.current, { type: rec.mimeType });
        setBusy("Saving recording…");
        try {
          await upload(await toWav(raw));
          setScriptIdx((i) => (i + 1) % SCRIPTS.length);
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(null);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Microphone access was blocked. Allow the microphone for this site and try again.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setError(null);
    setBusy("Uploading…");
    try {
      for (const f of files) await upload(f);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function removeSample(sample: string) {
    try {
      const res = await api<{ samples: Sample[] }>(`${base}?sample=${encodeURIComponent(sample)}`, { method: "DELETE" });
      setState((s) => (s ? { ...s, samples: res.samples } : s));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function createVoice() {
    setError(null);
    setBusy("Creating the voice… this can take up to a minute.");
    try {
      const form = new FormData();
      form.append("action", "clone");
      form.append("consent", consent ? "yes" : "no");
      form.append("consentName", consentName);
      await api(base, { method: "POST", body: form });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function removeVoice() {
    if (!confirm("Delete the cloned voice? Your recordings are kept, so you can create it again.")) return;
    try {
      await api(base, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function testVoice() {
    setError(null);
    setBusy("Generating speech…");
    try {
      const res = await fetch(`/api/legacies/${legacyId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Speech failed.");
      const url = URL.createObjectURL(await res.blob());
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      await audioRef.current.play();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!state) return error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>;

  const totalMb = state.samples.reduce((s, x) => s + x.bytes, 0) / 1024 / 1024;
  // 16-bit mono 44.1 kHz WAV ≈ 5.3 MB per minute.
  const approxMinutes = totalMb / 5.3;

  return (
    <div className="stack">
      {!state.configured && (
        <div className="notice">
          Voice features need an ElevenLabs API key. Add <code>ELEVENLABS_API_KEY</code> to <code>.env.local</code> and
          restart the app. You can still record samples now.
        </div>
      )}

      {state.voiceId ? (
        <section className="card stack">
          <div className="row spread">
            <h2 style={{ margin: 0 }}>Voice is ready</h2>
            <span className="pill pill-ok">Active</span>
          </div>
          {state.consentAt && (
            <p className="small muted">Consent recorded {new Date(state.consentAt).toLocaleString()}.</p>
          )}
          <label htmlFor="test">Try it</label>
          <textarea id="test" value={testText} onChange={(e) => setTestText(e.target.value)} rows={3} />
          <div className="row">
            <button className="btn btn-primary" onClick={testVoice} disabled={!!busy || !testText.trim()}>
              ▶ Play
            </button>
            <button className="btn btn-danger btn-sm" onClick={removeVoice} disabled={!!busy}>
              Delete voice
            </button>
          </div>
        </section>
      ) : null}

      <section className="card stack">
        <h2>1. Record your voice</h2>
        <p className="muted small">
          Read each passage naturally, as if talking to someone you love. Use a quiet room and keep the microphone about
          a hand&apos;s width away. Aim for 1–3 minutes in total; more clean audio gives a closer match.
        </p>
        <div className="script">{SCRIPTS[scriptIdx]}</div>
        <div className="row spread">
          <div className="row">
            {recording ? (
              <button className="btn btn-primary" onClick={stopRecording}>
                <span className="rec-dot" /> Stop · {seconds}s
              </button>
            ) : (
              <button className="btn btn-primary" onClick={startRecording} disabled={!!busy}>
                🎙 Record this passage
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setScriptIdx((i) => (i + 1) % SCRIPTS.length)}
              disabled={recording}
            >
              Different passage
            </button>
          </div>
          <label className="btn btn-sm" style={{ margin: 0 }}>
            Upload audio files
            <input type="file" accept="audio/*" multiple hidden onChange={onFile} />
          </label>
        </div>

        <div>
          <div className="row spread">
            <h3 style={{ margin: 0 }}>Recordings ({state.samples.length})</h3>
            <span className="small muted">≈ {approxMinutes.toFixed(1)} min (WAV)</span>
          </div>
          {state.samples.length === 0 && <p className="muted small">No recordings yet.</p>}
          {state.samples.map((s, i) => (
            <div key={s.name} className="row spread memory">
              <span className="small">
                Recording {i + 1} · {fmtSize(s.bytes)}
              </span>
              <div className="row">
                <audio controls preload="none" src={`${base}?sample=${encodeURIComponent(s.name)}`} style={{ height: 32 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => removeSample(s.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>2. Consent and create</h2>
        <div className="notice">
          A cloned voice can say things the real person never said. Only create a voice for <strong>yourself</strong>, or
          for someone who has given clear, informed permission. You can delete the voice at any time.
        </div>
        <label className="row" style={{ alignItems: "flex-start", fontWeight: 400 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 5 }} />
          <span>
            I am {name}, or I have {name}&apos;s explicit permission, and I consent to these recordings being used to
            create a synthetic voice for their Digital Legacy.
          </span>
        </label>
        <div>
          <label htmlFor="consentName">Type the full name to confirm</label>
          <input id="consentName" type="text" value={consentName} onChange={(e) => setConsentName(e.target.value)} placeholder={name} />
        </div>
        <button
          className="btn btn-primary"
          onClick={createVoice}
          disabled={!!busy || !consent || !consentName.trim() || state.samples.length === 0 || !state.configured}
        >
          {state.voiceId ? "Re-create voice from all recordings" : "Create voice"}
        </button>
      </section>

      {busy && <div className="notice">{busy}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
