"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./api";
import { useDictation } from "./useDictation";
import type { InterviewTurn } from "@/lib/types";

interface TopicState {
  id: string;
  label: string;
  description: string;
  answered: number;
}

interface State {
  topics: TopicState[];
  turns: InterviewTurn[];
  pending: InterviewTurn | null;
}

export function InterviewClient({ legacyId }: { legacyId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const dictation = useDictation((text) => setAnswer((a) => (a ? `${a.trimEnd()} ${text}` : text)));

  const load = useCallback(async () => {
    const s = await api<State>(`/api/legacies/${legacyId}/interview`);
    setState(s);
    setTopic((current) => {
      if (current) return current;
      if (s.pending) return s.pending.topic;
      return [...s.topics].sort((a, b) => a.answered - b.answered)[0]?.id ?? null;
    });
    return s;
  }, [legacyId]);

  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    dictation.stop();
    try {
      await api(`/api/legacies/${legacyId}/interview`, { method: "POST", body: JSON.stringify(body) });
      setAnswer("");
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function chooseTopic(id: string) {
    setTopic(id);
    if (state?.pending && state.pending.topic !== id) {
      // Ask a new question in the chosen topic (replaces the unanswered one).
      void post({ action: "next", topic: id });
    }
  }

  if (!state) {
    return error ? <div className="error">{error}</div> : <p className="muted">Loading the interview…</p>;
  }

  const pending = state.pending && state.pending.topic === topic ? state.pending : null;
  const currentTopic = state.topics.find((t) => t.id === topic);
  const topicTurns = state.turns.filter((t) => t.topic === topic).reverse();

  return (
    <div className="interview">
      <aside>
        <div className="eyebrow">Topics</div>
        <div className="topic-list">
          {state.topics.map((t) => (
            <button
              key={t.id}
              className={`topic-btn ${t.id === topic ? "active" : ""}`}
              onClick={() => chooseTopic(t.id)}
              disabled={busy}
            >
              {t.label}
              <span className="muted small"> · {t.answered}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="stack">
        <section className="card">
          {currentTopic && <div className="eyebrow">{currentTopic.label}</div>}

          {pending ? (
            <>
              <div className="question">{pending.question}</div>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Take your time. Tell it the way you'd tell it at the kitchen table."
                rows={7}
                disabled={busy}
                autoFocus
              />
              <div className="row spread" style={{ marginTop: 12 }}>
                <div className="row">
                  {dictation.supported && (
                    <button
                      className="btn btn-sm"
                      onClick={dictation.listening ? dictation.stop : dictation.start}
                      disabled={busy}
                      type="button"
                    >
                      {dictation.listening ? (
                        <>
                          <span className="rec-dot" /> Stop dictation
                        </>
                      ) : (
                        "🎙 Speak your answer"
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => post({ action: "skip", turnId: pending.id, topic })}
                    disabled={busy}
                  >
                    Skip this one
                  </button>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => post({ action: "answer", turnId: pending.id, answer, topic })}
                  disabled={busy || !answer.trim()}
                >
                  {busy ? "Thinking of the next question…" : "Save and continue"}
                </button>
              </div>
            </>
          ) : (
            <div className="stack">
              <p>{currentTopic?.description}</p>
              <button
                className="btn btn-primary"
                onClick={() => topic && post({ action: "next", topic })}
                disabled={busy || !topic}
              >
                {busy ? "Preparing a question…" : "Ask me a question"}
              </button>
            </div>
          )}
          {error && (
            <div className="error small" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </section>

        <p className="small muted">
          Answers are saved as you go. When you&apos;ve answered a batch, open Overview and choose &quot;Learn from new
          answers&quot; to turn them into memories.
        </p>

        {topicTurns.length > 0 && (
          <section className="card stack">
            <h3>Your answers on this topic</h3>
            {topicTurns.map((t) => (
              <div key={t.id} className="transcript-item">
                <div className="small muted">{t.question}</div>
                {editing?.id === t.id ? (
                  <div className="stack">
                    <textarea value={editing.text} onChange={(e) => setEditing({ id: t.id, text: e.target.value })} />
                    <div className="row">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={async () => {
                          await post({ action: "edit", turnId: t.id, answer: editing.text });
                          setEditing(null);
                        }}
                        disabled={busy || !editing.text.trim()}
                      >
                        Save
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{t.answer}</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: t.id, text: t.answer ?? "" })}>
                      Edit
                    </button>
                  </>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
