import { inject, injectable } from 'inversify';
import { appConfig } from '../../../config/app.js';
import { WebSocket } from 'ws';
import plivo from 'plivo';
import { ObjectId } from 'mongodb';
import { PLIVO_TYPES } from '../types.js';
import type { ICallDetailsRepository, CallDetails, QAItem } from '#root/shared/database/interfaces/ICallDetailsRepository.js';
import { randomUUID } from 'crypto';
import axios from 'axios';

export interface ITelephonyTurn {
  role: 'farmer' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface ITelephonyCallSession {
  callUuid: string;
  callerPhone: string;
  farmerId?: string;
  farmerName?: string;
  language: string;
  isFirstCall: boolean;
  silenceCount: number;
  turnCount: number;
  createdAt: Date;
  updatedAt: Date;
  turns: ITelephonyTurn[];
}

export interface ITelephonyLanguageConfig {
  code: string;
  name: string;
  plivoVoice: string;
  plivoLanguage: string;
  greeting: string;
  prompt: string;
  silencePrompt: string;
  goodbye: string;
  moreQuestions: string;
  sarvamCode: string;
}

interface CachedAudio {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
}

interface WsSession {
  ws: WebSocket;
  queue: Buffer[];
  isOpen: boolean;
}

interface SarvamStreamSession {
  transcribeWsSession: WsSession;
  translateWsSession: WsSession;
  onTranscript: (result: {
    track: 'inbound' | 'outbound';
    originalText: string;
    translatedText: string;
    detectedLanguage: string;
  }) => void;
  lastOriginal: string;
  lastTranslate: string;
  detectedLanguage: string;
  pendingOriginal: string;
  pendingTranslate: string;
  debounceTimer: NodeJS.Timeout | null;
}

@injectable()
export class PlivoService {
  private sarvamApiKey: string;
  private activeTranscriptions: Map<string, string> = new Map();
  private activeTranslations: Map<string, string> = new Map(); // Store English translations
  private detectedLanguages: Map<string, string> = new Map(); // Store detected languages
  private activeStreams: Map<string, SarvamStreamSession> = new Map();
  private plivoClient: plivo.Client;
  private callAgentMapping: Map<string, string> = new Map(); // Maps callUuid -> agentUserId
  private telephonySessions: Map<string, ITelephonyCallSession> = new Map();
  private audioCache: Map<string, CachedAudio> = new Map();

  constructor(
    @inject(PLIVO_TYPES.CallDetailsRepository)
    private readonly callDetailsRepository: ICallDetailsRepository
  ) {
    this.sarvamApiKey = appConfig.sarvamAPI;
    this.ensureDebugDir();
    this.plivoClient = new plivo.Client(process.env.PLIVO_AUTH_ID, process.env.PLIVO_AUTH_TOKEN, { timeout: 30000 });

    // Periodically clean cached TTS audio older than 15 minutes and stale sessions older than 2 hours
    setInterval(() => {
      const now = Date.now();
      for (const [id, audio] of this.audioCache.entries()) {
        if (now - audio.createdAt > 15 * 60 * 1000) {
          this.audioCache.delete(id);
        }
      }
      for (const [id, session] of this.telephonySessions.entries()) {
        if (now - session.updatedAt.getTime() > 2 * 60 * 60 * 1000) {
          this.telephonySessions.delete(id);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  private ensureDebugDir(): void {
    // if (!fs.existsSync(this.DEBUG_AUDIO_DIR)) {
    //   fs.mkdirSync(this.DEBUG_AUDIO_DIR, { recursive: true });
    //   console.log(`📁 [PLIVO-SERVICE] Created debug audio directory: ${this.DEBUG_AUDIO_DIR}`);
    // }
  }

  /**
   * Initialize Sarvam WebSocket streams for a call
   */
  initializeStreams(
    callId: string,
    onTranscript: (result: { track: 'inbound' | 'outbound'; originalText: string; translatedText: string; detectedLanguage: string }) => void
  ): void {
    console.log(`🔌 [PLIVO-SERVICE] Initializing Sarvam WebSocket streams for call ${callId}`);
    this.initializeTrackStream(callId, 'inbound', onTranscript);
    this.initializeTrackStream(callId, 'outbound', onTranscript);
  }

  /**
   * Initialize Sarvam WebSocket streams for a specific track (inbound/outbound)
   */
  private initializeTrackStream(
    callId: string,
    track: 'inbound' | 'outbound',
    onTranscript: (result: { track: 'inbound' | 'outbound'; originalText: string; translatedText: string; detectedLanguage: string }) => void
  ): void {
    const key = `${callId}_${track}`;
    console.log(`🔌 [PLIVO-SERVICE] Initializing Sarvam WebSocket streams for call ${callId} (${track})`);

    const transcribeUrl = `wss://api.sarvam.ai/speech-to-text/ws?model=saaras:v3&mode=transcribe&language-code=unknown&sample_rate=16000&input_audio_codec=pcm_l16&high_vad_sensitivity=true`;
    const translateUrl = `wss://api.sarvam.ai/speech-to-text/ws?model=saaras:v3&mode=translate&language-code=unknown&sample_rate=16000&input_audio_codec=pcm_l16&high_vad_sensitivity=true`;

    const headers = {
      'Api-Subscription-Key': this.sarvamApiKey,
    };

    const transcribeWs = new WebSocket(transcribeUrl, { headers });
    const translateWs = new WebSocket(translateUrl, { headers });

    const transcribeWsSession: WsSession = {
      ws: transcribeWs,
      queue: [],
      isOpen: false,
    };

    const translateWsSession: WsSession = {
      ws: translateWs,
      queue: [],
      isOpen: false,
    };

    const session: SarvamStreamSession = {
      transcribeWsSession,
      translateWsSession,
      onTranscript,
      lastOriginal: '',
      lastTranslate: '',
      detectedLanguage: 'unknown',
      pendingOriginal: '',
      pendingTranslate: '',
      debounceTimer: null,
    };

    this.activeStreams.set(key, session);

    // Set up transcribeWs listeners
    transcribeWs.on('open', () => {
      console.log(`📡 [PLIVO-SERVICE] Transcribe WS opened for call ${callId} (${track})`);
      transcribeWsSession.isOpen = true;
      this.flushQueue(transcribeWsSession);
    });

    transcribeWs.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.type === 'data') {
          const current = response.data.transcript || '';
          const prev = session.lastOriginal;
          let delta = '';
          if (current.startsWith(prev)) {
            delta = current.substring(prev.length).trim();
          } else {
            delta = current.trim();
          }

          if (response.data.language_code) {
            session.detectedLanguage = response.data.language_code;
            this.detectedLanguages.set(key, response.data.language_code);
          }

          if (delta) {
            session.lastOriginal = current;
            session.pendingOriginal = (session.pendingOriginal + ' ' + delta).trim();
            this.triggerDebounce(callId, track);
          }
        } else if (response.type === 'error') {
          console.error(`❌ [PLIVO-SERVICE] Transcribe WS error response for call ${callId} (${track}):`, response.data);
        }
      } catch (err) {
        console.error(`❌ [PLIVO-SERVICE] Error parsing transcribe WS message for call ${callId} (${track}):`, err);
      }
    });

    transcribeWs.on('error', (err) => {
      console.error(`❌ [PLIVO-SERVICE] Transcribe WS socket error for call ${callId} (${track}):`, err);
    });

    transcribeWs.on('close', (code, reason) => {
      console.log(`🔌 [PLIVO-SERVICE] Transcribe WS closed for call ${callId} (${track}). Code: ${code}, Reason: ${reason}`);
    });

    // Set up translateWs listeners
    translateWs.on('open', () => {
      console.log(`📡 [PLIVO-SERVICE] Translate WS opened for call ${callId} (${track})`);
      translateWsSession.isOpen = true;
      this.flushQueue(translateWsSession);
    });

    translateWs.on('message', (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.type === 'data') {
          const current = response.data.transcript || '';
          const prev = session.lastTranslate;
          let delta = '';
          if (current.startsWith(prev)) {
            delta = current.substring(prev.length).trim();
          } else {
            delta = current.trim();
          }

          if (delta) {
            session.lastTranslate = current;
            session.pendingTranslate = (session.pendingTranslate + ' ' + delta).trim();
            this.triggerDebounce(callId, track);
          }
        } else if (response.type === 'error') {
          console.error(`❌ [PLIVO-SERVICE] Translate WS error response for call ${callId} (${track}):`, response.data);
        }
      } catch (err) {
        console.error(`❌ [PLIVO-SERVICE] Error parsing translate WS message for call ${callId} (${track}):`, err);
      }
    });

    translateWs.on('error', (err) => {
      console.error(`❌ [PLIVO-SERVICE] Translate WS socket error for call ${callId} (${track}):`, err);
    });

    translateWs.on('close', (code, reason) => {
      console.log(`🔌 [PLIVO-SERVICE] Translate WS closed for call ${callId} (${track}). Code: ${code}, Reason: ${reason}`);
    });
  }

  private flushQueue(wsSession: WsSession): void {
    while (wsSession.queue.length > 0) {
      const chunk = wsSession.queue.shift();
      if (chunk) {
        this.sendAudio(wsSession, chunk);
      }
    }
  }

  private sendAudio(wsSession: WsSession, audioBuffer: Buffer): void {
    if (wsSession.isOpen && wsSession.ws.readyState === WebSocket.OPEN) {
      try {
        const base64Data = audioBuffer.toString('base64');
        const msg = JSON.stringify({
          audio: {
            data: base64Data,
            sample_rate: '16000',
            encoding: 'audio/wav',
          },
        });
        wsSession.ws.send(msg);
      } catch (err) {
        console.error('❌ [PLIVO-SERVICE] Error sending audio chunk over WS:', err);
      }
    } else {
      wsSession.queue.push(audioBuffer);
    }
  }

  private triggerDebounce(callId: string, track: 'inbound' | 'outbound'): void {
    const key = `${callId}_${track}`;
    const session = this.activeStreams.get(key);
    if (!session) return;

    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
    }

    session.debounceTimer = setTimeout(() => {
      const originalText = session.pendingOriginal.trim();
      const translatedText = session.pendingTranslate.trim();

      if (originalText || translatedText) {
        // Update accumulated transcripts
        if (originalText) {
          const current = this.activeTranscriptions.get(key) || '';
          this.activeTranscriptions.set(key, (current + ' ' + originalText).trim());
        }
        // Only fall back to originalText if the text is English/ASCII
        const isEnglish = (session.detectedLanguage && session.detectedLanguage.startsWith('en')) ||
          /^[\x00-\x7F]*$/.test(originalText);

        const finalTranslatedText = translatedText || (isEnglish ? originalText : '');

        if (finalTranslatedText) {
          const current = this.activeTranslations.get(key) || '';
          this.activeTranslations.set(key, (current + ' ' + finalTranslatedText).trim());
        }

        // Trigger callback
        session.onTranscript({
          track,
          originalText,
          translatedText: finalTranslatedText,
          detectedLanguage: session.detectedLanguage,
        });

        // Reset pending buffers
        session.pendingOriginal = '';
        session.pendingTranslate = '';
      }
      session.debounceTimer = null;
    }, 1000);
  }

  /**
   * Finalize a specific track stream, flush pending transcriptions, and close connections
   */
  async finalizeTrackStream(callId: string, track: 'inbound' | 'outbound'): Promise<{ originalText: string; translatedText: string }> {
    const key = `${callId}_${track}`;
    console.log(`🔌 [PLIVO-SERVICE] Finalizing stream for call ${callId} (${track})`);
    const session = this.activeStreams.get(key);
    if (!session) return { originalText: '', translatedText: '' };

    // Send flush signal to both sockets
    const flushMsg = JSON.stringify({ type: 'flush' });
    try {
      if (session.transcribeWsSession.isOpen && session.transcribeWsSession.ws.readyState === WebSocket.OPEN) {
        session.transcribeWsSession.ws.send(flushMsg);
      }
      if (session.translateWsSession.isOpen && session.translateWsSession.ws.readyState === WebSocket.OPEN) {
        session.translateWsSession.ws.send(flushMsg);
      }
    } catch (err) {
      console.error(`Error sending flush signal for ${track}:`, err);
    }

    // Wait a brief period for any final messages to arrive and get processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
      session.debounceTimer = null;
    }

    // Capture any remaining pending text
    const originalText = session.pendingOriginal.trim();
    const translatedText = session.pendingTranslate.trim();

    // Close sockets
    try {
      if (session.transcribeWsSession.ws.readyState !== WebSocket.CLOSED) {
        session.transcribeWsSession.ws.close();
      }
      if (session.translateWsSession.ws.readyState !== WebSocket.CLOSED) {
        session.translateWsSession.ws.close();
      }
    } catch (e) {
      console.error(`Error closing Sarvam WebSockets for ${track}:`, e);
    }

    // Remove from active streams
    this.activeStreams.delete(key);

    // Also update accumulated transcripts one last time
    if (originalText) {
      const current = this.activeTranscriptions.get(key) || '';
      this.activeTranscriptions.set(key, (current + ' ' + originalText).trim());
    }
    if (translatedText) {
      const current = this.activeTranslations.get(key) || '';
      this.activeTranslations.set(key, (current + ' ' + translatedText).trim());
    }

    return { originalText, translatedText };
  }

  /**
   * Finalize streams (fallback for backward compatibility)
   */
  async finalizeStreams(callId: string): Promise<{ originalText: string; translatedText: string }> {
    const res = await this.processRemainingAudio(callId);
    return res.inbound;
  }

  /**
   * Forward audio chunk to active streams
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    callId: string,
    track: 'inbound' | 'outbound' = 'inbound'
  ): Promise<{ originalText: string; translatedText: string }> {
    const key = `${callId}_${track}`;
    const session = this.activeStreams.get(key);
    if (session) {
      this.sendAudio(session.transcribeWsSession, audioBuffer);
      this.sendAudio(session.translateWsSession, audioBuffer);
    }
    return { originalText: '', translatedText: '' };
  }

  /**
   * Get complete transcript for a call track
   */
  getTranscript(callId: string, track: 'inbound' | 'outbound' = 'inbound'): string {
    const key = `${callId}_${track}`;
    return this.activeTranscriptions.get(key) || '';
  }

  /**
   * Get English translation for a call track
   */
  getTranslation(callId: string, track: 'inbound' | 'outbound' = 'inbound'): string {
    const key = `${callId}_${track}`;
    return this.activeTranslations.get(key) || '';
  }

  /**
   * Get detected language for a call track
   */
  getDetectedLanguage(callId: string, track: 'inbound' | 'outbound' = 'inbound'): string {
    const key = `${callId}_${track}`;
    return this.detectedLanguages.get(key) || 'unknown';
  }

  /**
   * Clear transcript and audio buffers for a call
   */
  clearTranscript(callId: string): void {
    for (const track of ['inbound', 'outbound'] as const) {
      const key = `${callId}_${track}`;
      this.activeTranscriptions.delete(key);
      this.activeTranslations.delete(key);
      this.detectedLanguages.delete(key);

      const session = this.activeStreams.get(key);
      if (session) {
        if (session.debounceTimer) {
          clearTimeout(session.debounceTimer);
        }
        try {
          if (session.transcribeWsSession.ws.readyState !== WebSocket.CLOSED) {
            session.transcribeWsSession.ws.close();
          }
          if (session.translateWsSession.ws.readyState !== WebSocket.CLOSED) {
            session.translateWsSession.ws.close();
          }
        } catch (e) {
          // ignore
        }
        this.activeStreams.delete(key);
      }
    }
    // Clear agent mapping for this call
    this.callAgentMapping.delete(callId);
  }

  /**
   * Set the agent userid for a specific call
   */
  setCallAgent(callUuid: string, agentUserId: string): void {
    this.callAgentMapping.set(callUuid, agentUserId);
    console.log(`✅ [PLIVO-SERVICE] Set agent ${agentUserId} for call ${callUuid}`);
  }

  /**
   * Get the agent userid for a specific call
   */
  getCallAgent(callUuid: string): string | undefined {
    return this.callAgentMapping.get(callUuid);
  }

  /**
   * Save complete call details into the database
   */
  async saveCallDetails(callUuid: string): Promise<void> {
    console.log(`📝 [PLIVO-SERVICE] Saving call details for ${callUuid}`);
    try {
      // 1. Fetch from Plivo API
      let plivoCall: any = null;
      try {
        plivoCall = await this.plivoClient.calls.get(callUuid);
      } catch (e) {
        console.warn(`⚠️ [PLIVO-SERVICE] Could not fetch Plivo details for ${callUuid}:`, e);
      }

      // 2. Build participant objects using current transcripts
      let callerTranscript = this.getTranscript(callUuid, 'inbound');
      let callerTranslation = this.getTranslation(callUuid, 'inbound');
      let callerLanguage = this.getDetectedLanguage(callUuid, 'inbound');

      let agentTranscript = this.getTranscript(callUuid, 'outbound');
      let agentTranslation = this.getTranslation(callUuid, 'outbound');
      let agentLanguage = this.getDetectedLanguage(callUuid, 'outbound');
      const agentUserId = this.getCallAgent(callUuid);

      // Check if this was an AI telephony call session
      const telephonySession = this.telephonySessions.get(callUuid);
      const qnaItems: QAItem[] = [];

      if (telephonySession && telephonySession.turns.length > 0) {
        if (!callerTranscript) {
          callerTranscript = telephonySession.turns
            .filter((t) => t.role === 'farmer')
            .map((t) => t.text)
            .join('\n');
        }
        if (!agentTranscript) {
          agentTranscript = telephonySession.turns
            .filter((t) => t.role === 'assistant')
            .map((t) => t.text)
            .join('\n');
        }
        if (!callerLanguage || callerLanguage === 'unknown') {
          callerLanguage = telephonySession.language;
        }
        if (!agentLanguage || agentLanguage === 'unknown') {
          agentLanguage = telephonySession.language;
        }

        let pendingQ = '';
        for (const turn of telephonySession.turns) {
          if (turn.role === 'farmer') {
            pendingQ = turn.text;
          } else if (turn.role === 'assistant' && pendingQ) {
            qnaItems.push({
              id: randomUUID(),
              question: pendingQ,
              answer: turn.text,
              agri_specialist: 'AgriSeva-AI Voice Agent',
              referenceSource: 'AgriSeva Grounded Agricultural Knowledge Graph',
            });
            pendingQ = '';
          }
        }
      }

      const callDetails: CallDetails = {
        callUuid,
        from: plivoCall?.fromNumber || telephonySession?.callerPhone,
        to: plivoCall?.toNumber || appConfig.plivo.plivo_number,
        duration: plivoCall?.callDuration || (telephonySession ? Math.round((Date.now() - telephonySession.createdAt.getTime()) / 1000) : undefined),
        status: plivoCall?.callState || 'completed',
        direction: plivoCall?.callDirection || 'inbound',
        caller: {
          transcript: callerTranscript,
          translation: callerTranslation,
          detectedLanguage: callerLanguage,
        },
        agent: {
          transcript: agentTranscript,
          translation: agentTranslation,
          detectedLanguage: agentLanguage,
          userid: agentUserId ? new ObjectId(agentUserId) : undefined,
        },
      };

      if (qnaItems.length > 0) {
        callDetails.QA_pairs = {
          metadata: {
            extracted_query: qnaItems[0]?.question || '',
            extracted_crop: '',
            extracted_state: '',
            extracted_district: '',
            extracted_domain: 'Voice Advisory',
            extracted_season: '',
          },
          QnA: qnaItems,
        };
      }

      // 3. Save to repository (update if it already exists, otherwise create)
      const existingCall = await this.callDetailsRepository.getByCallUuid(callUuid);
      if (existingCall) {
        await this.callDetailsRepository.updateCallDetails(callUuid, callDetails);
        console.log(`✅ [PLIVO-SERVICE] Updated existing call details for ${callUuid} in database.`);
      } else {
        await this.callDetailsRepository.create(callDetails);
        console.log(`✅ [PLIVO-SERVICE] Saved new call details for ${callUuid} to database.`);
      }
    } catch (err) {
      console.error(`❌ [PLIVO-SERVICE] Error saving call details for ${callUuid}:`, err);
    }
  }

  /**
   * Process any remaining audio chunks when call ends
   */
  async processRemainingAudio(callId: string): Promise<{
    inbound: { originalText: string; translatedText: string };
    outbound: { originalText: string; translatedText: string };
  }> {
    const inbound = await this.finalizeTrackStream(callId, 'inbound');
    const outbound = await this.finalizeTrackStream(callId, 'outbound');
    return { inbound, outbound };
  }

  /* =======================================================================
   * TELEPHONY AI VOICE AGENT SESSION MANAGEMENT & MULTILINGUAL TTS
   * ======================================================================= */

  getOrCreateCallSession(callUuid: string, callerPhone: string, language?: string): ITelephonyCallSession {
    const existing = this.telephonySessions.get(callUuid);
    if (existing) {
      if (language && language !== 'auto') {
        existing.language = language;
      }
      existing.updatedAt = new Date();
      return existing;
    }

    const session: ITelephonyCallSession = {
      callUuid,
      callerPhone,
      language: language || 'te-IN', // Default to Telugu as primary regional agricultural base
      isFirstCall: false,
      silenceCount: 0,
      turnCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      turns: [],
    };
    this.telephonySessions.set(callUuid, session);
    return session;
  }

  getCallSession(callUuid: string): ITelephonyCallSession | undefined {
    return this.telephonySessions.get(callUuid);
  }

  updateCallSession(callUuid: string, updates: Partial<ITelephonyCallSession>): void {
    const session = this.telephonySessions.get(callUuid);
    if (session) {
      Object.assign(session, updates, { updatedAt: new Date() });
    }
  }

  addCallTurn(callUuid: string, role: 'farmer' | 'assistant', text: string): void {
    const session = this.telephonySessions.get(callUuid);
    if (session && text.trim()) {
      session.turns.push({
        role,
        text: text.trim(),
        timestamp: new Date(),
      });
      session.turnCount = session.turns.length;
      session.updatedAt = new Date();
    }
  }

  endCallSession(callUuid: string): ITelephonyCallSession | undefined {
    const session = this.telephonySessions.get(callUuid);
    if (session) {
      this.telephonySessions.delete(callUuid);
    }
    return session;
  }

  getLanguageConfig(langCode: string): ITelephonyLanguageConfig {
    const clean = (langCode || '').trim().toLowerCase();

    if (clean.startsWith('te')) {
      return {
        code: 'te-IN',
        name: 'Telugu',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'te-IN',
        greeting: 'నమస్కారం! అగ్రిసేవ-AI వ్యవసాయ హెల్ప్‌లైన్‌కు స్వాగతం. మీ పంట, తెగుళ్లు లేదా మార్కెట్ ధరల గురించి మీ ప్రశ్నను అడగండి.',
        prompt: 'మీ పంట సందేహాన్ని అడగండి.',
        silencePrompt: 'మీ మాటలు వినిపించలేదు. దయచేసి మీ వ్యవసాయ సందేహాన్ని స్పష్టంగా అడగండి.',
        goodbye: 'అగ్రిసేవ-AI కి కాల్ చేసినందుకు ధన్యవాదాలు. మీ పంటలు సమృద్ధిగా పండాలని కోరుకుంటున్నాము. సెలవు!',
        moreQuestions: 'మీ పంట లేదా మార్కెట్ గురించి ఇంకా ఏదైనా సందేహం ఉందా?',
        sarvamCode: 'te-IN',
      };
    }

    if (clean.startsWith('hi')) {
      return {
        code: 'hi-IN',
        name: 'Hindi',
        plivoVoice: 'Polly.Aditi',
        plivoLanguage: 'hi-IN',
        greeting: 'नमस्ते! एग्रीसेवा-एआई किसान हेल्पलाइन में आपका स्वागत है। अपने फसल, कीट, मौसम या मंडी भाव से जुड़ा प्रश्न पूछें।',
        prompt: 'कृपया अपना कृषि प्रश्न पूछें।',
        silencePrompt: 'आपकी आवाज़ नहीं सुनाई दी। कृपया अपना प्रश्न दोहराएं।',
        goodbye: 'एग्रीसेवा-एआई में कॉल करने के लिए धन्यवाद। आपकी फसल अच्छी हो, शुभ दिन!',
        moreQuestions: 'क्या आपके पास फसलों से जुड़ा कोई और प्रश्न है?',
        sarvamCode: 'hi-IN',
      };
    }

    if (clean.startsWith('ta')) {
      return {
        code: 'ta-IN',
        name: 'Tamil',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'ta-IN',
        greeting: 'வணக்கம்! அக்ரிசேவா-AI விவசாய உதவி மையத்திற்கு நல்வரவு. உங்கள் பயிர் அல்லது சந்தை விலை பற்றிய கேள்வியைக் கேளுங்கள்.',
        prompt: 'உங்கள் விவசாயக் கேள்வியைக் கேளுங்கள்.',
        silencePrompt: 'உங்கள் குரல் கேட்கவில்லை. தயவுசெய்து உங்கள் கேள்வியை மீண்டும் கேளுங்கள்.',
        goodbye: 'அக்ரிசேவா-AI-ஐ அழைத்ததற்கு நன்றி. நல்ல விளைச்சல் பெற வாழ்த்துகள்!',
        moreQuestions: 'வேறு ஏதேனும் விவசாய சந்தேகம் உள்ளதா?',
        sarvamCode: 'ta-IN',
      };
    }

    if (clean.startsWith('kn')) {
      return {
        code: 'kn-IN',
        name: 'Kannada',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'kn-IN',
        greeting: 'ನಮಸ್ಕಾರ! ಅಗ್ರಿಸೇವಾ-AI ಕೃಷಿ ಸಹಾಯವಾಣಿಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಬೆಳೆ ಅಥವಾ ಮಾರುಕಟ್ಟೆ ದರದ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.',
        prompt: 'ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.',
        silencePrompt: 'ನಿಮ್ಮ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಮತ್ತೆ ಕೇಳಿ.',
        goodbye: 'ಅಗ್ರಿಸೇವಾ-AI ಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ಶುಭ ದಿನ!',
        moreQuestions: 'ನಿಮ್ಮ ಬೆಳೆ ಬಗ್ಗೆ ಇನ್ನೇನಾದರೂ ಪ್ರಶ್ನೆ ಇದೆಯೇ?',
        sarvamCode: 'kn-IN',
      };
    }

    if (clean.startsWith('mr')) {
      return {
        code: 'mr-IN',
        name: 'Marathi',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'mr-IN',
        greeting: 'नमस्कार! अ‍ॅग्रीसेवा-एआय शेतकरी हेल्पलाइनमध्ये आपले स्वागत आहे. आपल्या पिकाविषयी किंवा बाजारभावाविषयी प्रश्न विचारा.',
        prompt: 'आपला शेतीविषयक प्रश्न विचारा.',
        silencePrompt: 'आपला आवाज ऐकू आला नाही. कृपया आपला प्रश्न पुन्हा विचारा.',
        goodbye: 'अ‍ॅग्रीसेवा-एआयला कॉल केल्याबद्दल धन्यवाद. आपले पीक उत्तम येवो!',
        moreQuestions: 'आपल्याला आणखी काही शेतीविषयक माहिती हवी आहे का?',
        sarvamCode: 'mr-IN',
      };
    }

    if (clean.startsWith('ml')) {
      return {
        code: 'ml-IN',
        name: 'Malayalam',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'ml-IN',
        greeting: 'നമസ്കാരം! അഗ്രിസേവ-AI കർഷക ഹെൽപ്പ്‌ലൈനിലേക്ക് സ്വാഗതം. നിങ്ങളുടെ കൃഷി സംശയങ്ങൾ ചോദിക്കൂ.',
        prompt: 'നിങ്ങളുടെ കാർഷിക ചോദ്യം ചോദിക്കൂ.',
        silencePrompt: 'ശബ്ദം കേൾക്കാൻ കഴിഞ്ഞില്ല. ദയവായി ചോദ്യം ആവർത്തിക്കൂ.',
        goodbye: 'അഗ്രിസേവ-AI-ലേക്ക് വിളിച്ചതിന് നന്ദി. നല്ലൊരു വിളവെടുപ്പ് ആശംസിക്കുന്നു!',
        moreQuestions: 'മറ്റു സംശയങ്ങൾ എന്തെങ്കിലും ഉണ്ടോ?',
        sarvamCode: 'ml-IN',
      };
    }

    if (clean.startsWith('bn')) {
      return {
        code: 'bn-IN',
        name: 'Bengali',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'bn-IN',
        greeting: 'নমস্কার! এগ্রিসেবা-এআই কৃষক হেল্পলাইনে আপনাকে স্বাগতম। আপনার ফসল বা বাজার দর সংক্রান্ত প্রশ্ন জিজ্ঞাসা করুন।',
        prompt: 'আপনার কৃষিসংক্রান্ত প্রশ্নটি বলুন।',
        silencePrompt: 'আপনার কথা শোনা যায়নি। অনুগ্রহ করে আপনার প্রশ্নটি আবার বলুন।',
        goodbye: 'এগ্রিসেবা-এআইতে কল করার জন্য ধন্যবাদ। ভালো ফলনের শুভকামনা রইল!',
        moreQuestions: 'আপনার কি আর কোনো প্রশ্ন আছে?',
        sarvamCode: 'bn-IN',
      };
    }

    if (clean.startsWith('gu')) {
      return {
        code: 'gu-IN',
        name: 'Gujarati',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'gu-IN',
        greeting: 'નમસ્તે! એગ્રીસેવા-AI કિસાન હેલ્પલાઇનમાં તમારું સ્વાગત છે. તમારા પાક અથવા બજાર ભાવ વિશે પ્રશ્ન પૂછો.',
        prompt: 'તમારો કૃષિ પ્રશ્ન પૂછો.',
        silencePrompt: 'તમારો અવાજ સંભળાયો નથી. કૃપા કરીને પ્રશ્ન ફરી પૂછો.',
        goodbye: 'એગ્રીસેવા-AI પર કૉલ કરવા બદલ આભાર. તમારો પાક સારો રહે!',
        moreQuestions: 'શું તમારે અન્ય કોઈ માહિતી જોઈએ છે?',
        sarvamCode: 'gu-IN',
      };
    }

    if (clean.startsWith('pa')) {
      return {
        code: 'pa-IN',
        name: 'Punjabi',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'pa-IN',
        greeting: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਐਗਰੀਸੇਵਾ-AI ਕਿਸਾਨ ਹੈਲਪਲਾਈਨ ਤੇ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਆਪਣੀ ਫਸਲ ਜਾਂ ਮੰਡੀ ਭਾਅ ਬਾਰੇ ਪੁੱਛੋ।',
        prompt: 'ਆਪਣਾ ਖੇਤੀਬਾੜੀ ਸਵਾਲ ਪੁੱਛੋ।',
        silencePrompt: 'ਤੁਹਾਡੀ ਆਵਾਜ਼ ਨਹੀਂ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਸਵਾਲ ਦੁਬਾਰਾ ਬੋਲੋ।',
        goodbye: 'ਐਗਰੀਸੇਵਾ-AI ਤੇ ਕਾਲ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਫਸਲ ਚੰਗੀ ਰਹੇ!',
        moreQuestions: 'ਕੀ ਕੋਈ ਹੋਰ ਸਵਾਲ ਹੈ?',
        sarvamCode: 'pa-IN',
      };
    }

    if (clean.startsWith('od') || clean.startsWith('or')) {
      return {
        code: 'od-IN',
        name: 'Odia',
        plivoVoice: 'WOMAN',
        plivoLanguage: 'od-IN',
        greeting: 'ନମସ୍କାର! ଏଗ୍ରିସେବା-AI କୃଷକ ହେଲ୍ପଲାଇନକୁ ସ୍ୱାଗତ। ଆପଣଙ୍କ ଫସଲ ବା ମଣ୍ଡି ଦର ବିଷୟରେ ପଚାରନ୍ତୁ।',
        prompt: 'ଆପଣଙ୍କ କୃଷି ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ।',
        silencePrompt: 'ଆପଣଙ୍କ ସ୍ୱର ଶୁଣାଗଲା ନାହିଁ। ଦୟାକରି ପୁଣି କୁହନ୍ତୁ।',
        goodbye: 'ଏଗ୍ରିସେବା-AI କୁ କଲ୍ କରିଥିବାରୁ ଧନ୍ୟବାଦ। ଭଲ ଫସଲ ହେଉ!',
        moreQuestions: 'ଆଉ କିଛି ପ୍ରଶ୍ନ ଅଛି କି?',
        sarvamCode: 'od-IN',
      };
    }

    // Default: Indian English
    return {
      code: 'en-IN',
      name: 'English',
      plivoVoice: 'Polly.Aditi',
      plivoLanguage: 'en-IN',
      greeting: 'Welcome to AgriSeva-AI agricultural voice helpline. Please ask your question about crops, diseases, weather, or mandi prices.',
      prompt: 'Please ask your agricultural question now.',
      silencePrompt: 'I did not hear any speech. Please clearly speak your question.',
      goodbye: 'Thank you for calling AgriSeva-AI. Wishing you a healthy and prosperous harvest!',
      moreQuestions: 'Do you have any other questions about your crops or market rates?',
      sarvamCode: 'en-IN',
    };
  }

  formatTextForSpeech(text: string): string {
    if (!text) return '';
    let cleaned = text
      .replace(/[*#_`~>]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length > 450) {
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
      let truncated = '';
      for (const sentence of sentences) {
        if ((truncated + sentence).length > 400 && truncated.length > 100) break;
        truncated += sentence + ' ';
      }
      cleaned = truncated.trim() || cleaned.slice(0, 400);
    }
    return cleaned;
  }

  escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async generateSpeechAudio(text: string, languageCode: string): Promise<string | null> {
    if (!this.sarvamApiKey || this.sarvamApiKey === 'your-sarvam-api-key') {
      return null;
    }
    const config = this.getLanguageConfig(languageCode);
    const audioId = randomUUID();
    try {
      const response = await axios.post(
        'https://api.sarvam.ai/text-to-speech',
        {
          inputs: [text],
          target_language_code: config.sarvamCode || 'hi-IN',
          speaker: 'meera',
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          speech_sample_rate: 8000,
          enable_preprocessing: true,
          model: 'bulbul:v1',
        },
        {
          headers: {
            'api-subscription-key': this.sarvamApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 3800,
        }
      );

      const base64Audio = response.data?.audios?.[0];
      if (base64Audio) {
        const buffer = Buffer.from(base64Audio, 'base64');
        this.audioCache.set(audioId, {
          buffer,
          contentType: 'audio/wav',
          createdAt: Date.now(),
        });
        return audioId;
      }
    } catch (err: any) {
      console.warn(`[PLIVO-SERVICE] Sarvam TTS generation skipped/fallback:`, err.message);
    }
    return null;
  }

  getCachedAudio(audioId: string): { buffer: Buffer; contentType: string } | undefined {
    return this.audioCache.get(audioId);
  }
}
