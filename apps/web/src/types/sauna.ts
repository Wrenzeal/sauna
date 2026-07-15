export type AgentStatus = "idle" | "thinking" | "in_conversation" | "offline";
export type SessionType = "lobby" | "focus_room" | "board_meeting";
export type TurnStatus = "created" | "draft" | "queued" | "streaming" | "completed" | "failed" | "cancelled";
export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "partial" | "complete" | "done" | "failed";

export interface AgentProfile {
  id: string;
  displayName: string;
  role: string;
  quote: string;
  avatarSeed: string;
  accent: string;
  status: AgentStatus;
  currentSessionId?: string;
  lastActivity: string;
  sourceKind: "public" | "private";
}

export interface SessionSummary {
  id: string;
  title: string;
  sessionType: SessionType;
  currentStatus: "idle" | "active" | "thinking" | "streaming" | "completed" | "failed" | "disabled";
  agentIds: string[];
  providerConfigId?: string;
  agentDisplayName?: string;
  agentAvatarEmoji?: string;
  lastMessagePreview?: string;
  lastActivityAt?: string;
}

export interface ApiUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface ApiWorkspace {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
}

export interface AuthIdentity {
  user: ApiUser;
  workspace: ApiWorkspace;
}

export interface AuthStartResult {
  email: string;
  dev_code?: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
}

export interface AuthVerifyResult {
  token: string;
  identity: AuthIdentity;
  expires_at: string;
}

export interface ProviderConfig {
  id: string;
  workspace_id: string;
  provider_name: string;
  base_url: string;
  chat_model: string;
  embedding_model: string;
  masked_api_key: string;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  last_tested_at?: string | null;
}

export interface CreateProviderConfigInput {
  provider_name: string;
  base_url: string;
  api_key: string;
  chat_model: string;
  embedding_model?: string;
  is_default?: boolean;
}

export interface UpdateProviderConfigInput {
  provider_name: string;
  base_url: string;
  api_key?: string;
  chat_model: string;
  embedding_model?: string;
  is_default?: boolean;
}

export interface DiscoverModelsInput {
  base_url: string;
  api_key: string;
}

export interface FetchedModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}


export interface DistillationJob {
  id: string;
  workspace_id: string;
  target_name: string;
  target_type: string;
  input_brief: string;
  source_urls: string[];
  uploaded_source_ids: string[];
  provider_config_id?: string;
  status: "queued" | "researching" | "extracting" | "validating" | "completed" | "failed";
  progress_message: string;
  result_agent_id?: string;
  result_skill_markdown?: string;
  error_message: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateDistillationJobInput {
  target_name: string;
  target_type?: "person" | "topic";
  input_brief?: string;
  source_urls?: string[];
  uploaded_source_ids?: string[];
  provider_config_id?: string;
}

export interface ApiAgent {
  id: string;
  workspace_id?: string;
  display_name: string;
  slug: string;
  avatar_emoji: string;
  role_summary: string;
  status: string;
  is_public_template: boolean;
  current_version_id: string;
  created_at: string;
  updated_at: string;
}

export interface FocusSessionSummary {
  id: string;
  workspace_id: string;
  session_type: SessionType;
  title: string;
  current_status: string;
  agent_id: string;
  provider_config_id: string;
  agent_display_name: string;
  agent_avatar_emoji: string;
  last_message_preview: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface FocusSessionPage {
  sessions: FocusSessionSummary[];
  next_cursor: string;
  has_more: boolean;
}

export interface FocusSession {
  id: string;
  workspace_id: string;
  session_type: SessionType;
  title: string;
  current_status: string;
  agent_id: string;
  agent_version_id: string;
  provider_config_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  workspace_id: string;
  session_id: string;
  turn_id: string;
  agent_id?: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  error?: string;
  created_at: string;
}

export interface Turn {
  id: string;
  workspace_id: string;
  session_id: string;
  interaction_id: string;
  user_message_id: string;
  assistant_message_id?: string;
  status: TurnStatus;
  created_at: string;
  updated_at: string;
}

export interface TurnCreated {
  turn: Turn;
  user_message: Message;
}

export interface ConsultationStarted {
  session: FocusSession;
  turn: Turn;
  user_message: Message;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ProviderTestChatResult {
  ok: boolean;
  status: string;
  content: string;
  latency_ms: number;
  usage: TokenUsage;
}

export interface StreamEventShape {
  event_id: string;
  sequence: number;
  turn_id: string;
  session_id: string;
  message_id: string;
  timestamp: string;
  event_type:
    | "turn.created"
    | "assistant.message.created"
    | "assistant.delta"
    | "turn.completed"
    | "turn.failed"
    | "stream.replay";
  delta?: string;
  error?: string;
  usage?: TokenUsage;
  interaction_id?: string;
  agent_id?: string;
}
