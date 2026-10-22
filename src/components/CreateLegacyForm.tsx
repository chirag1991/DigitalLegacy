"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "./api";
import type { Legacy } from "@/lib/types";

export function CreateLegacyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [intro, setIntro] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { legacy } = await api<{ legacy: Legacy }>("/api/legacies", {
        method: "POST",
        body: JSON.stringify({ name, birthYear, intro }),
      });
      router.push(`/legacy/${legacy.id}/interview`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Start a legacy</h2>
      <p className="muted small">
        This is for the person whose stories will be recorded. They answer the interview themselves, in their own
        words.
      </p>
      <div>
        <label htmlFor="name">Full name</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </div>
      <div>
        <label htmlFor="year">Birth year (optional)</label>
        <input
          id="year"
          type="number"
          inputMode="numeric"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          min={1890}
          max={new Date().getFullYear()}
        />
      </div>
      <div>
        <label htmlFor="intro">A few words about yourself (optional)</label>
        <textarea
          id="intro"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="Where you're from, who your family is, what you'd like them to remember…"
          maxLength={2000}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create and begin the interview"}
      </button>
    </form>
  );
}
