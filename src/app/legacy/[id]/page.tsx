import Link from "next/link";
import { notFound } from "next/navigation";
import { LegacyNav } from "@/components/LegacyNav";
import { MemoryList } from "@/components/MemoryList";
import { DeleteLegacyButton, DistillButton } from "@/components/OverviewActions";
import { getLegacySummary, listMemories } from "@/lib/db";
import type { PersonalityProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECTIONS: { key: keyof PersonalityProfile; label: string }[] = [
  { key: "speakingStyle", label: "How they talk" },
  { key: "signaturePhrases", label: "Signature phrases" },
  { key: "humor", label: "Humor" },
  { key: "values", label: "Values" },
  { key: "opinions", label: "Opinions and beliefs" },
  { key: "decisionMaking", label: "How they decide" },
  { key: "relationships", label: "People who matter" },
  { key: "lifeTimeline", label: "Life timeline" },
  { key: "adviceThemes", label: "Advice they give" },
];

export default async function LegacyOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacy = getLegacySummary(id);
  if (!legacy) notFound();
  const memories = listMemories(id);
  const p = legacy.profile;

  return (
    <>
      <LegacyNav legacy={legacy} active="overview" />

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <section className="card stack">
          <div className="eyebrow">Step 1</div>
          <h3>Interview</h3>
          <p className="muted small">{legacy.answeredCount} questions answered so far. Aim for 50 or more for a rich character.</p>
          <Link href={`/legacy/${id}/interview`} className="btn">
            Continue the interview
          </Link>
        </section>
        <section className="card stack">
          <div className="eyebrow">Step 2</div>
          <h3>Build memories and personality</h3>
          <p className="muted small">Turns new answers into memories and updates how the character talks and thinks.</p>
          <DistillButton legacyId={id} pending={legacy.pendingDistillCount} />
        </section>
        <section className="card stack">
          <div className="eyebrow">Step 3</div>
          <h3>Voice</h3>
          <p className="muted small">{legacy.voiceId ? "A cloned voice is ready." : "Record a few minutes of speech to create the voice."}</p>
          <Link href={`/legacy/${id}/voice`} className="btn">
            {legacy.voiceId ? "Manage voice" : "Record voice"}
          </Link>
        </section>
        <section className="card stack">
          <div className="eyebrow">Step 4</div>
          <h3>Talk</h3>
          <p className="muted small">Have a conversation with {legacy.name}&apos;s Digital Legacy.</p>
          <Link href={`/legacy/${id}/chat`} className="btn btn-primary">
            Start talking
          </Link>
        </section>
      </div>

      <section className="card">
        <h2>Personality profile</h2>
        {p.summary ? <p>{p.summary}</p> : <p className="muted">The profile fills in as answers are processed in Step 2.</p>}
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          {SECTIONS.map(({ key, label }) => {
            const value = p[key];
            const empty = Array.isArray(value) ? value.length === 0 : !value;
            if (empty) return null;
            return (
              <div key={key}>
                <h3>{label}</h3>
                {Array.isArray(value) ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {value.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{value}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ marginTop: 16 }}>
        <MemoryList legacyId={id} memories={memories} />
      </div>

      <div className="row" style={{ marginTop: 32 }}>
        <DeleteLegacyButton legacyId={id} name={legacy.name} />
      </div>
    </>
  );
}
