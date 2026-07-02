import { FocusRoomPanel } from "@/components/focus-room-panel";

export default async function FocusRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ prompt?: string; agentId?: string }>;
}) {
  const { sessionId } = await params;
  const { prompt, agentId } = await searchParams;
  return <FocusRoomPanel sessionId={sessionId} initialPrompt={prompt ?? ""} draftAgentId={agentId ?? ""} />;
}
