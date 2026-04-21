export type AssistantStatus = 'idle' | 'thinking' | 'streaming';

interface BaseMessage {
  id: string;
  createdAt: number;
}

export interface TextMessage extends BaseMessage {
  kind: 'text';
  role: 'user' | 'assistant';
  text: string;
}

export interface ThinkingMessage extends BaseMessage {
  kind: 'thinking';
  text: string;
}

export interface ToolUseMessage extends BaseMessage {
  kind: 'tool_use';
  name: string;
  input: unknown;
}

export interface ToolResultMessage extends BaseMessage {
  kind: 'tool_result';
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface PermissionMessage extends BaseMessage {
  kind: 'permission';
  requestId: string;
  name: string;
  input: unknown;
  status: 'pending' | 'allowed' | 'denied';
}

export interface ErrorMessage extends BaseMessage {
  kind: 'error';
  text: string;
}

export type Message =
  | TextMessage
  | ThinkingMessage
  | ToolUseMessage
  | ToolResultMessage
  | PermissionMessage
  | ErrorMessage;

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}
