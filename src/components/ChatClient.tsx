"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "./api";
import { useDictation } from "./useDictation";
import type { ChatMessage } from "@/lib/types";

type UiMessage = Pick<ChatMessage, "id" | "role" | "content" | "speaker">;

const SPEAKER_KEY = "digital-legacy:speaker";

export function ChatClient({ legacyId, name, hasVoice }: { legacyId: string; name: string; hasVoice: boolean }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const dictation = useDictation((text) => setInput((v) => (v ? `${v.trimEnd()} ${text}` : text)));

  useEffect(() => {
    api<{ messages: ChatMessage[] }>(`/api/legacies/${legacyId}/chat`)
      .then((r) => setMessages(r.messages))
      .catch((e) => setError(errorMessage(e)));
    try {
      setSpeaker(localStorage.getItem(SPEAKER_KEY) ?? "");
    } catch {
      /* storage unavailable */
    }
    return () => audioRef.current?.pause();
  }, [legacyId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function rememberSpeaker(v: string) {
    setSpeaker(v);
    try {
      localStorage.setItem(SPEAKER_KEY, v);
    } catch {
      /* storage unavailable */
    }
  }

  async function play(id: string, text: string) {
    audioRef.current?.pause();
    setSpeakingId(id);
    try {
      const res = await fetch(`/api/legacies/${legacyId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Speech failed.");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeakingId(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      setError(errorMessage(e));
      setSpeakingId(null);
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    dictation.stop();
    setError(null);
    setInput("");
    setStreaming(true);

    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: "user", content: text, speaker: speaker || null };
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", content: "", speaker: null }]);

    try {
      const res = await fetch(`/api/legacies/${legacyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, speaker }),
      });
      if (!res.ok || !res.body) {
        throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "No reply.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: full } : x)));
      }
      if (autoSpeak && hasVoice && full.trim()) void play(replyId, full.trim());
    } catch (err) {
      setError(errorMessage(err));
      setMessages((m) => m.filter((x) => x.id !== replyId || x.content));
    } finally {
      setStreaming(false);
    }
  }

  async function clear() {
    if (!confirm("Clear this conversation? Memories and the profile are not affected.")) return;
    await api(`/api/legacies/${legacyId}/chat`, { method: "DELETE" }).catch((e) => setError(errorMessage(e)));
    setMessages([]);
  }

  return (
    <div className="stack">
      <div className="notice small">
        You&apos;re talking with an AI built from {name}&apos;s own recorded memories and words. It is not {name}, and it
        can be wrong.
      </div>

      <div className="row spread">
        <div className="row" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="speaker" style={{ margin: 0 }} className="small">
            You are
          </label>
          <input
            id="speaker"
            type="text"
            value={speaker}
            onChange={(e) => rememberSpeaker(e.target.value)}
            placeholder="e.g. Maya, granddaughter"
            style={{ maxWidth: 260 }}
          />
        </div>
        <div className="row">
          {hasVoice && (
            <label className="row small" style={{ margin: 0, fontWeight: 400 }}>
              <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
              Speak replies aloud
            </label>
          )}
          {messages.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clear} disabled={streaming}>
              Clear conversation
            </button>
          )}
        </div>
      </div>

      <section className="card chat">
        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.length === 0 && (
            <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>
              Say hello, ask about a memory, or ask for advice.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.role === "user" && m.speaker && <div className="meta">{m.speaker}</div>}
              {m.content || (m.role === "assistant" ? <span className="muted">…</span> : null)}
              {m.role === "assistant" && hasVoice && m.content && !streaming && (
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => (speakingId === m.id ? audioRef.current?.pause() : play(m.id, m.content))}
                    style={{ padding: "2px 8px" }}
                  >
                    {speakingId === m.id ? "■ Stop" : "▶ Listen"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={send}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`Talk with ${name}…`}
            rows={2}
            disabled={streaming}
          />
          {dictation.supported && (
            <button
              type="button"
              className="btn"
              onClick={dictation.listening ? dictation.stop : dictation.start}
              aria-label={dictation.listening ? "Stop dictation" : "Speak your message"}
            >
              {dictation.listening ? <span className="rec-dot" /> : "🎙"}
            </button>
          )}
          <button className="btn btn-primary" disabled={streaming || !input.trim()}>
            {streaming ? "…" : "Send"}
          </button>
        </form>
      </section>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
