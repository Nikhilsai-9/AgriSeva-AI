import {Container, ContainerModule} from 'inversify';
import {useContainer} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';

import * as accAgentModule from '../modules/acc-agent/index.js';
import * as aiModule from '../modules/ai/index.js';
import * as answerModule from '../modules/answer/index.js';
import * as auditTrailsModule from '../modules/auditTrails/index.js';
import * as authModule from '../modules/auth/index.js';
import * as chatbotModule from '../modules/chatbot/index.js';
import * as chemicalModule from '../modules/chemical/index.js';
import * as commentModule from '../modules/comment/index.js';
import * as contextModule from '../modules/context/index.js';
import * as coreModule from '../modules/core/index.js';
import * as cropModule from '../modules/crop/index.js';
import * as dashboardModule from '../modules/dashboard/index.js';
import * as groundedAnswerModule from '../modules/groundedAnswer/index.js';
import * as lgdModule from '../modules/lgd/index.js';
import * as marketIntelligenceModule from '../modules/marketIntelligence/index.js';
import * as notificationModule from '../modules/notification/index.js';
import * as performanceModule from '../modules/performance/index.js';
import * as plivoModule from '../modules/plivo/index.js';
import * as questionModule from '../modules/question/index.js';
import * as requestModule from '../modules/request/index.js';
import * as rerouteModule from '../modules/reroute/index.js';
import * as transactionModule from '../modules/transaction/index.js';
import * as userModule from '../modules/user/index.js';
import * as whatsappModule from '../modules/whatsapp/index.js';

let container: Container | null = null;

interface LoadedModuleResult {
  controllers: Function[];
  validators: Function[];
}

const moduleRegistry: Record<string, any> = {
  'acc-agent': accAgentModule,
  ai: aiModule,
  answer: answerModule,
  auditTrails: auditTrailsModule,
  auth: authModule,
  chatbot: chatbotModule,
  chemical: chemicalModule,
  comment: commentModule,
  context: contextModule,
  core: coreModule,
  crop: cropModule,
  dashboard: dashboardModule,
  groundedAnswer: groundedAnswerModule,
  lgd: lgdModule,
  marketIntelligence: marketIntelligenceModule,
  notification: notificationModule,
  performance: performanceModule,
  plivo: plivoModule,
  question: questionModule,
  request: requestModule,
  reroute: rerouteModule,
  transaction: transactionModule,
  user: userModule,
  whatsapp: whatsappModule,
};

export async function loadAppModules(
  moduleName: string,
): Promise<LoadedModuleResult> {
  const isAll = moduleName === 'all';
  let controllers: Function[] = [];
  let validators: Function[] = [];
  const allContainerModules: ContainerModule[] = [];

  for (const [name, moduleExports] of Object.entries(moduleRegistry)) {
    const controllerExportKey = `${name}ModuleControllers`;
    const validatorExportKey = `${name}ModuleValidators`;
    const containerModulesKey = `${name}ContainerModules`;
    const setupFunctionKey = `setup${name[0].toUpperCase()}${name.slice(1)}Container`;

    if (isAll) {
      if (Array.isArray(moduleExports[controllerExportKey])) {
        controllers.push(...moduleExports[controllerExportKey]);
      }
      if (Array.isArray(moduleExports[validatorExportKey])) {
        validators.push(...moduleExports[validatorExportKey]);
      }
      if (Array.isArray(moduleExports[containerModulesKey])) {
        allContainerModules.push(...moduleExports[containerModulesKey]);
      }
    } else if (name.toLowerCase() === moduleName.toLowerCase()) {
      controllers = moduleExports[controllerExportKey] ?? [];
      validators = moduleExports[validatorExportKey] ?? [];
      const setupContainer = moduleExports[setupFunctionKey];
      if (setupContainer) {
        await setupContainer();
      }
    }
  }

  if (isAll) {
    const uniqueModules = Array.from(new Set(allContainerModules));
    container = new Container();
    await container.load(...uniqueModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
  }

  return {controllers, validators};
}

export const getContainer = (): Container => {
  if (!container) {
    throw new Error(
      'Container not initialized. Call loadAppModules("all") first.',
    );
  }
  return container;
};
