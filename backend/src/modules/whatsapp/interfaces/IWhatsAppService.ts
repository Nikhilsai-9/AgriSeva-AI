import { IUser, WhatsappUser, WhatsappUsersResponse } from "#root/shared/index.js";

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
  msgType?: string;
  mediaUrl?: string;
  senderName?: string;
  status?: 'sending' | 'sent' | 'error' | 'delivered';
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

export interface IncomingWhatsAppMessageExtra {
  msgId?: string;
  msgType?: string;
  interactive?: {
    type?: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  audio?: { id: string; mime_type?: string };
  voice?: { id: string; mime_type?: string };
  image?: { id: string; mime_type?: string; caption?: string };
}

export interface IWhatsAppService {
  getThreads(user: IUser, page?: number, limit?: number, search?: string): Promise<Thread[]>;
  getThreadDetails(user: IUser, phoneNumber: string, date: string): Promise<Message[]>;
  isUserConversationOwner(user: IUser, phoneNumber: string): Promise<boolean>;
  sendMessage(
    userId: string,
    phoneNumber: string,
    messageText: string,
  ): Promise<void>;
  getInactiveUsers(skip: number, limit: number): Promise<WhatsappUsersResponse>;
  getAllUsers(): Promise<WhatsappUsersResponse>;
  getUniqueUsers(): Promise<number>;
  handleIncomingWhatsAppCloudMessage(
    from: string,
    text: string,
    phoneNumberId?: string,
    extra?: IncomingWhatsAppMessageExtra,
  ): Promise<void>;
}
