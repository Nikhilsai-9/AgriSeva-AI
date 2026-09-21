import { ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { groundedAnswerContainerModule } from './container.js';

export const groundedAnswerModuleControllers: Function[] = [];
export const groundedAnswerModuleValidators: Function[] = [];
export const groundedAnswerContainerModules: ContainerModule[] = [
  groundedAnswerContainerModule,
  sharedContainerModule,
];

export * from './types.js';
export * from './interfaces/IGroundedAnswerService.js';
export * from './services/GroundedAnswerService.js';
