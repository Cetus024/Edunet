import { attachDatabasePool } from '@vercel/functions';

import { pool } from '../database/client.js';
import { app } from '../services/edunets-api/src/app.js';

attachDatabasePool(pool);

export default {
  fetch(request: Request) {
    return app.fetch(request);
  },
};
