import { ContainerModule } from 'inversify';
import { GROUNDED_ANSWER_TYPES } from './types.js';
import type { IGroundedAnswerService } from './interfaces/IGroundedAnswerService.js';
import { GroundedAnswerService } from './services/GroundedAnswerService.js';

export const groundedAnswerContainerModule = new ContainerModule(options => {
  options
    .bind<IGroundedAnswerService>(GROUNDED_ANSWER_TYPES.GroundedAnswerService)
    .to(GroundedAnswerService)
    .inSingletonScope();
});
