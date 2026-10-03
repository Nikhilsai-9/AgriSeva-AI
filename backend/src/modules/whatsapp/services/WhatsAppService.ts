import axios from 'axios';
import { appConfig } from '#root/config/app.js';
import type {
  IWhatsAppService,
  Thread,
  Message,
  ToolCall,
  IncomingWhatsAppMessageExtra,
} from '../interfaces/IWhatsAppService.js';
import { InternalServerError, NotFoundError, UnauthorizedError } from 'routing-controllers';
import { aiConfig } from '#root/config/ai.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable, optional } from 'inversify';
import { WhatsappUser, WhatsappUsersResponse, MongoDatabase, IUser } from '#root/shared/index.js';
import { GROUNDED_ANSWER_TYPES } from '#root/modules/groundedAnswer/types.js';
import type { IGroundedAnswerService } from '#root/modules/groundedAnswer/interfaces/IGroundedAnswerService.js';
import type { IContextService } from '#root/modules/context/interfaces/IContextService.js';
import { normalizePhoneNumber } from '#root/utils/phoneNumber.js';
import {
  detectLanguageFromText,
  getLanguageDisplayName,
} from '#root/modules/groundedAnswer/services/GroundedAnswerService.js';
import { Collection, ObjectId } from 'mongodb';

export interface IWhatsAppSession {
  _id?: ObjectId | string;
  phoneNumber: string;
  rawFrom: string;
  userId?: ObjectId | string;
  userName?: string;
  preferredLanguage?: string;
  languageSelectedExplicitly?: boolean;
  pendingFirstMessage?: {
    text?: string;
    msgType?: string;
    mediaId?: string;
    mimeType?: string;
    caption?: string;
    timestamp?: Date;
  };
  lastMessageAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  history?: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    msgType?: string;
  }[];
}

@injectable()
export class WhatsAppService implements IWhatsAppService {
  private sessionsCollection?: Collection<IWhatsAppSession>;

  constructor(
    @inject(GLOBAL_TYPES.UserRepository)
    private readonly userRepo: IUserRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
    @optional()
    @inject(GROUNDED_ANSWER_TYPES.GroundedAnswerService)
    private readonly groundedAnswerService?: IGroundedAnswerService,
    @optional()
    @inject(GLOBAL_TYPES.ContextService)
    private readonly contextService?: IContextService,
  ) {}
  // private readonly baseUrl = aiConfig.serverIP;
  private readonly baseUrl =
    'http://' + aiConfig.serverIP + ':' + aiConfig.whatsAppServerPort;
  private readonly WHATSAPP_SERVER_URL = aiConfig.WHATSAPP_SERVER_URL;
  private readonly WA_WEBHOOK_API_KEY = appConfig.WA_WEBHOOK_API_KEY;

  async getThreads(): Promise<Thread[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/threads`);
      const data = response.data;

      // const threads: Thread[] = (data.threads as any[])
      //   .filter((t: any) =>
      //     /^\d{12}$/.test(t.thread_id) &&
      //     t.metadata &&
      //     Object.keys(t.metadata).length > 0 &&
      //     t.updated_at !== null
      //   )
      //   .map((t: any) => ({
      //     id: t.thread_id,
      //     phoneNumber: t.thread_id,
      //     lastMessage: t.metadata.thread_name || 'No message available',
      //     lastMessageTimestamp: new Date(t.updated_at),
      //     unreadCount: 0,
      //   }));
      const uniqueThreadsMap = new Map<string, Thread>();

      (data.threads as any[])
        .filter(
          (t: any) =>
            /^\d{12}(-\d{4}-\d{2}-\d{2})?$/.test(t.thread_id) &&
            t.metadata &&
            Object.keys(t.metadata).length > 0 &&
            t.updated_at !== null,
        )
        .forEach((t: any) => {
          const phoneNumber = t.thread_id.split('-')[0];

          // Keep latest updated thread for each phone number
          const existing = uniqueThreadsMap.get(phoneNumber);

          if (
            !existing ||
            new Date(t.updated_at) > existing.lastMessageTimestamp
          ) {
            let lastMessageDate = '';
            if (t.thread_id.includes('-')) {
              lastMessageDate = t.thread_id.split('-').slice(1).join('-');
            } else {
              lastMessageDate = new Date(t.updated_at).toLocaleDateString(
                'en-CA',
                {timeZone: 'Asia/Kolkata'},
              );
            }

            uniqueThreadsMap.set(phoneNumber, {
              id: phoneNumber,
              phoneNumber,
              lastMessage: t.metadata.thread_name || 'No message available',
              lastMessageTimestamp: new Date(t.updated_at),
              lastMessageDate,
              unreadCount: 0,
            });
          }
        });

      const threads: Thread[] = Array.from(uniqueThreadsMap.values());

      return threads;
    } catch (error) {
      console.error('Error fetching threads from LangGraph:', error);
      throw new InternalServerError('Failed to fetch threads from LangGraph');
    }
  }

  async getThreadDetails(
    phoneNumber: string,
    date: string,
  ): Promise<Message[]> {
    try {
      let threadId = phoneNumber;
      if (!threadId.includes('-')) {
        threadId = `${phoneNumber}-${date}`;
      }

      const response = await axios.get(
        `${this.baseUrl}/threads/${threadId}/state`,
      );
      const data = response.data;

      const messages = (data.values?.messages as any[]) || [];
      const formattedMessages: Message[] = [];

      // 1. First, map all tool responses in the entire thread
      const toolResponsesMap: Record<string, any> = {};
      messages.forEach((msg: any) => {
        if (msg.type === 'tool') {
          let response =
            msg.artifact?.structured_content?.result || msg.content;
          if (typeof response === 'string' && response.startsWith('{')) {
            try {
              response = JSON.parse(response);
            } catch (e) {}
          }
          toolResponsesMap[msg.tool_call_id] = response;
        }
      });

      // 2. Iterate through all messages to build the conversation
      messages.forEach((msg: any, idx: number) => {
        if (msg.type === 'human') {
          formattedMessages.push({
            id: msg.id || `h-${idx}`,
            role: 'user',
            content: typeof msg.content === 'string' ? msg.content : '',
            timestamp: new Date(data.created_at || Date.now()),
          });
        } else if (msg.type === 'ai') {
          const toolCalls: ToolCall[] =
            msg.tool_calls?.map((tc: any) => ({
              name: tc.name,
              args: tc.args,
              id: tc.id,
              response: toolResponsesMap[tc.id],
            })) || [];

          // Only add AI message if it has content OR tool calls
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('\n')
                : '';

          if (content || toolCalls.length > 0) {
            formattedMessages.push({
              id: msg.id || `a-${idx}`,
              role: 'assistant',
              content:
                content || (toolCalls.length > 0 ? 'Executing tools...' : ''),
              timestamp: new Date(data.created_at || Date.now()),
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
          }
        }
      });

      return formattedMessages;
    } catch (error: any) {
      // Thread not found
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundError(
          `No thread history found for ${phoneNumber} on ${date}`,
        );
      }

      // LangGraph server errors
      if (axios.isAxiosError(error) && error.response?.status >= 500) {
        throw new InternalServerError(
          `LangGraph service is currently unavailable`,
        );
      }

      // Network / connection issues
      if (axios.isAxiosError(error) && !error.response) {
        throw new InternalServerError(`Unable to connect to LangGraph service`);
      }

      // Fallback
      throw new InternalServerError(
        `Failed to fetch thread details for ${phoneNumber}`,
      );
    }
  }

  async sendMessage(
    userId: string,
    phoneNumber: string,
    messageText: string,
  ): Promise<void> {
    try {
      console.log('[WhatsAppService] sendMessage called with:', {
        userId,
        phoneNumber,
        messageText,
      });

      const user = await this.userRepo.findById(userId);
      console.log('[WhatsAppService] User found:', user ? user._id : 'null');

      if (!user || user.role == 'expert')
        throw new UnauthorizedError(
          "You don't have permission to send message!",
        );

      const sendBy = user.firstName + ' ' + user.lastName;

      const webhookUrl = appConfig.WA_SEND_MESSAGE_WEBHOOK_API_URL;
      console.log('[WhatsAppService] Webhook URL:', webhookUrl);
      console.log('[WhatsAppService] Webhook API Key configured:', !!appConfig.WA_WEBHOOK_API_KEY);

      const payload = {
        phoneNumber,
        messageText,
        sendBy,
        userId: user._id.toString(),
      };
      console.log('[WhatsAppService] Sending payload to webhook:', payload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': appConfig.WA_WEBHOOK_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      console.log('[WhatsAppService] Webhook response status:', response.status);
      console.log('[WhatsAppService] Webhook response ok:', response.ok);

      const contentType = response.headers.get('content-type');
      console.log('[WhatsAppService] Response content-type:', contentType);

      let responseData;

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      console.log('[WhatsAppService] Webhook response data:', responseData);

      if (!response.ok) {
        throw new Error(
          `Failed to send message: ${response.status} - ${responseData}`,
        );
      }

      console.log('[WhatsAppService] Message sent successfully via webhook');
    } catch (error: any) {
      console.error(
        `[WhatsAppService] Error sending WhatsApp message to ${phoneNumber}:`,
        error.response?.data || error.message,
      );
      console.error('[WhatsAppService] Full error:', error);
      const detail = error.response?.data?.message || error.message;
      throw new InternalServerError(`WhatsApp API Error: ${detail}`);
    }
  }

  async getInactiveUsers(
    skip: number,
    limit: number,
  ): Promise<WhatsappUsersResponse> {

    try {
      const response = await axios.get(`${this.WHATSAPP_SERVER_URL}/whatsapp/users`, {
        params: {
          isPaginated: true,
          skip,
          limit,
        },
        headers: {
          'x-internal-api-key': this.WA_WEBHOOK_API_KEY,
        },
      });

      const usersResponse = response.data as WhatsappUsersResponse;

      return usersResponse;    
      } catch (error) {
      console.error('Error fetching inactive WhatsApp users:', error);

      throw new InternalServerError('Failed to fetch inactive WhatsApp users');
    }
  }

  async getAllUsers(): Promise<WhatsappUsersResponse> {
    try {
      const response = await axios.get(`${this.WHATSAPP_SERVER_URL}/whatsapp/users`, {
        params: {
          isPaginated: false,
        },
        headers: {
          'x-internal-api-key': this.WA_WEBHOOK_API_KEY,
        },
      });

      const usersResponse = response.data as WhatsappUsersResponse;

      return usersResponse;    
      } catch (error) {
      console.error('Error fetching inactive WhatsApp users:', error);

      throw new InternalServerError('Failed to fetch inactive WhatsApp users');
    }
  }

  async getUniqueUsers(): Promise<number> {
    try {
      const response = await axios.get(`${this.WHATSAPP_SERVER_URL}/whatsapp/users/count`, {
        params: {
          isPaginated: false,
        },
        headers: {
          'x-internal-api-key': this.WA_WEBHOOK_API_KEY,
        },
      });

      const uniqueUsersCount = response.data.uniqueUserCount;

      return uniqueUsersCount;    
    } catch (error) {
      console.error('Error fetching unique WhatsApp users count:', error);
      return 0;
    }
  }

  private getCloudToken(): string {
    return (
      process.env.META_WA_ACCESS_TOKEN ||
      process.env.WHATSAPP_CLOUD_API_TOKEN ||
      process.env.META_ACCESS_TOKEN ||
      ''
    ).trim();
  }

  private getDefaultPhoneId(): string {
    return (
      process.env.META_WA_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      '104239857281928'
    ).trim();
  }

  private async getSessionsCollection(): Promise<Collection<IWhatsAppSession>> {
    if (!this.sessionsCollection) {
      this.sessionsCollection = await this.mongoDatabase.getCollection<IWhatsAppSession>('whatsapp_sessions');
      try {
        await this.sessionsCollection.createIndex({ phoneNumber: 1 }, { unique: true });
        await this.sessionsCollection.createIndex({ rawFrom: 1 });
      } catch (err: any) {
        // Ignore index creation errors if index already exists
      }
    }
    return this.sessionsCollection;
  }

  /**
   * Dispatches an interactive WhatsApp list message (e.g. for one-click language selection)
   */
  private async sendInteractiveListMessage(
    to: string,
    phoneNumberId: string,
    payload: {
      header?: string;
      body: string;
      footer?: string;
      button: string;
      sections: {
        title: string;
        rows: { id: string; title: string; description?: string }[];
      }[];
    },
  ): Promise<any> {
    const cloudToken = this.getCloudToken();
    const targetPhoneId = phoneNumberId || this.getDefaultPhoneId();

    if (!cloudToken) {
      console.warn('[WhatsAppService] No Meta Cloud API token found. Interactive message not dispatched.');
      return null;
    }

    const graphUrl = `https://graph.facebook.com/v21.0/${targetPhoneId}/messages`;
    try {
      const res = await axios.post(
        graphUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            ...(payload.header ? { header: { type: 'text', text: payload.header } } : {}),
            body: { text: payload.body },
            ...(payload.footer ? { footer: { text: payload.footer } } : {}),
            action: {
              button: payload.button,
              sections: payload.sections,
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${cloudToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        },
      );
      console.log(`[WhatsAppService] Interactive list message delivered to ${to}:`, res.data);
      return res.data;
    } catch (err: any) {
      console.error(
        '[WhatsAppService] Error posting interactive list to Meta Cloud API:',
        err.response?.data || err.message,
      );
      // Fallback: send text message with language options if interactive fails
      const textFallback = `${payload.body}\n\n1. తెలుగు (Telugu)\n2. हिन्दी (Hindi)\n3. தமிழ் (Tamil)\n4. ಕನ್ನಡ (Kannada)\n5. English\n\nReply with your language name.`;
      return this.sendTextMessage(to, targetPhoneId, textFallback);
    }
  }

  /**
   * One-click language selector using Meta WhatsApp interactive list message
   */
  private async sendLanguageSelectionMenu(
    to: string,
    phoneNumberId: string,
    page: number = 1,
  ): Promise<void> {
    if (page === 1) {
      const rows = [
        { id: 'lang_te-IN', title: 'తెలుగు (Telugu)', description: 'ఆంధ్రప్రదేశ్ & తెలంగాణ' },
        { id: 'lang_hi-IN', title: 'हिन्दी (Hindi)', description: 'उत्तर व मध्य भारत' },
        { id: 'lang_ta-IN', title: 'தமிழ் (Tamil)', description: 'தமிழ்நாடு' },
        { id: 'lang_kn-IN', title: 'ಕನ್ನಡ (Kannada)', description: 'ಕರ್ನಾಟಕ' },
        { id: 'lang_en-IN', title: 'English', description: 'All India' },
        { id: 'lang_mr-IN', title: 'मराठी (Marathi)', description: 'महाराष्ट्र' },
        { id: 'lang_bn-IN', title: 'বাংলা (Bengali)', description: 'পশ্চিমবঙ্গ & ত্রিপুরা' },
        { id: 'lang_gu-IN', title: 'ગુજરાતી (Gujarati)', description: 'ગુજરાત' },
        { id: 'lang_pa-IN', title: 'ਪੰਜਾਬੀ (Punjabi)', description: 'ਪੰਜਾਬ & ਹਰਿਆਣਾ' },
        { id: 'lang_page_2', title: '🌐 More / మరిన్ని (Page 2)', description: 'Odia, Assamese, Urdu, etc.' },
      ];

      await this.sendInteractiveListMessage(to, phoneNumberId, {
        header: 'AgriSeva-AI',
        body: 'నమస్తే! దయచేసి మీ భాషను ఎంచుకోండి.\nनमस्ते! कृपया अपनी भाषा चुनें.\nPlease select your preferred language:',
        footer: 'AgriSeva-AI • 23 Languages',
        button: 'Select Language',
        sections: [{ title: 'Popular Languages', rows }],
      });
    } else {
      const rows = [
        { id: 'lang_ml-IN', title: 'മലയാളം (Malayalam)', description: 'കേരളം' },
        { id: 'lang_od-IN', title: 'ଓଡ଼ିଆ (Odia)', description: 'ଓଡ଼ିଶା' },
        { id: 'lang_as-IN', title: 'অসমীয়া (Assamese)', description: 'অসম' },
        { id: 'lang_ur-IN', title: 'اردو (Urdu)', description: 'All India' },
        { id: 'lang_mai-IN', title: 'मैथिली (Maithili)', description: 'बिहार & झारखंड' },
        { id: 'lang_kok-IN', title: 'कोंकणी (Konkani)', description: 'गोवा' },
        { id: 'lang_ne-IN', title: 'नेपाली (Nepali)', description: 'सिक्किम & प. बंगाल' },
        { id: 'lang_ks-IN', title: 'کٲشُر (Kashmiri)', description: 'جموں و کشمیر' },
        { id: 'lang_doi-IN', title: 'डोगरी (Dogri)', description: 'जम्मू' },
        { id: 'lang_page_1', title: '⬅️ Back to Page 1', description: 'Telugu, Hindi, Tamil, English...' },
      ];

      await this.sendInteractiveListMessage(to, phoneNumberId, {
        header: 'AgriSeva-AI',
        body: 'Additional official Indian languages / మరిన్ని అధికారిక భాషలు:',
        footer: 'AgriSeva-AI • 23 Languages',
        button: 'Choose Language',
        sections: [{ title: 'Regional Languages', rows }],
      });
    }
  }

  /**
   * Sends an outbound text message to the WhatsApp user
   */
  private async sendTextMessage(
    to: string,
    phoneNumberId: string,
    text: string,
  ): Promise<any> {
    const cloudToken = this.getCloudToken();
    const targetPhoneId = phoneNumberId || this.getDefaultPhoneId();

    if (!cloudToken) {
      console.log('[WhatsAppService] Meta token not set. Simulated outbound message to', to, ':\n', text);
      return null;
    }

    const graphUrl = `https://graph.facebook.com/v21.0/${targetPhoneId}/messages`;
    try {
      const res = await axios.post(
        graphUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${cloudToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
      console.log(`[WhatsAppService] Meta text message delivered to ${to}:`, res.data);
      return res.data;
    } catch (err: any) {
      console.error(
        '[WhatsAppService] Error posting text message to Meta Cloud API:',
        err.response?.data || err.message,
      );
      return null;
    }
  }

  /**
   * Downloads media binary (voice notes or crop images) from Meta Graph API
   */
  private async downloadMetaMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const token = this.getCloudToken();
    if (!token) throw new Error('Meta API token is not configured');

    const metaMediaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const metaRes = await axios.get(metaMediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const fileUrl = metaRes.data?.url;
    const mimeType = metaRes.data?.mime_type || 'application/octet-stream';
    if (!fileUrl) throw new Error(`Could not obtain media URL for id ${mediaId}`);

    const binaryRes = await axios.get(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return {
      buffer: Buffer.from(binaryRes.data),
      mimeType,
    };
  }

  /**
   * Transcribes incoming WhatsApp voice notes using Sarvam STT with Gemini audio fallback
   */
  private async transcribeAudio(buffer: Buffer, mimeType: string, langCode: string): Promise<string> {
    const sarvamKey = appConfig.sarvamAPI || process.env.SARVAM_API_KEY;
    if (sarvamKey) {
      try {
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimeType }), 'voice_note.ogg');
        formData.append('language_code', langCode || 'unknown');
        const res = await fetch('https://api.sarvam.ai/speech-to-text', {
          method: 'POST',
          headers: { 'api-subscription-key': sarvamKey },
          body: formData,
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data?.transcript?.trim()) {
            return data.transcript.trim();
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppService] Sarvam STT attempt error, trying Gemini audio:', err.message);
      }
    }

    // Gemini audio fallback
    const geminiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const model = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const cleanMime = mimeType.split(';')[0] || 'audio/ogg';
        const res = await axios.post(
          url,
          {
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: cleanMime,
                      data: buffer.toString('base64'),
                    },
                  },
                  {
                    text: 'Please transcribe the speech in this audio voice note word-for-word in the native spoken language. Output only the verbatim transcription without any prefix, formatting, or commentary.',
                  },
                ],
              },
            ],
          },
          { timeout: 25000 },
        );
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (gemErr: any) {
        console.warn('[WhatsAppService] Gemini audio transcription error:', gemErr.message);
      }
    }

    return '';
  }

  /**
   * Diagnoses crop images using Gemini Multimodal Vision with strict agricultural grounding
   */
  private async processCropImage(
    buffer: Buffer,
    mimeType: string,
    caption: string,
    langCode: string,
  ): Promise<string> {
    const geminiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return 'Crop image received. Vision service is currently unavailable. Please describe the symptoms in text.';
    }

    const model = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    const prompt = `You are AgriSeva-AI, the National Agricultural Multilingual Advisory Expert.
Analyze this crop image and user's query: "${caption || 'What problem does this plant have and what is the treatment?'}"

Provide an agricultural advisory response:
1. Visual Assessment: Identify the crop and visible symptoms (disease, pest damage, nutrient deficiency, weather stress).
2. Probable Cause: State the likely cause.
3. Cultural & Organic Management: Preventive and organic measures (e.g. neem oil, sanitation, water drainage).
4. Chemical Treatment (if severe): CIBRC-approved recommendation with exact dosage per liter/acre, and mandatory safety precautions (gloves, masks, pre-harvest interval).
5. Disclaimer: If symptoms are ambiguous or uncertain, clearly state uncertainty and advise taking a sample to the nearest Krishi Vigyan Kendra (KVK).

Keep paragraphs concise, structured with bullet points and emojis, suitable for reading on WhatsApp.`;

    const cleanMime = mimeType.split(';')[0] || 'image/jpeg';
    try {
      const res = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: cleanMime,
                    data: buffer.toString('base64'),
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          },
        },
        { timeout: 25000 },
      );

      return res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (err: any) {
      console.error('[WhatsAppService] Error analyzing crop image:', err.message);
      return '';
    }
  }

  /**
   * Translates response text into the user's selected language using Sarvam AI with Gemini fallback
   */
  private async translateText(text: string, targetLang: string): Promise<string> {
    if (!targetLang || targetLang === 'en-IN' || targetLang === 'en') {
      return text;
    }

    // 1. Try Sarvam AI translation
    if (this.contextService) {
      try {
        const transRes = await this.contextService.translate(text, targetLang);
        if (transRes?.translated_text?.trim()) {
          return transRes.translated_text.trim();
        }
      } catch (err: any) {
        console.warn(`[WhatsAppService] Sarvam translation error for ${targetLang}, falling back to Gemini:`, err.message);
      }
    }

    // 2. Gemini Translation fallback
    const geminiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const model = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const targetName = getLanguageDisplayName(targetLang);

        const prompt = `Translate the following agricultural advisory into ${targetName}.
Maintain all bullet points, numbers, scientific terms, chemical names, and dosages accurately.
Do not add introductory remarks or English explanations.

Text to translate:
"""
${text}
"""`;

        const res = await axios.post(
          url,
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 850,
            },
          },
          { timeout: 20000 },
        );

        const translated = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (translated) return translated;
      } catch (err: any) {
        console.warn(`[WhatsAppService] Gemini translation error:`, err.message);
      }
    }

    return text;
  }

  /**
   * Generates a grounded agricultural advisory answer when GroundedAnswerService needs a direct pass
   */
  private async generateDirectAgriculturalAnswer(
    query: string,
    langCode: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    const apiKey = aiConfig.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return `Thank you for contacting AgriSeva-AI regarding "${query}". Our agricultural advisory system is currently processing your request. Please visit https://agriseva-ai.web.app or contact toll-free Kisan line 1800-180-1551.`;
    }

    const model = aiConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = `You are AgriSeva-AI, India's National Multilingual Agricultural Advisory Voice & WhatsApp Assistant.
Provide clear, empathetic, farmer-friendly, scientifically accurate guidance on crop health, pest control, weather, soil nutrients, or mandi market intelligence.
Follow CIBRC guidelines for any pesticide or chemical recommendations. Always mention organic and cultural practices first.
Keep replies concise, structured, and easy to read on WhatsApp with bullet points and emojis.`;

    const contents: any[] = [];

    // Include recent conversation context (up to last 4 turns)
    if (history && history.length > 0) {
      const recent = history.slice(-4);
      for (const turn of recent) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: `${systemInstruction}\n\nFarmer WhatsApp Query: "${query}"` }],
    });

    try {
      const response = await axios.post(
        url,
        {
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 750,
          },
        },
        { timeout: 20000 },
      );

      const candidate = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (candidate) return candidate;
    } catch (err: any) {
      console.warn('[WhatsAppService] Direct generation error:', err.message);
    }

    return `Thank you for contacting AgriSeva-AI regarding "${query}". Our agricultural advisory system is currently processing your request. Please visit https://agriseva-ai.web.app or contact toll-free Kisan line 1800-180-1551.`;
  }

  /**
   * Master WhatsApp Message Coordinator
   */
  async handleIncomingWhatsAppCloudMessage(
    from: string,
    text: string,
    phoneNumberId?: string,
    extra?: IncomingWhatsAppMessageExtra,
  ): Promise<void> {
    const targetPhoneId = phoneNumberId || this.getDefaultPhoneId();
    const canonicalPhone = normalizePhoneNumber(from);
    console.log(`[WhatsAppService] Processing incoming message from ${from} (${canonicalPhone}): "${text}"`);

    const sessionsCol = await this.getSessionsCollection();
    let session: IWhatsAppSession | null = await sessionsCol.findOne({
      $or: [{ phoneNumber: canonicalPhone }, { rawFrom: from }, { phoneNumber: from }],
    });

    if (!session) {
      session = {
        _id: new ObjectId(),
        phoneNumber: canonicalPhone,
        rawFrom: from,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: [],
      };
    }

    // Step 1: Website / User Profile Language Sync (Requirement 8 & 30)
    // If language is not explicitly set in WhatsApp, inspect MongoDB users collection for existing profile
    if (!session.languageSelectedExplicitly || !session.preferredLanguage) {
      try {
        const usersCol = await this.mongoDatabase.getCollection<IUser>('users');
        const domestic10 = canonicalPhone.replace(/\D/g, '').slice(-10);
        const userMatch = await usersCol.findOne({
          $or: [
            { mobile: canonicalPhone },
            { mobile: from },
            { mobile: domestic10 },
            { 'farmerProfile.phone': canonicalPhone },
            { 'farmerProfile.phone': from },
            { 'farmerProfile.phone': domestic10 },
          ],
        });

        if (userMatch) {
          session.userId = userMatch._id?.toString();
          session.userName = `${userMatch.firstName || ''} ${userMatch.lastName || ''}`.trim();
          const profileLang = userMatch.farmerProfile?.preferredLanguage;
          if (profileLang) {
            session.preferredLanguage = profileLang;
            session.languageSelectedExplicitly = true;
            console.log(`[WhatsAppService] Synced preferredLanguage "${profileLang}" from website profile for ${from}`);
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppService] Error during user profile matching:', err.message);
      }
    }

    // Step 2: Handle Interactive Language Selection Replies (Buttons or List Rows)
    const interactiveId =
      extra?.interactive?.button_reply?.id || extra?.interactive?.list_reply?.id;

    if (interactiveId) {
      if (interactiveId === 'lang_page_2') {
        await this.sendLanguageSelectionMenu(from, targetPhoneId, 2);
        return;
      }
      if (interactiveId === 'lang_page_1' || interactiveId === 'lang_more_all') {
        await this.sendLanguageSelectionMenu(from, targetPhoneId, 1);
        return;
      }
      if (interactiveId.startsWith('lang_')) {
        const chosenCode = interactiveId.replace('lang_', '');
        session.preferredLanguage = chosenCode;
        session.languageSelectedExplicitly = true;
        session.updatedAt = new Date();

        const pending = session.pendingFirstMessage;
        session.pendingFirstMessage = undefined;

        await sessionsCol.updateOne(
          { phoneNumber: canonicalPhone },
          { $set: session },
          { upsert: true },
        );

        console.log(`[WhatsAppService] User ${from} selected language: ${chosenCode}`);

        // If there was a pending first message, restore it and continue!
        if (pending && (pending.text || pending.mediaId)) {
          const restoredConfirmations: Record<string, string> = {
            'te-IN': '✅ మీ భాషగా *తెలుగు* ఎంపిక చేయబడింది.\nమీ ప్రశ్నను పరిశీలిస్తున్నాము, దయచేసి వేచి ఉండండి...',
            'hi-IN': '✅ आपकी भाषा *हिन्दी* चुन ली गई है।\nहम आपके प्रश्न का उत्तर तैयार कर रहे हैं, कृपया प्रतीक्षा करें...',
            'ta-IN': '✅ உங்கள் மொழியாக *தமிழ்* தேர்ந்தெடுக்கப்பட்டது.\nஉங்கள் கேள்விக்கான பதிலை தயார் செய்கிறோம், காத்திருக்கவும்...',
            'kn-IN': '✅ ನಿಮ್ಮ ಭಾಷೆಯಾಗಿ *ಕನ್ನಡ* ಆಯ್ಕೆಯಾಗಿದೆ.\nನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರವನ್ನು ಸಿದ್ಧಪಡಿಸುತ್ತಿದ್ದೇವೆ, ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ...',
            'en-IN': '✅ Language set to *English*.\nAnalyzing your question, please wait a moment...',
          };
          const confirmMsg = restoredConfirmations[chosenCode] || restoredConfirmations['en-IN'];
          await this.sendTextMessage(from, targetPhoneId, confirmMsg);

          // Continue processing the original message in the newly selected language!
          text = pending.text || '';
          extra = {
            msgId: 'restored_' + Date.now(),
            msgType: pending.msgType || 'text',
            audio: pending.msgType === 'audio' ? { id: pending.mediaId!, mime_type: pending.mimeType } : undefined,
            voice: pending.msgType === 'voice' ? { id: pending.mediaId!, mime_type: pending.mimeType } : undefined,
            image: pending.msgType === 'image' ? { id: pending.mediaId!, mime_type: pending.mimeType || 'image/jpeg', caption: pending.caption } : undefined,
          };
        } else {
          const welcomeGreetings: Record<string, string> = {
            'te-IN': '🌾 *నమస్తే! AgriSeva-AI కి స్వాగతం.*\n\nమీ భాషగా *తెలుగు* విజయవంతంగా సెట్ చేయబడింది.\n\nమీరు పంట సమస్యలు, వ్యాధులు, మండి మార్కెట్ ధరలు, ఎరువులు లేదా ప్రభుత్వ పథకాల గురించి ఏ ప్రశ్ననైనా ఇక్కడ అడగవచ్చు.\n\n*టెక్స్ట్ మెసేజ్, వాయిస్ నోట్ లేదా పంట ఫోటో* పంపండి!\n\n_🌐 భాషను మార్చడానికి ఎప్పుడైనా "language" అని పంపండి._',
            'hi-IN': '🌾 *नमस्ते! AgriSeva-AI में आपका स्वागत है।*\n\nआपकी भाषा *हिन्दी* सफलतापूर्वक चुन ली गई है।\n\nआप फसल संबंधी समस्याएं, कीट-रोग, मंडी भाव, खाद-उर्वरक या सरकारी योजनाओं के बारे में कोई भी प्रश्न पूछ सकते हैं।\n\n*टेक्स्ट मैसेज, वॉइस नोट या फसल की फोटो* भेजें!\n\n_🌐 भाषा बदलने के लिए कभी भी "language" लिखें।_',
            'ta-IN': '🌾 *வணக்கம்! AgriSeva-AI-க்கு நல்வரவு.*\n\nஉங்கள் மொழியாக *தமிழ்* தேர்ந்தெடுக்கப்பட்டது.\n\nபயிர் பாதுகாப்பு, நோய், மண்டி விலை, உரங்கள் அல்லது அரசு திட்டங்கள் குறித்து நீங்கள் எந்த கேள்வியையும் கேட்கலாம்.\n\n*உரை, குரல் பதிவு அல்லது பயிர் புகைப்படம்* அனுப்புங்கள்!\n\n_🌐 மொழியை மாற்ற "language" என தட்டச்சு செய்யவும்._',
            'kn-IN': '🌾 *ನಮಸ್ಕಾರ! AgriSeva-AI ಗೆ ಸ್ವಾಗತ.*\n\nನಿಮ್ಮ ಭಾಷೆಯಾಗಿ *ಕನ್ನಡ* ಆಯ್ಕೆಯಾಗಿದೆ.\n\nಬೆಳೆ ರೋಗಗಳು, ಮಂಡಿ ದರಗಳು, ರಸಗೊಬ್ಬರಗಳು ಅಥವಾ ಕೃಷಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳನ್ನು ಇಲ್ಲಿ ಕೇಳಬಹುದು.\n\n*ಪಠ್ಯ, ಧ್ವನಿ ಸಂದೇಶ ಅಥವಾ ಬೆಳೆಯ ಫೋಟೋ* ಕಳುಹಿಸಿ!\n\n_🌐 ಭಾಷೆ ಬದಲಾಯಿಸಲು "language" ಎಂದು ಕಳುಹಿಸಿ._',
            'en-IN': '🌾 *Namaste! Welcome to AgriSeva-AI.*\n\nYour language is set to *English*.\n\nYou can ask any question regarding crop health, pest & disease diagnosis, today\'s mandi prices, fertilizers, or government schemes.\n\nSend a *text message, voice note, or crop photo*!\n\n_🌐 Type "language" anytime to change your language._',
          };
          const welcome = welcomeGreetings[chosenCode] || welcomeGreetings['en-IN'];
          await this.sendTextMessage(from, targetPhoneId, welcome);
          return;
        }
      }
    }

    // Step 3: Handle Explicit Language Change Requests (Requirement 10 & 43)
    const norm = (text || '').trim().toLowerCase();
    const isLangCommand =
      norm === 'language' ||
      norm === 'lang' ||
      norm === 'change language' ||
      norm === 'switch language' ||
      norm === 'select language' ||
      norm === 'bhasha' ||
      norm === 'भाषा' ||
      norm === 'భాష' ||
      norm === 'மொழி' ||
      norm === 'ಭಾಷೆ';

    if (isLangCommand) {
      await this.sendLanguageSelectionMenu(from, targetPhoneId, 1);
      return;
    }

    // Step 4: First-time Unmapped User Language Discovery (Requirements 3, 5, 29, 41, 42)
    if (!session.preferredLanguage) {
      const detected = detectLanguageFromText(text || extra?.image?.caption || '');
      if (detected && detected !== 'en-IN') {
        session.preferredLanguage = detected;
        console.log(`[WhatsAppService] Auto-detected language "${detected}" from incoming script for ${from}`);
      } else {
        // Save current incoming message so it is not lost while farmer selects language
        session.pendingFirstMessage = {
          text: text || '',
          msgType: extra?.msgType || 'text',
          mediaId: extra?.audio?.id || extra?.voice?.id || extra?.image?.id,
          mimeType: extra?.audio?.mime_type || extra?.voice?.mime_type || extra?.image?.mime_type,
          caption: extra?.image?.caption,
          timestamp: new Date(),
        };
        await sessionsCol.updateOne(
          { phoneNumber: canonicalPhone },
          { $set: session },
          { upsert: true },
        );

        console.log(`[WhatsAppService] Preserved first message from new user ${from}. Sending language selector.`);
        await this.sendLanguageSelectionMenu(from, targetPhoneId, 1);
        return;
      }
    }

    const currentLang = session.preferredLanguage || 'en-IN';

    // Step 5: Multi-modal Input Handling (Voice / Image / Text)
    let userQuery = (text || '').trim();
    const isAudioMsg = extra?.msgType === 'audio' || extra?.msgType === 'voice' || !!extra?.audio || !!extra?.voice;
    const isImageMsg = extra?.msgType === 'image' || !!extra?.image;

    // Handle Voice Message
    if (isAudioMsg) {
      const audioId = extra?.audio?.id || extra?.voice?.id;
      const mimeType = extra?.audio?.mime_type || extra?.voice?.mime_type || 'audio/ogg';
      if (audioId) {
        try {
          console.log(`[WhatsAppService] Downloading voice message ${audioId}...`);
          const { buffer } = await this.downloadMetaMedia(audioId);
          userQuery = await this.transcribeAudio(buffer, mimeType, currentLang);
          console.log(`[WhatsAppService] Transcribed voice query: "${userQuery}"`);
        } catch (err: any) {
          console.error('[WhatsAppService] Error processing voice note:', err.message);
        }

        if (!userQuery) {
          const voiceFailures: Record<string, string> = {
            'te-IN': '🎙️ క్షమించండి, మీ వాయిస్ సందేశం స్పష్టంగా వినిపించలేదు. దయచేసి నేపథ్య శబ్దం లేకుండా మళ్ళీ మాట్లాడి పంపండి లేదా టెక్స్ట్ రూపంలో టైప్ చేయండి.',
            'hi-IN': '🎙️ क्षमा करें, आपका वॉइस संदेश स्पष्ट सुनाई नहीं दिया। कृपया शांतिपूर्ण स्थान से पुनः बोलकर भेजें या टेक्स्ट में टाइप करें।',
            'ta-IN': '🎙️ மன்னிக்கவும், உங்கள் குரல் செய்தி தெளிவாக கேட்கவில்லை. தயவுசெய்து மீண்டும் தெளிவாக பேசி அனுப்பவும் அல்லது தட்டச்சு செய்யவும்.',
            'kn-IN': '🎙️ ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಧ್ವನಿ ಸಂದೇಶ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುನಃ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ ಕಳುಹಿಸಿ ಅಥವಾ ಪಠ್ಯದಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ.',
            'en-IN': '🎙️ Sorry, we could not clearly understand your voice note. Please speak clearly without background noise and try again, or type your question in text.',
          };
          const failMsg = voiceFailures[currentLang] || voiceFailures['en-IN'];
          await this.sendTextMessage(from, targetPhoneId, failMsg);
          return;
        }
      }
    }

    // Handle Image Message
    if (isImageMsg) {
      const imageId = extra?.image?.id;
      const mimeType = extra?.image?.mime_type || 'image/jpeg';
      const caption = extra?.image?.caption || userQuery || '';
      if (imageId) {
        try {
          console.log(`[WhatsAppService] Downloading crop image ${imageId}...`);
          const { buffer } = await this.downloadMetaMedia(imageId);
          const diagnosis = await this.processCropImage(buffer, mimeType, caption, currentLang);
          if (diagnosis) {
            const translatedDiagnosis = await this.translateText(diagnosis, currentLang);
            const formatted = `🌱 *AgriSeva-AI పంట రోగ నిర్ధారణ*\n\n${translatedDiagnosis}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI • ${getLanguageDisplayName(currentLang)}_\n_🌐 భాషను మార్చడానికి "language" అని పంపండి._`;
            await this.sendTextMessage(from, targetPhoneId, formatted);

            // Update session history
            session.history = session.history || [];
            session.history.push({
              role: 'user',
              content: caption || '[Crop Image uploaded]',
              timestamp: new Date(),
              msgType: 'image',
            });
            session.history.push({
              role: 'assistant',
              content: translatedDiagnosis,
              timestamp: new Date(),
            });
            session.lastMessageAt = new Date();
            await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
            return;
          }
        } catch (err: any) {
          console.error('[WhatsAppService] Error analyzing crop image:', err.message);
        }
      }
    }

    if (!userQuery) {
      console.warn('[WhatsAppService] No text query found after processing. Nothing to reply.');
      return;
    }

    // Step 6: Core Agricultural Advisory Pipeline (Grounded / RAG / POP / Market / Safety)
    let aiAnswer = '';
    let isEscalatedToPAE = false;

    if (this.groundedAnswerService) {
      try {
        console.log(`[WhatsAppService] Calling GroundedAnswerService for: "${userQuery}" [lang: ${currentLang}]`);
        const groundedRes = await this.groundedAnswerService.generateGroundedAnswer({
          query: userQuery,
          language: currentLang,
          userContext: {
            userId: session.userId?.toString(),
          },
        });

        if (groundedRes?.answer?.trim()) {
          const isGenericBoilerplate =
            groundedRes.status === 'expert_review' && groundedRes.confidence === 'low';

          if (!isGenericBoilerplate) {
            aiAnswer = groundedRes.answer.trim();
          } else {
            isEscalatedToPAE = true;
          }
        }
      } catch (err: any) {
        console.warn('[WhatsAppService] GroundedAnswerService error, falling back to direct AI generation:', err.message);
      }
    }

    if (!aiAnswer) {
      aiAnswer = await this.generateDirectAgriculturalAnswer(userQuery, currentLang, session.history);
      if (isEscalatedToPAE) {
        const paeNotes: Record<string, string> = {
          'te-IN': '\n\n📌 _గమనిక: మీ ప్రశ్నకు వివరణాత్మక సలహా పైన ఇవ్వబడింది. అదనపు పరిశీలన కోసం ఇది వ్యవసాయ నిపుణుల (PAE) సమీక్షకు కూడా నమోదు చేయబడింది._',
          'hi-IN': '\n\n📌 _नोट: आपके प्रश्न के लिए विस्तृत सलाह ऊपर दी गई है। अतिरिक्त सत्यापन के लिए इसे कृषि विशेषज्ञ (PAE) समीक्षा हेतु भी दर्ज किया गया है।_',
          'ta-IN': '\n\n📌 _குறிப்பு: உங்கள் கேள்விக்கான ஆலோசனை மேலே கொடுக்கப்பட்டுள்ளது. மேலதிக உறுதிப்படுத்தலுக்கு இது வேளாண் நிபுணர் (PAE) பார்வைக்கு அனுப்பப்பட்டுள்ளது._',
          'kn-IN': '\n\n📌 _ಸೂಚನೆ: ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ವಿವರವಾದ ಸಲಹೆಯನ್ನು ಮೇಲೆ ನೀಡಲಾಗಿದೆ. ಹೆಚ್ಚಿನ ಪರಿಶೀಲನೆಗಾಗಿ ಇದನ್ನು ಕೃಷಿ ತಜ್ಞರ (PAE) ಪರಿಶೀಲನೆಗೆ ದಾಖಲಿಸಲಾಗಿದೆ._',
          'en-IN': '\n\n📌 _Note: Comprehensive advisory is provided above. This query has also been registered for Agricultural Expert (PAE) review._',
        };
        aiAnswer += paeNotes[currentLang] || paeNotes['en-IN'];
      }
    }

    // Step 7: Final Translation into User's Selected Language (Requirements 11, 12, 44)
    let finalLocalizedAnswer = aiAnswer;
    if (currentLang !== 'en-IN') {
      finalLocalizedAnswer = await this.translateText(aiAnswer, currentLang);
    }

    // Step 8: Formatting for WhatsApp
    const headerPrefixes: Record<string, string> = {
      'te-IN': '🌱 *AgriSeva-AI సలహా*',
      'hi-IN': '🌱 *AgriSeva-AI कृषि सलाह*',
      'ta-IN': '🌱 *AgriSeva-AI விவசாய ஆலோசனை*',
      'kn-IN': '🌱 *AgriSeva-AI ಕೃಷಿ ಸಲಹೆ*',
      'en-IN': '🌱 *AgriSeva-AI Advisory*',
    };
    const footerTips: Record<string, string> = {
      'te-IN': '🌐 భాష మార్చడానికి "language" అని పంపండి',
      'hi-IN': '🌐 भाषा बदलने के लिए "language" लिखें',
      'ta-IN': '🌐 மொழியை மாற்ற "language" என தட்டச்சு செய்யவும்',
      'kn-IN': '🌐 ಭಾಷೆ ಬದಲಾಯಿಸಲು "language" ಎಂದು ಕಳುಹಿಸಿ',
      'en-IN': '🌐 Type "language" anytime to change language',
    };

    const header = headerPrefixes[currentLang] || headerPrefixes['en-IN'];
    const footerTip = footerTips[currentLang] || footerTips['en-IN'];
    const displayName = getLanguageDisplayName(currentLang);

    const formattedMessage = `${header}\n\n${finalLocalizedAnswer}\n\n━━━━━━━━━━━━━━━━\n_🌾 AgriSeva-AI • ${displayName}_\n_${footerTip}_`;

    // Step 9: Outbound Message Dispatch
    await this.sendTextMessage(from, targetPhoneId, formattedMessage);

    // Step 10: Persist Conversation Session History (up to last 6 turns)
    session.history = session.history || [];
    session.history.push({
      role: 'user',
      content: userQuery,
      timestamp: new Date(),
      msgType: extra?.msgType || 'text',
    });
    session.history.push({
      role: 'assistant',
      content: finalLocalizedAnswer,
      timestamp: new Date(),
    });

    if (session.history.length > 8) {
      session.history = session.history.slice(-8);
    }
    session.lastMessageAt = new Date();
    session.updatedAt = new Date();

    await sessionsCol.updateOne({ phoneNumber: canonicalPhone }, { $set: session }, { upsert: true });
    console.log(`[WhatsAppService] Successfully completed request for ${from} in ${currentLang}`);
  }
}
