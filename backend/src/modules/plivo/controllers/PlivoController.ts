import 'reflect-metadata';
import {
  Post,
  Get,
  Body,
  HttpCode,
  QueryParam,
  Req,
  Res,
  Authorized,
  BadRequestError,
  InternalServerError,
  JsonController,
  CurrentUser,
  UseBefore,
  Param,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { Request, Response, urlencoded } from 'express';
import { appConfig } from '#root/config/app.js';
import { inject, injectable, optional } from 'inversify';
import plivo from 'plivo';
import axios from 'axios';
import { PLIVO_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import type { ICallDetailsRepository, AgentAnalytics, ACCAnalytics } from '#root/shared/database/interfaces/ICallDetailsRepository.js';
import type { IUser } from '#root/shared/interfaces/models.js';
import { PlivoService } from '../services/PlivoService.js';
import type { IFarmerService } from '../services/FarmerService.js';
import { GROUNDED_ANSWER_TYPES } from '#root/modules/groundedAnswer/types.js';
import type { IGroundedAnswerService } from '#root/modules/groundedAnswer/interfaces/IGroundedAnswerService.js';
import { normalizePhoneNumber } from '#root/utils/phoneNumber.js';
import { detectLanguageFromText } from '#root/modules/groundedAnswer/services/GroundedAnswerService.js';


@OpenAPI({
  tags: ['plivo'],
  description: 'Operations for managing Plivo calls',
})
@injectable()
@JsonController('/plivo')
export class PlivoController {
  private client = new plivo.Client(process.env.PLIVO_AUTH_ID, process.env.PLIVO_AUTH_TOKEN, { timeout: 30000 });

  constructor(
    @inject(PLIVO_TYPES.CallDetailsRepository) private callDetailsRepository: ICallDetailsRepository,
    @inject(GLOBAL_TYPES.UserService) private userService: any,
    @inject(PLIVO_TYPES.PlivoService) private plivoService: PlivoService,
    @inject(PLIVO_TYPES.FarmerService) private farmerService: IFarmerService,
    @optional()
    @inject(GROUNDED_ANSWER_TYPES.GroundedAnswerService)
    private groundedAnswerService?: IGroundedAnswerService
  ) { }


  private getCallbackBaseUrl(req: Request): string {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
    if (host) {
      return `${proto}://${host}${appConfig.routePrefix}/plivo`;
    }
    const appUrl = (appConfig.url || '').replace(/\/+$/, '');
    if (appUrl) {
      return `${appUrl}${appConfig.routePrefix}/plivo`;
    }
    return `${appConfig.routePrefix}/plivo`;
  }

  @Post('/answer')
  @Get('/answer')
  @HttpCode(200)
  @UseBefore(urlencoded({ extended: true }))
  @OpenAPI({ summary: 'Handle inbound telephone call answer from Plivo' })
  async answer(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const callUuid = (req.body?.CallUUID || req.query?.CallUUID || `call_${Date.now()}`).toString();
      const rawFrom = (req.body?.From || req.query?.From || 'unknown').toString();
      const rawTo = (req.body?.To || req.query?.To || appConfig.plivo.plivo_number).toString();
      const callerPhone = normalizePhoneNumber(rawFrom);
      const cbUrl = this.getCallbackBaseUrl(req);

      console.log(`📞 [PLIVO-TELEPHONY] Inbound call received: UUID=${callUuid}, Caller=${callerPhone}, Dialed=${rawTo}`);

      // Lookup existing farmer profile or initialize new one
      let farmer = null;
      try {
        farmer = await this.farmerService.getFarmerByPhoneNo(callerPhone);
        if (!farmer) {
          await this.farmerService.createFarmer(callerPhone, {
            phoneNo: callerPhone,
            languagePreference: undefined,
          });
          farmer = await this.farmerService.getFarmerByPhoneNo(callerPhone);
          console.log(`🌾 [PLIVO-TELEPHONY] Initialized new farmer profile for ${callerPhone}`);
        } else {
          console.log(`🌾 [PLIVO-TELEPHONY] Recognized existing farmer: ${callerPhone} (Lang: ${farmer.profile?.languagePreference || 'not set'})`);
        }
      } catch (fErr) {
        console.warn(`[PLIVO-TELEPHONY] Farmer profile lookup warning:`, fErr);
      }

      // Check stream URL for audio logging
      const streamUrl = appConfig.plivo.streamUrl;
      const isRealStream = streamUrl && !streamUrl.includes('dummy') && !streamUrl.includes('example.com');
      const streamXml = isRealStream
        ? `<Stream contentType="audio/x-l16;rate=16000" noiseCancellation="true" audioTrack="both" noise_cancellation_level="85">${streamUrl}</Stream>`
        : '';

      const savedLang = farmer?.profile?.languagePreference;

      if (savedLang) {
        // Farmer already has a chosen language
        const session = this.plivoService.getOrCreateCallSession(callUuid, callerPhone, savedLang);
        session.farmerId = farmer?._id?.toString();
        session.farmerName = farmer?.profile?.farmerName;

        const langConfig = this.plivoService.getLanguageConfig(savedLang);
        this.plivoService.addCallTurn(callUuid, 'assistant', langConfig.greeting);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${streamXml}
  <GetInput action="${cbUrl}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="25" speechModel="phone_call" language="${langConfig.plivoLanguage}">
    <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.greeting)}</Speak>
  </GetInput>
  <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.silencePrompt)}</Speak>
  <Redirect method="POST">${cbUrl}/listen-again</Redirect>
</Response>`;

        res.set('Content-Type', 'text/xml');
        res.send(xml);
        return;
      }

      // First-call experience: spoken multilingual menu
      const session = this.plivoService.getOrCreateCallSession(callUuid, callerPhone, 'te-IN');
      session.isFirstCall = true;
      session.farmerId = farmer?._id?.toString();
      session.farmerName = farmer?.profile?.farmerName;

      const menuPrompt = "Welcome to AgriSeva-AI. Please choose your language. Telugu kosam 1 nokkandi. Hindi ke liye 2 dabaye. For English press 3. Tamilukku 4 azhuthavum. Kannada kaagi 5 otti. Marathi sathi 6 daba. Or speak your agricultural question in any language now.";
      this.plivoService.addCallTurn(callUuid, 'assistant', menuPrompt);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${streamXml}
  <GetInput action="${cbUrl}/language-menu" method="POST" inputType="speech dtmf" numDigits="1" speechEndTimeout="2" executionTimeout="20">
    <Speak voice="Polly.Aditi" language="en-IN">${this.plivoService.escapeXml(menuPrompt)}</Speak>
  </GetInput>
  <Speak voice="Polly.Aditi" language="en-IN">I did not hear your choice. Please speak your question or press a number.</Speak>
  <Redirect method="POST">${cbUrl}/language-menu</Redirect>
</Response>`;

      res.set('Content-Type', 'text/xml');
      res.send(xml);
    } catch (error: any) {
      console.error('❌ [PLIVO-TELEPHONY] Error in answer endpoint:', error);
      const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Aditi" language="en-IN">Welcome to AgriSeva-AI. Please tell us your crop question.</Speak>
  <GetInput action="${this.getCallbackBaseUrl(req)}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="20"/>
</Response>`;
      res.set('Content-Type', 'text/xml');
      res.send(fallbackXml);
    }
  }

  @Post('/language-menu')
  @Get('/language-menu')
  @HttpCode(200)
  @UseBefore(urlencoded({ extended: true }))
  @OpenAPI({ summary: 'Handle language selection DTMF or spoken choice' })
  async handleLanguageMenu(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const callUuid = (req.body?.CallUUID || req.query?.CallUUID || '').toString();
      const rawFrom = (req.body?.From || req.query?.From || 'unknown').toString();
      const callerPhone = normalizePhoneNumber(rawFrom);
      const digits = (req.body?.Digits || req.query?.Digits || '').toString().trim();
      const speech = (req.body?.Speech || req.query?.Speech || '').toString().trim();
      const cbUrl = this.getCallbackBaseUrl(req);

      const session = this.plivoService.getOrCreateCallSession(callUuid, callerPhone);

      let selectedLang = '';
      if (digits === '1') selectedLang = 'te-IN'; // Telugu
      else if (digits === '2') selectedLang = 'hi-IN'; // Hindi
      else if (digits === '3') selectedLang = 'en-IN'; // English
      else if (digits === '4') selectedLang = 'ta-IN'; // Tamil
      else if (digits === '5') selectedLang = 'kn-IN'; // Kannada
      else if (digits === '6') selectedLang = 'mr-IN'; // Marathi
      else if (speech) {
        selectedLang = detectLanguageFromText(speech);
        console.log(`🗣️ [PLIVO-TELEPHONY] Farmer spoke initial query in language-menu: "${speech}" (Detected: ${selectedLang})`);
      } else {
        selectedLang = 'te-IN'; // Default regional
      }

      session.language = selectedLang;
      session.isFirstCall = false;

      // Persist chosen language in farmer profile
      try {
        await this.farmerService.updateFarmer(callerPhone, { languagePreference: selectedLang });
        console.log(`💾 [PLIVO-TELEPHONY] Saved language ${selectedLang} for farmer ${callerPhone}`);
      } catch (saveErr) {
        console.warn(`[PLIVO-TELEPHONY] Failed to save farmer languagePreference:`, saveErr);
      }

      // If speech was provided, directly proceed to answer the question
      if (speech) {
        req.body = { ...req.body, Speech: speech, CallUUID: callUuid, From: callerPhone };
        return await this.handleSpeechInput(req, res);
      }

      const langConfig = this.plivoService.getLanguageConfig(selectedLang);
      const ackMessage = selectedLang.startsWith('te')
        ? 'ధన్యవాదాలు. మీరు తెలుగును ఎంచుకున్నారు. ఇప్పుడు మీ పంట సందేహాన్ని అడగండి.'
        : selectedLang.startsWith('hi')
        ? 'धन्यवाद। आपने हिन्दी चुनी है। अब अपना कृषि प्रश्न पूछें।'
        : selectedLang.startsWith('ta')
        ? 'நன்றி. நீங்கள் தமிழைத் தேர்ந்தெடுத்துள்ளீர்கள். இப்போது உங்கள் விவசாயக் கேள்வியைக் கேளுங்கள்.'
        : selectedLang.startsWith('kn')
        ? 'ಧನ್ಯವಾದಗಳು. ನೀವು ಕನ್ನಡವನ್ನು ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ. ಈಗ ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ.'
        : selectedLang.startsWith('mr')
        ? 'धन्यवाद. आपण मराठी निवडली आहे. आता आपला शेतीविषयक प्रश्न विचारा.'
        : 'Thank you. You have chosen English. Please ask your agricultural question now.';

      this.plivoService.addCallTurn(callUuid, 'assistant', ackMessage);

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput action="${cbUrl}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="25" speechModel="phone_call" language="${langConfig.plivoLanguage}">
    <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(ackMessage)}</Speak>
  </GetInput>
  <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.silencePrompt)}</Speak>
  <Redirect method="POST">${cbUrl}/listen-again</Redirect>
</Response>`;

      res.set('Content-Type', 'text/xml');
      res.send(xml);
    } catch (error: any) {
      console.error('❌ [PLIVO-TELEPHONY] Error in language-menu:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  @Post('/speech-input')
  @Get('/speech-input')
  @HttpCode(200)
  @UseBefore(urlencoded({ extended: true }))
  @OpenAPI({ summary: 'Handle farmer speech, execute grounded AI pipeline, and return spoken response' })
  async handleSpeechInput(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      const callUuid = (req.body?.CallUUID || req.query?.CallUUID || '').toString();
      const rawFrom = (req.body?.From || req.query?.From || 'unknown').toString();
      const callerPhone = normalizePhoneNumber(rawFrom);
      const speech = (req.body?.Speech || req.query?.Speech || '').toString().trim();
      const cbUrl = this.getCallbackBaseUrl(req);

      const session = this.plivoService.getOrCreateCallSession(callUuid, callerPhone);
      const langConfig = this.plivoService.getLanguageConfig(session.language);

      // 1. Check for empty speech / silence
      if (!speech) {
        session.silenceCount = (session.silenceCount || 0) + 1;
        console.log(`🔇 [PLIVO-TELEPHONY] Silence on call ${callUuid} (Count: ${session.silenceCount}/3)`);

        if (session.silenceCount < 3) {
          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput action="${cbUrl}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="20" speechModel="phone_call" language="${langConfig.plivoLanguage}">
    <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.silencePrompt)}</Speak>
  </GetInput>
  <Redirect method="POST">${cbUrl}/listen-again</Redirect>
</Response>`;
          res.set('Content-Type', 'text/xml');
          res.send(xml);
          return;
        }

        // 3 consecutive silences -> end call gracefully
        this.plivoService.addCallTurn(callUuid, 'assistant', langConfig.goodbye);
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.goodbye)}</Speak>
  <Hangup/>
</Response>`;
        res.set('Content-Type', 'text/xml');
        res.send(xml);
        return;
      }

      // Reset silence count upon valid speech
      session.silenceCount = 0;
      console.log(`🎙️ [PLIVO-TELEPHONY] Farmer spoken text (${callerPhone}, Lang: ${session.language}): "${speech}"`);
      this.plivoService.addCallTurn(callUuid, 'farmer', speech);

      // 2. Check for caller ending conversation
      const exitRegex = /(bye|thank you|thanks|that's all|nothing else|exit|quit|stop|no more|చాలు|ధన్యవాదాలు|సెలవు|సరిపోతుంది|అంతే|धन्यवाद|अलविदा|काफ़ी है|काफी है|बस|शुक्रिया|நன்றி|போதும்|ಧನ್ಯವಾದಗಳು|ಸಾಕು)/i;
      if (exitRegex.test(speech)) {
        console.log(`👋 [PLIVO-TELEPHONY] Farmer indicated conclusion: "${speech}"`);
        this.plivoService.addCallTurn(callUuid, 'assistant', langConfig.goodbye);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.goodbye)}</Speak>
  <Hangup/>
</Response>`;
        res.set('Content-Type', 'text/xml');
        res.send(xml);
        return;
      }

      // 3. Language adaptation if caller spoke in different Indian language
      const detected = detectLanguageFromText(speech);
      if (detected && detected !== 'en-IN' && detected !== session.language) {
        console.log(`🌐 [PLIVO-TELEPHONY] Adapting call language from ${session.language} to detected ${detected}`);
        session.language = detected;
      }

      // 4. Generate Grounded AI Answer
      let rawAiAnswer = '';
      try {
        if (this.groundedAnswerService) {
          const aiResponse = await this.groundedAnswerService.generateGroundedAnswer({
            query: speech,
            language: session.language,
            userContext: session.farmerId ? { userId: session.farmerId } : undefined,
          });
          rawAiAnswer = aiResponse.answer;
        }
      } catch (aiErr: any) {
        console.error('❌ [PLIVO-TELEPHONY] Error generating grounded answer:', aiErr);
      }

      if (!rawAiAnswer) {
        if (session.language.startsWith('te')) {
          rawAiAnswer = 'క్షమించండి, మీ ప్రశ్నకు సమాచారం అందుబాటులో లేదు. దయచేసి మీ సందేహాన్ని స్పష్టంగా మళ్ళీ అడగండి.';
        } else if (session.language.startsWith('hi')) {
          rawAiAnswer = 'क्षमा करें, इस समय सटीक जानकारी प्राप्त नहीं हो सकी। कृपया अपना प्रश्न स्पष्ट रूप से दोबारा पूछें।';
        } else {
          rawAiAnswer = 'We could not retrieve the exact advisory at this moment. Please repeat your question clearly.';
        }
      }

      // 5. Clean text for natural speech and append follow-up prompt
      const cleanAnswer = this.plivoService.formatTextForSpeech(rawAiAnswer);
      const activeLangConfig = this.plivoService.getLanguageConfig(session.language);
      const fullSpokenResponse = `${cleanAnswer} ${activeLangConfig.moreQuestions}`;

      console.log(`🤖 [PLIVO-TELEPHONY] AI Spoken Answer (${session.language}): "${fullSpokenResponse}"`);
      this.plivoService.addCallTurn(callUuid, 'assistant', fullSpokenResponse);

      // 6. Try generating natural audio with Sarvam Bulbul TTS
      const audioId = await this.plivoService.generateSpeechAudio(fullSpokenResponse, session.language);

      let spokenVerbXml: string;
      if (audioId) {
        spokenVerbXml = `<Play>${cbUrl}/audio/${audioId}.wav</Play>`;
      } else {
        spokenVerbXml = `<Speak voice="${activeLangConfig.plivoVoice}" language="${activeLangConfig.plivoLanguage}">${this.plivoService.escapeXml(fullSpokenResponse)}</Speak>`;
      }

      // 7. Multi-turn conversational loop with barge-in interruption
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput action="${cbUrl}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="25" speechModel="phone_call" language="${activeLangConfig.plivoLanguage}">
    ${spokenVerbXml}
  </GetInput>
  <Speak voice="${activeLangConfig.plivoVoice}" language="${activeLangConfig.plivoLanguage}">${this.plivoService.escapeXml(activeLangConfig.moreQuestions)}</Speak>
  <GetInput action="${cbUrl}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="15" speechModel="phone_call" language="${activeLangConfig.plivoLanguage}"/>
  <Speak voice="${activeLangConfig.plivoVoice}" language="${activeLangConfig.plivoLanguage}">${this.plivoService.escapeXml(activeLangConfig.goodbye)}</Speak>
  <Hangup/>
</Response>`;

      res.set('Content-Type', 'text/xml');
      res.send(xml);
    } catch (error: any) {
      console.error('❌ [PLIVO-TELEPHONY] Error in speech-input:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  @Post('/listen-again')
  @Get('/listen-again')
  @HttpCode(200)
  @UseBefore(urlencoded({ extended: true }))
  @OpenAPI({ summary: 'Handle silence retry for listening' })
  async handleListenAgain(@Req() req: Request, @Res() res: Response): Promise<void> {
    const callUuid = (req.body?.CallUUID || req.query?.CallUUID || '').toString();
    const rawFrom = (req.body?.From || req.query?.From || 'unknown').toString();
    const callerPhone = normalizePhoneNumber(rawFrom);
    const cbUrl = this.getCallbackBaseUrl(req);

    const session = this.plivoService.getOrCreateCallSession(callUuid, callerPhone);
    const langConfig = this.plivoService.getLanguageConfig(session.language);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetInput action="${cbUrl}/speech-input" method="POST" inputType="speech" speechEndTimeout="2" executionTimeout="20" speechModel="phone_call" language="${langConfig.plivoLanguage}">
    <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.prompt)}</Speak>
  </GetInput>
  <Speak voice="${langConfig.plivoVoice}" language="${langConfig.plivoLanguage}">${this.plivoService.escapeXml(langConfig.goodbye)}</Speak>
  <Hangup/>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(xml);
  }

  @Post('/hangup')
  @Get('/hangup')
  @HttpCode(200)
  @UseBefore(urlencoded({ extended: true }))
  @OpenAPI({ summary: 'Handle call hangup webhook from Plivo and save call details' })
  async handleHangup(@Req() req: Request, @Res() res: Response): Promise<void> {
    const callUuid = (req.body?.CallUUID || req.query?.CallUUID || '').toString();
    const duration = req.body?.Duration || req.query?.Duration;
    const hangupCause = req.body?.HangupCause || req.query?.HangupCause || 'caller_disconnected';

    console.log(`📴 [PLIVO-TELEPHONY] Call ended: UUID=${callUuid}, Duration=${duration}s, Cause=${hangupCause}`);

    if (callUuid) {
      try {
        await this.plivoService.saveCallDetails(callUuid);
        this.plivoService.endCallSession(callUuid);
      } catch (err) {
        console.error(`❌ [PLIVO-TELEPHONY] Error saving call details on hangup:`, err);
      }
    }

    res.status(200).send('OK');
  }

  @Get('/audio/:audioId')
  @OpenAPI({ summary: 'Serve cached TTS audio for Plivo Play' })
  async serveAudio(@Param('audioId') audioIdParam: string, @Res() res: Response): Promise<void> {
    const audioId = audioIdParam.replace(/\.(wav|mp3)$/i, '');
    const cached = this.plivoService.getCachedAudio(audioId);

    if (!cached) {
      res.status(404).send('Audio not found or expired');
      return;
    }

    res.set('Content-Type', cached.contentType);
    res.set('Cache-Control', 'public, max-age=600');
    res.send(cached.buffer);
  }





  @Get('/history')
  @HttpCode(200)
  @OpenAPI({ summary: 'Get call history from Plivo' })
  async getHistory(
    @QueryParam('limit') limit: number = 20,
    @QueryParam('offset') offset: number = 0,
    @QueryParam('startDate') startDate?: string,
    @QueryParam('endDate') endDate?: string,
    @QueryParam('status') status?: string,
    @QueryParam('direction') direction?: string
  ): Promise<Array<{
    uuid: string;
    from: string;
    to: string;
    duration: number;
    status: string;
    startTime: string;
    direction: string;
    callDetails?: any;
  }>> {
    try {
      // Build the query object for Plivo API
      const plivoQuery: any = {
        limit: limit,
        offset: offset
      };

      // Add optional filters if provided
      if (startDate) plivoQuery.start_time = startDate;
      if (endDate) plivoQuery.end_time = endDate;
      if (status) plivoQuery.status = status;
      if (direction) plivoQuery.call_direction = direction;

      // Fetching the list of calls from Plivo
      const response = await this.client.calls.list(plivoQuery);

      const history = (response as any)
        .filter((item: any) => item.callUuid) // Filter out meta object
        .map((call: any) => ({
          uuid: call.callUuid,
          from: call.fromNumber,
          to: call.toNumber,
          duration: call.callDuration, // in seconds
          status: call.callState,
          startTime: call.initiationTime,
          direction: call.callDirection
        }));

      // Attach Call Details from MongoDB
      for (const item of history) {
        try {
          const details = await this.callDetailsRepository.getByCallUuid(item.uuid);
          if (details) {
            item.callDetails = details;
          }
        } catch (e) {
          console.error(`[PLIVO-CONTROLLER] Could not fetch details for ${item.uuid}`);
        }
      }

      return history;
    } catch (error: any) {
      console.error('❌ Error fetching call history:', error);
      throw new InternalServerError('Failed to fetch call history');
    }
  }


  @Post('/send-message')
  @Authorized()
  @OpenAPI({
    summary: 'Send SMS using Fast2SMS',
    description: 'Send SMS to one or multiple phone numbers using Fast2SMS Quick SMS API',
  })
  @HttpCode(200)
  async sendMessage(
    @Body() body: { destination: string, text: string },
    @Res() res: Response
  ) {
    try {


      if (!body.destination || !body.text) {
        return res.status(400).json({
          success: false,
          error: "destination and text are required parameters"
        });
      }

      const apiKey = appConfig.fast2sms.apiKey;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "Fast2SMS API key not configured"
        });
      }

      const isUnicode = /[^\u0000-\u007F]/.test(body.text);
      const requestBody = {
        route: 'q',
        message: body.text,
        language: isUnicode ? 'unicode' : 'english',
        flash: 0,
        numbers: body.destination,
        sms_details: 1
      };

      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        requestBody,
        {
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log("✅ Fast2SMS response:", response.data);

      return res.json({
        success: true,
        data: response.data
      });
    } catch (err: any) {
      console.error('❌ Fast2SMS error:', err.response?.data || err.message);
      return res.status(500).json({
        success: false,
        error: err.response?.data?.message || err.message || 'Failed to send SMS'
      });
    }
  }

  @Get('/analytics')
  @Authorized()
  @OpenAPI({
    summary: 'Get call agent analytics',
    description: 'Retrieves analytics data for the authenticated call agent including call statistics, domains, and trends. Only accessible by users with call_agent role.',
  })
  @HttpCode(200)
  async getAgentAnalytics(
    @CurrentUser() user: IUser,
    @QueryParam('startDate') startDate?: string,
    @QueryParam('endDate') endDate?: string
  ): Promise<AgentAnalytics> {
    try {
      // Verify user is a call agent
      if (user.role !== 'call_agent') {
        throw new BadRequestError('Only call agents can access their analytics');
      }

      // Parse date filters if provided
      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate);
        if (isNaN(start.getTime())) {
          throw new BadRequestError('Invalid startDate format');
        }
      }

      if (endDate) {
        end = new Date(endDate);
        if (isNaN(end.getTime())) {
          throw new BadRequestError('Invalid endDate format');
        }
      }

      // Get analytics for the current user
      const analytics = await this.callDetailsRepository.getAgentAnalytics(
        user._id?.toString() || '',
        start,
        end
      );

      return analytics;
    } catch (error: any) {
      console.error('❌ [PLIVO-CONTROLLER] Error getting agent analytics:', error);
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new InternalServerError('Failed to get agent analytics');
    }
  }

  @Get('/acc-analytics')
  @Authorized()
  @OpenAPI({
    summary: 'Get ACC analytics for admin',
    description: 'Retrieves domain-based call analytics for admin including call statistics by domain, monthly trends, and daily trends. Only accessible by users with admin role.',
  })
  @HttpCode(200)
  async getACCAnalytics(
    @CurrentUser() user: IUser,
    @QueryParam('startDate') startDate?: string,
    @QueryParam('endDate') endDate?: string
  ): Promise<ACCAnalytics> {
    try {
      // Verify user is an admin
      if (user.role !== 'admin') {
        throw new BadRequestError('Only admins can access ACC analytics');
      }

      // Parse date filters if provided
      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate);
        if (isNaN(start.getTime())) {
          throw new BadRequestError('Invalid startDate format');
        }
      }

      if (endDate) {
        end = new Date(endDate);
        if (isNaN(end.getTime())) {
          throw new BadRequestError('Invalid endDate format');
        }
      }

      // Get ACC analytics
      const analytics = await this.callDetailsRepository.getACCAnalytics(
        start,
        end
      );

      return analytics;
    } catch (error: any) {
      console.error('❌ [PLIVO-CONTROLLER] Error getting ACC analytics:', error);
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new InternalServerError('Failed to get ACC analytics');
    }
  }
}
