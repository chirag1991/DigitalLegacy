import { notFound } from "next/navigation";
import { InterviewClient } from "@/components/InterviewClient";
import { LegacyNav } from "@/components/LegacyNav";
import { getLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacy = getLegacy(id);
  if (!legacy) notFound();
  return (
    <>
      <LegacyNav legacy={legacy} active="interview" />
      <InterviewClient legacyId={id} />
    </>
  );
}
