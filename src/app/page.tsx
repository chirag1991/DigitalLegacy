import Link from "next/link";
import { CreateLegacyForm } from "@/components/CreateLegacyForm";
import { listLegacies } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const legacies = listLegacies();

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Your stories, your voice</div>
        <h1>Leave more than photographs.</h1>
        <p>
          Record your memories, your humor and the way you see the world through a guided interview. Digital Legacy
          turns them into a character your family can talk with, in your own voice, for years to come.
        </p>
      </section>

      <div className="grid grid-2">
        <CreateLegacyForm />

        <section className="stack">
          <h2>Legacies</h2>
          {legacies.length === 0 && <p className="muted">No legacies yet. Create the first one to get started.</p>}
          {legacies.map((l) => (
            <Link key={l.id} href={`/legacy/${l.id}`} className="card legacy-card">
              <h3>{l.name}</h3>
              <div className="row small">
                <span className="pill">{l.answeredCount} answers</span>
                <span className="pill">{l.memoryCount} memories</span>
                {l.voiceId ? <span className="pill pill-ok">Voice ready</span> : <span className="pill">No voice yet</span>}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
