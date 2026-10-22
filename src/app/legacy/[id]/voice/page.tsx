import { notFound } from "next/navigation";
import { LegacyNav } from "@/components/LegacyNav";
import { VoiceClient } from "@/components/VoiceClient";
import { getLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacy = getLegacy(id);
  if (!legacy) notFound();
  return (
    <>
      <LegacyNav legacy={legacy} active="voice" />
      <VoiceClient legacyId={id} name={legacy.name} />
    </>
  );
}
