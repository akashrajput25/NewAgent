export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: MessageMetadata;
  created_at: string;
}

export interface MessageMetadata {
  model?: string;
  tokens_used?: number;
  tool_calls?: ToolCall[];
  image_url?: string;
  is_image_generation?: boolean;
  is_voice?: boolean;
}

export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
  result?: unknown;
}

export interface Conversation {
  id: number;
  title: string;
  personality: PersonalityMode;
  created_at: string;
  updated_at: string;
  message_count?: number;
  pinned?: boolean;
}

export type PersonalityMode = 'professional' | 'casual' | 'creative' | 'coding' | 'sarcastic' | 'vibe';

export interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_delta' | 'tool_end' | 'done' | 'error';
  data: string | ToolCall | unknown;
}

export interface GenerateImageRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
}

export interface GeneratedImage {
  id: number;
  prompt: string;
  url: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface ChatRequest {
  message: string;
  image?: string;
  personality?: PersonalityMode;
}
