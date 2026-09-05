import { attachDatabasePool } from '@vercel/functions';

import {
  createServerlessHandler,
  ServerlessInitializationError,
} from './serverless.js';
import { findInvalidRuntimeVariables } from './runtime-environment.js';

const handler = createServerlessHandler({
  initialize: async () => {
    const invalidVariables = findInvalidRuntimeVariables(process.env);
    if (invalidVariables.length > 0) {
      throw new ServerlessInitializationError('configuration', invalidVariables);
    }

    let database: typeof import('../database/client.js');
    try {
      database = await import('../database/client.js');
    } catch (error) {
      throw new ServerlessInitializationError('database-module', [], { cause: error });
    }

    let application: typeof import('../services/edunets-api/src/app.js');
    try {
      application = await import('../services/edunets-api/src/app.js');
    } catch (error) {
      throw new ServerlessInitializationError('application-module', [], { cause: error });
    }

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
