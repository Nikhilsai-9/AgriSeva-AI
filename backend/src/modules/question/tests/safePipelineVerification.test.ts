import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextService } from '#root/modules/context/services/ContextService.js';
import { QuestionService } from '#root/modules/question/services/QuestionService.js';
import { ObjectId } from 'mongodb';

describe('Safe Pipeline Fixes Verification Tests', () => {
  const USER_ID = '664f00000000000000000099';
  const storedQuestions = new Map<string, any>();
  const storedContexts = new Map<string, any>();
  const storedSubmissions = new Map<string, any>();

  let contextCounter = 1;
  let questionCounter = 1;

  const mockContextRepo = {
    addContext: vi.fn().mockImplementation(async (text: string) => {
      const insertedId = new ObjectId(`664fc000000000000000000${contextCounter++}`);
      storedContexts.set(insertedId.toString(), { _id: insertedId, text, createdAt: new Date() });
      return { insertedId: insertedId.toString() };
    }),
  };

  const mockQuestionRepo = {
    getByContextId: vi.fn().mockImplementation(async (contextId: string) => {
      const results = [];
      for (const q of storedQuestions.values()) {
        if (q.contextId?.toString() === contextId.toString()) {
          results.push(q);
        }
      }
      return results;
    }),
    addQuestion: vi.fn().mockImplementation(async (question: any) => {
      const qId = new ObjectId(`664fd000000000000000000${questionCounter++}`);
      const saved = { ...question, _id: qId };
      storedQuestions.set(qId.toString(), saved);
      return saved;
    }),
    updateQuestion: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

  const mockQuestionSubmissionRepo = {
    addSubmission: vi.fn().mockImplementation(async (submission: any) => {
      storedSubmissions.set(submission.questionId.toString(), submission);
      return undefined;
    }),
  };

  const mockAiService = {
    getEmbedding: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3] }),
    getQuestionByContext: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:9017')),
  };

  const mockSession = {
    withTransaction: async (cb: any) => cb({}),
    inTransaction: () => false,
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
  };

  const mockDatabase = {
    getClient: vi.fn().mockReturnValue({
      startSession: vi.fn().mockReturnValue(mockSession),
    }),
    getCollection: vi.fn().mockResolvedValue({
      find: () => ({
        sort: () => ({ limit: () => ({ toArray: async () => [] }) }),
        limit: () => ({ toArray: async () => [] }),
      }),
    }),
  };

  let questionService: QuestionService;
  let contextService: ContextService;

  beforeEach(() => {
    storedQuestions.clear();
    storedContexts.clear();
    storedSubmissions.clear();
    contextCounter = 1;
    questionCounter = 1;
    vi.clearAllMocks();

    questionService = new QuestionService(
      mockAiService as any,
      {} as any, // accAgentService
      mockContextRepo as any,
      mockQuestionRepo as any,
      {} as any, // userRepo
      mockQuestionSubmissionRepo as any,
      {} as any, // requestRepo
      {} as any, // answerRepo
      {} as any, // notificationRepo
      {} as any, // notificationService
      {} as any, // reRouteRepo
      {} as any, // duplicateQuestionRepo
      {} as any, // cropRepo
      {} as any, // chatbotRepo
      mockDatabase as any,
      {} as any, // userService
      {} as any, // callDetailsRepo
      {} as any, // auditTrailsService
    );

    contextService = new ContextService(
      mockContextRepo as any,
      questionService,
      mockDatabase as any,
    );
  });

  it('Test 1-5: Submit TEST_QUESTION_A_001 -> creates real IQuestion linked to context', async () => {
    const transcript = 'TEST_QUESTION_A_001';
    const result = await contextService.addContext(USER_ID, transcript, {
      language: 'en-IN',
      submissionId: 'sub-001',
    });

    expect(result.insertedId).toBeDefined();
    expect(result.questionId).toBeDefined();

    // Verify persisted question record
    const savedQuestion = storedQuestions.get(result.questionId!);
    expect(savedQuestion).toBeDefined();
    expect(savedQuestion.question).toBe(transcript);
    expect(savedQuestion.originalQuestion).toBe(transcript);
    expect(savedQuestion.contextId?.toString()).toBe(result.insertedId);
    expect(savedQuestion.source).toBe('AGRISEVA_AI');
    expect(savedQuestion.status).toBe('pending');
    expect(savedQuestion.userId?.toString()).toBe(USER_ID);

    // Verify submission record
    const submission = storedSubmissions.get(result.questionId!);
    expect(submission).toBeDefined();
    expect(submission.questionId.toString()).toBe(result.questionId);
  });

  it('Test 6-12: Submit TEST_QUESTION_B_002 -> separate record, does not overwrite TEST_QUESTION_A_001', async () => {
    const resA = await contextService.addContext(USER_ID, 'TEST_QUESTION_A_001');
    const resB = await contextService.addContext(USER_ID, 'TEST_QUESTION_B_002');

    expect(resA.questionId).not.toBe(resB.questionId);
    expect(resA.insertedId).not.toBe(resB.insertedId);

    // Verify both exist separately in DB
    expect(storedQuestions.size).toBe(2);
    const qA = storedQuestions.get(resA.questionId!);
    const qB = storedQuestions.get(resB.questionId!);

    expect(qA.question).toBe('TEST_QUESTION_A_001');
    expect(qB.question).toBe('TEST_QUESTION_B_002');
    expect(qA._id.toString()).not.toBe(qB._id.toString());
  });

  it('Test 13-15: AI service unavailable -> question is still persisted and observable status returned', async () => {
    const transcript = 'TEST_QUESTION_C_003';

    // Verify AI generation returns observable grounded/expert review status
    const genResult = await questionService.getQuestionFromRawContext(transcript);
    expect(genResult).toHaveLength(1);
    expect(genResult[0].question).toBe('TEST_QUESTION_C_003');
    // Observable status returned without universal hardcoded advisory
    expect(genResult[0].status).toBe('expert_review');
    expect(genResult[0].referenceSource).toBeDefined();

    // Verify question is STILL persisted successfully to database even when AI server fails
    const resC = await contextService.addContext(USER_ID, transcript);
    expect(resC.questionId).toBeDefined();

    const qC = storedQuestions.get(resC.questionId!);
    expect(qC).toBeDefined();
    expect(qC.question).toBe('TEST_QUESTION_C_003');
    expect(qC.status).toBe('pending');
  });

  it('Idempotency: Re-submitting for same contextId does not duplicate question record', async () => {
    const contextId = '664fc0000000000000000001';
    const q1 = await questionService.createQuestionFromContext(USER_ID, contextId, 'TEST_QUESTION_IDEMPOTENT');
    const q2 = await questionService.createQuestionFromContext(USER_ID, contextId, 'TEST_QUESTION_IDEMPOTENT');

    expect(q1._id.toString()).toBe(q2._id.toString());
    expect(storedQuestions.size).toBe(1);
  });

  it('generateAiInitialAnswer: generates and saves aiInitialAnswer to database', async () => {
    const qId = new ObjectId('664fd0000000000000000099');
    const questionObj = {
      _id: qId,
      question: 'What is the best fertilizer for tomato crop?',
      userId: new ObjectId(USER_ID),
      source: 'WHATSAPP',
      status: 'open',
      details: { crop: 'Tomato', state: 'Andhra Pradesh' },
    };
    storedQuestions.set(qId.toString(), questionObj);

    mockQuestionRepo.getById = vi.fn().mockResolvedValue(questionObj);
    mockQuestionSubmissionRepo.getByQuestionId = vi.fn().mockResolvedValue({
      questionId: qId,
      history: [],
    });

    const result = await questionService.generateAiInitialAnswer(qId.toString());

    expect(result).toBeDefined();
    expect(result.aiInitialAnswer).toBeDefined();
    expect(result.aiInitialAnswer.length).toBeGreaterThan(0);
    // Verifies that updateQuestion was called with the generated answer
    expect(mockQuestionRepo.updateQuestion).toHaveBeenCalledWith(
      qId.toString(),
      expect.objectContaining({
        aiInitialAnswer: expect.any(String),
      }),
      expect.anything(),
    );
  });

  it('User ownership: buildQuestionFilter restricts normal farmers to their own questions', async () => {
    const { buildQuestionFilter } = await import('#root/utils/buildQuestionFilter.js');

    const farmerUser: any = {
      _id: new ObjectId(USER_ID),
      role: 'farmer',
      mobile: '+919876543210',
    };

    const { filter } = await buildQuestionFilter(
      { page: 1, limit: 10 } as any,
      {} as any,
      {} as any,
      farmerUser,
    );

    // Filter must include user ownership condition in $and
    expect(filter.$and).toBeDefined();
    const ownershipCondition = filter.$and.find((c: any) => c.$or);
    expect(ownershipCondition).toBeDefined();
    expect(ownershipCondition.$or).toEqual(
      expect.arrayContaining([
        { userId: new ObjectId(USER_ID) },
        { userId: USER_ID },
        { threadId: '+919876543210' },
      ]),
    );
  });

  it('Staff access: buildQuestionFilter does not restrict staff or moderators', async () => {
    const { buildQuestionFilter } = await import('#root/utils/buildQuestionFilter.js');

    const moderatorUser: any = {
      _id: new ObjectId('664f00000000000000000001'),
      role: 'moderator',
    };

    const { filter } = await buildQuestionFilter(
      { page: 1, limit: 10 } as any,
      {} as any,
      {} as any,
      moderatorUser,
    );

    // Moderator should NOT have a user ownership $or in $and
    const ownershipCondition = filter.$and?.find((c: any) => c.$or);
    expect(ownershipCondition).toBeUndefined();
  });
});
