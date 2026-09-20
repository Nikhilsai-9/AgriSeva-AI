const TYPES = {
  // Database
  Database: Symbol.for('Database'),

  // Controllers
  QuestionController: Symbol.for('QuestionController'),
  AnswerController: Symbol.for('AnswerController'),
  ContextController: Symbol.for('ContextController'),
  RequestController: Symbol.for('RequestController'),
  ReRouteController:Symbol.for('ReRouteController'),
  ChemicalController: Symbol.for('ChemicalController'),

  // Services
  UserService: Symbol.for('UserService'),
  QuestionService: Symbol.for('QuestionService'),
  AnswerService: Symbol.for('AnswerService'),
  ContextService: Symbol.for('ContextService'),
  CommentService: Symbol.for('CommentService'),
  RequestService: Symbol.for('RequestService'),
  SarvamService: Symbol.for('SarvamService'),
  NotificationService: Symbol.for('NotificationService'),
  PerformanceService: Symbol.for('PerformanceService'),
  ReRouteService:Symbol.for('ReRouteService'),
  AccAgentService: Symbol.for('AccAgentService'),

  // Repositories
  RequestRepository: Symbol.for('RequestRepository'),
  QuestionRepository: Symbol.for('QuestionRepository'),
  QuestionSubmissionRepository: Symbol.for('QuestionSubmissionRepository'),
  AnswerRepository: Symbol.for('AnswerRepository'),
  ContextRepository: Symbol.for('ContextRepository'),
  UserRepository: Symbol.for('userRepository'),
  NotificationRepository: Symbol.for('NotificationRepository'),
  ReviewRepository: Symbol.for('ReviewRepository'),
  ReRouteRepository:Symbol.for("ReRouteRepository"),
  DuplicateQuestionRepository:Symbol.for("DuplicateQuestionRepository"),
  ChatbotRepository: Symbol.for('ChatbotRepository'),
  CropRepository: Symbol.for('CropRepository'),
  ChemicalRepository: Symbol.for('ChemicalRepository'),
  MongoDatabase: Symbol.for('MongoDatabase'),
  CropService: Symbol.for('CropService'),
  ChemicalService: Symbol.for('ChemicalService'),

  // ─── Market Intelligence (added Phase 2) ───
  MarketPriceRepository: Symbol.for('MarketPriceRepository'),
  MandiRepository: Symbol.for('MandiRepository'),
  CommodityAliasRepository: Symbol.for('CommodityAliasRepository'),
  DataUpdateLogRepository: Symbol.for('DataUpdateLogRepository'),
  MarketIngestionService: Symbol.for('MarketIngestionService'),
  MarketNormaliserService: Symbol.for('MarketNormaliserService'),
  MarketHistoryService: Symbol.for('MarketHistoryService'),
  MarketReliabilityService: Symbol.for('MarketReliabilityService'),
  CommodityResolver: Symbol.for('CommodityResolver'),
  RecommendationService: Symbol.for('RecommendationService'),
  AgmarknetMcpClient: Symbol.for('AgmarknetMcpClient'),
  EnamMcpClient: Symbol.for('EnamMcpClient'),

  // ─── Transaction module (added Phase 3) ───
  TransactionBuyerRepository: Symbol.for('TransactionBuyerRepository'),
  TransactionLotRepository: Symbol.for('TransactionLotRepository'),
  TransactionOfferRepository: Symbol.for('TransactionOfferRepository'),
  TransactionPaymentRepository: Symbol.for('TransactionPaymentRepository'),
  TransactionGrievanceRepository: Symbol.for('TransactionGrievanceRepository'),
  TransactionStorageRepository: Symbol.for('TransactionStorageRepository'),
  TransactionLogisticsRepository: Symbol.for('TransactionLogisticsRepository'),
  TransactionOfferService: Symbol.for('TransactionOfferService'),
  TransactionSeedLoader: Symbol.for('TransactionSeedLoader'),

  // Constants
  uri: Symbol.for('dbURI'),
  dbName: Symbol.for('dbName'),

  analyticsUri: Symbol.for('analyticsDbURI'),
  analyticsDbName: Symbol.for('analyticsDbName'),
  analyticsDatabase: Symbol.for('AnalyticsDatabase'),

  annamanalyticsUri: Symbol.for('annamanalyticsDbURI'),
  annamanalyticsDbName: Symbol.for('annamanalyticsDbName'),
  annamanalyticsDatabase: Symbol.for('annamAnalyticsDatabase'),
};

export {TYPES as GLOBAL_TYPES};
