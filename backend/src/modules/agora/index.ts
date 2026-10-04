import { sharedContainerModule } from '#root/container.js';
import { Container, ContainerModule } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'class-validator';
import { agoraContainerModule } from './container.js';
import { AgoraController } from './controllers/AgoraController.js';

// Controllers to register with routing-controllers
export const agoraModuleControllers: Function[] = [AgoraController];

// Container modules
export const agoraContainerModules: ContainerModule[] = [
  agoraContainerModule,
  sharedContainerModule,
];

export async function setupAgoraContainer(): Promise<void> {
  const container = new Container();
  await container.load(...agoraContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export * from './controllers/AgoraController.js';
export * from './services/AgoraService.js';
export * from './types.js';
