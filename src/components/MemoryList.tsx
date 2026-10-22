"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "./api";
import type { Memory } from "@/lib/types";

export function MemoryList({ legacyId, memories }: { legacyId: string; memories: Memory[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [era, setEra] = useState("");
  const [error, setError] = useState<string | null>(null);

  const q = filter.trim().toLowerCase();
  const shown = q
    ? memories.filter((m) => `${m.title} ${m.content} ${m.tags.join(" ")} ${m.era}`.toLowerCase().includes(q))
    : memories;

  async function remove(id: string) {
    if (!confirm("Delete this memory?")) return;
    try {
      await api(`/api/legacies/${legacyId}/memories?memoryId=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/legacies/${legacyId}/memories`, {
        method: "POST",
        body: JSON.stringify({ title, content, era }),
      });
      setTitle("");
      setContent("");
      setEra("");
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="card">
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Memories ({memories.length})</h2>
        <button className="btn btn-sm" onClick={() => setAdding((a) => !a)}>
          {adding ? "Cancel" : "Add a memory"}
        </button>
      </div>

      {adding && (
        <form className="stack" onSubmit={add} style={{ marginTop: 16 }}>
          <p className="small muted">Write it in first person, the way you would tell it. Letters and journal entries work well.</p>
          <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input type="text" placeholder="When (e.g. 1970s, college years)" value={era} onChange={(e) => setEra(e.target.value)} />
          <textarea placeholder="The memory…" value={content} onChange={(e) => setContent(e.target.value)} required />
          {error && <div className="error small">{error}</div>}
          <button className="btn btn-primary" disabled={!title.trim() || !content.trim()}>
            Save memory
          </button>
        </form>
      )}

      {memories.length > 4 && (
        <input
          type="text"
          placeholder="Search memories…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ marginTop: 16 }}
        />
      )}

      <div style={{ marginTop: 8 }}>
        {memories.length === 0 && (
          <p className="muted" style={{ marginTop: 12 }}>
            No memories yet. Answer some interview questions, then choose &quot;Learn from new answers&quot;.
          </p>
        )}
        {shown.map((m) => (
          <article key={m.id} className="memory">
            <div className="row spread">
              <h3 style={{ margin: 0 }}>{m.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => remove(m.id)} aria-label={`Delete ${m.title}`}>
                Delete
              </button>
            </div>
            {m.era && <div className="small muted">{m.era}</div>}
            <p style={{ margin: "6px 0 0" }}>{m.content}</p>
            {m.tags.length > 0 && (
              <div className="tags">
                {m.tags.map((t) => (
                  <span key={t} className="pill">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
