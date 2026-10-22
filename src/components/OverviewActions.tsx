"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "./api";

export function DistillButton({ legacyId, pending }: { legacyId: string; pending: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api<{ added: number; processed: number }>(`/api/legacies/${legacyId}/distill`, { method: "POST" });
      setResult(`Processed ${r.processed} answers and saved ${r.added} memories.`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <button className="btn btn-primary" onClick={run} disabled={busy || pending === 0}>
        {busy ? "Learning from your answers…" : pending ? `Learn from ${pending} new answer${pending === 1 ? "" : "s"}` : "Up to date"}
      </button>
      {result && <div className="small muted">{result}</div>}
      {error && <div className="error small">{error}</div>}
    </div>
  );
}

export function DeleteLegacyButton({ legacyId, name }: { legacyId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    const typed = window.prompt(
      `This permanently deletes ${name}'s interview, memories, conversations, voice recordings and cloned voice.\n\nType the name to confirm:`,
    );
    if (typed?.trim().toLowerCase() !== name.trim().toLowerCase()) return;
    setBusy(true);
    try {
      await api(`/api/legacies/${legacyId}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (e) {
      alert(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <button className="btn btn-danger btn-sm" onClick={run} disabled={busy}>
      {busy ? "Deleting…" : "Delete this legacy"}
    </button>
  );
}
