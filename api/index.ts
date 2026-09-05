import { attachDatabasePool } from '@vercel/functions';

import { createServerlessHandler } from './serverless.js';

const handler = createServerlessHandler({
  initialize: async () => {
    const [{ pool }, { app }] = await Promise.all([
      import('../database/client.js'),
      import('../services/edunets-api/src/app.js'),
    ]);

    attachDatabasePool(pool);

    return {
      fetch: (request: Request) => app.fetch(request),
      checkReadiness: () => pool.query('select 1'),
    };
  },
});

export default handler;
