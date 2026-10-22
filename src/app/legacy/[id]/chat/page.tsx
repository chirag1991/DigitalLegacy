import { notFound } from "next/navigation";
import { ChatClient } from "@/components/ChatClient";
import { LegacyNav } from "@/components/LegacyNav";
import { getLegacy } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const legacy = getLegacy(id);
  if (!legacy) notFound();
  return (
    <>
      <LegacyNav legacy={legacy} active="chat" />
      <ChatClient legacyId={id} name={legacy.name} hasVoice={!!legacy.voiceId && !!process.env.ELEVENLABS_API_KEY} />
    </>
  );
}
