import type { Message } from "@/types/sauna";

type DisplayMessage = Pick<Message, "role" | "status" | "content">;

export function isAssistantMessageWorking(
  message: DisplayMessage,
  busy: boolean,
): boolean {
  return Boolean(
    busy &&
      message.role === "assistant" &&
      (message.status === "pending" || message.status === "partial") &&
      !message.content.trim(),
  );
}

export function shouldRenderChatMessage(
  message: DisplayMessage,
  busy: boolean,
): boolean {
  if (message.role !== "assistant" || message.content.trim()) {
    return true;
  }
  return isAssistantMessageWorking(message, busy);
}
