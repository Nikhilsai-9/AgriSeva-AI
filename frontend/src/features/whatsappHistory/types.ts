// Core types for WhatsApp History feature
export interface ToolCall {
  name: string;
  args: Record<string, any>;
  id?: string;
  response?: any;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'expert' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  status?: 'sending' | 'sent' | 'error' | 'delivered';
  msgType?: 'text' | 'image' | 'audio' | 'voice';
  mediaUrl?: string;
  senderName?: string;
}

export interface Thread {
  id: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  lastMessageDate?: string;
  unreadCount?: number;
  farmerName?: string;
  language?: string;
  status?: string;
  avatar?: string;
}
