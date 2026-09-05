import { attachDatabasePool } from '@vercel/functions';

import {
  createServerlessHandler,
  ServerlessInitializationError,
} from './serverless.js';
import { findInvalidRuntimeVariables } from './runtime-environment.js';

type InitializationStage = ConstructorParameters<typeof ServerlessInitializationError>[0];

async function loadModule<T>(stage: InitializationStage, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    throw new ServerlessInitializationError(stage, [], { cause: error });
  }
}

const handler = createServerlessHandler({
  initialize: async () => {
    const validateConfiguration = (): void => {
      const invalidVariables = findInvalidRuntimeVariables(process.env);
      if (invalidVariables.length > 0) {
        throw new ServerlessInitializationError('configuration', invalidVariables);
      }
    };

    // Vercel injects runtime variables before module evaluation. Local commands
    // load .env.local through the database module, so validate them afterward.
    if (process.env.VERCEL === '1') validateConfiguration();

    const database = await loadModule('database-module', () => import('../database/client.js'));
    if (process.env.VERCEL !== '1') validateConfiguration();
    await loadModule('environment-module', () => import('../services/edunets-api/src/env.js'));
    await loadModule('auth-module', () => import('../services/edunets-api/src/auth.js'));
    await loadModule('errors-module', () => import('../services/edunets-api/src/errors.js'));
    await loadModule(
      'request-context-module',
      () => import('../services/edunets-api/src/middleware/request-context.js'),
    );
    await loadModule('api-v1-route', () => import('../services/edunets-api/src/routes/api-v1.js'));
    await loadModule('enquiries-route', () => import('../services/edunets-api/src/routes/enquiries.js'));
    await loadModule(
      'study-squads-route',
      () => import('../services/edunets-api/src/routes/study-squads.js'),
    );
    await loadModule(
      'squad-quiz-route',
      () => import('../services/edunets-api/src/routes/squad-quiz.js'),
    );
    await loadModule(
      'notifications-route',
      () => import('../services/edunets-api/src/routes/notifications.js'),
    );
    await loadModule(
      'revision-rooms-route',
      () => import('../services/edunets-api/src/routes/revision-rooms.js'),
    );
    await loadModule(
      'learning-work-route',
      () => import('../services/edunets-api/src/routes/learning-work.js'),
    );
    const application = await loadModule(
      'application-module',
      () => import('../services/edunets-api/src/app.js'),
    );

    try {
      attachDatabasePool(database.pool);
    } catch (error) {
      throw new ServerlessInitializationError('pool-attachment', [], { cause: error });
    }

    return {
      fetch: (request: Request) => application.app.fetch(request),
      checkReadiness: () => database.pool.query('select 1'),
    };
  },
});

export default handler;
