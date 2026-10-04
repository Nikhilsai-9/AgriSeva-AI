import { ContainerModule } from 'inversify';
import { AGORA_TYPES } from './types.js';
import { AgoraController } from './controllers/AgoraController.js';
import { AgoraService } from './services/AgoraService.js';

export const agoraContainerModule = new ContainerModule(options => {
  // Controllers
  options.bind(AgoraController).toSelf().inSingletonScope();

  // Services
  options.bind(AGORA_TYPES.AgoraService).to(AgoraService).inSingletonScope();
});
