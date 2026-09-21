export type GroundedAnswerStatus =
  | 'grounded'
  | 'calculated'
  | 'insufficient_evidence'
  | 'expert_review'
  | 'source_unavailable'
  | 'error';

export type GroundedConfidence = 'high' | 'medium' | 'low';

export type GroundedSourceType =
  | 'golden'
  | 'reviewer'
  | 'pop'
  | 'market_prices'
  | 'buyers'
  | 'weather'
  | 'institutional'
  | 'llm_low_risk';

export interface GroundedSource {
  type: GroundedSourceType;
  id: string;
  title: string;
  reference: string;
  score?: number;
  metadata?: Record<string, any>;
}

export interface GroundedAnswerRequest {
  questionId?: string;
  query: string;
  language?: string;
  state?: string;
  district?: string;
  crop?: string;
  season?: string;
  domain?: string;
  userContext?: {
    userId?: string;
    role?: string;
    state?: string;
    district?: string;
  };
}

export interface GroundedAnswerResponse {
  questionId: string;
  answer: string;
  confidence: GroundedConfidence;
  status: GroundedAnswerStatus;
  sources: GroundedSource[];
  warnings: string[];
  language: string;
  generatedAt: string;
}

export interface IGroundedAnswerService {
  generateGroundedAnswer(
    request: GroundedAnswerRequest,
  ): Promise<GroundedAnswerResponse>;
}
